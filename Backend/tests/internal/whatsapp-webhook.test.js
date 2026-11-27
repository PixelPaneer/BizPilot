import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import express from "express";
import test from "node:test";
import request from "supertest";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:5432/test";
process.env.SERVICE_JWT_SECRET ||= "whatsapp-webhook-test-secret-at-least-32";

const { createWhatsappWebhookRouter } = await import(
  "../../src/routes/whatsappWebhook.routes.js"
);
const {
  AI_UNAVAILABLE_REPLY,
  createWhatsappWebhookProcessor,
  MESSAGE_TOO_LONG_REPLY,
  UNSUPPORTED_MESSAGE_REPLY,
} = await import("../../src/services/whatsappWebhook.service.js");

const APP_SECRET = "fake-meta-app-secret";
const VERIFY_TOKEN = "fake-webhook-verification-token";

function createTestApp(options = {}) {
  const router = createWhatsappWebhookRouter({
    verifyToken: VERIFY_TOKEN,
    appSecret: APP_SECRET,
    processPayload: async () => {},
    ...options,
  });
  const app = express();
  app.use(
    "/webhooks/whatsapp",
    express.raw({ type: "application/json", limit: "1mb" }),
    router
  );
  return app;
}

function sign(rawBody, secret = APP_SECRET) {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

function payloadFor(messages, phoneNumberId = "meta-business-number-id") {
  return {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: phoneNumberId },
          messages,
        },
      }],
    }],
  };
}

function textMessage(id, from, body) {
  return { id, from, type: "text", text: { body } };
}

test("WhatsApp webhook verifies Meta's challenge and rejects an incorrect token", async () => {
  const app = createTestApp();
  const verified = await request(app)
    .get("/webhooks/whatsapp")
    .query({
      "hub.mode": "subscribe",
      "hub.verify_token": VERIFY_TOKEN,
      "hub.challenge": "challenge-value",
    });
  const rejected = await request(app)
    .get("/webhooks/whatsapp")
    .query({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong-token",
      "hub.challenge": "challenge-value",
    });

  assert.equal(verified.status, 200);
  assert.equal(verified.text, "challenge-value");
  assert.equal(rejected.status, 403);
  assert.equal(rejected.body.code, "WEBHOOK_VERIFICATION_FAILED");
});

test("WhatsApp webhook verifies raw-body signatures and acknowledges after processing", async () => {
  let processedPayload;
  let startProcessing;
  let finishProcessing;
  const processingStarted = new Promise((resolve) => {
    startProcessing = resolve;
  });
  const processing = new Promise((resolve) => {
    finishProcessing = resolve;
  });
  const app = createTestApp({
    processPayload: async (payload) => {
      processedPayload = payload;
      startProcessing();
      await processing;
      return true;
    },
  });
  const rawBody = Buffer.from(JSON.stringify(payloadFor([])));

  const invalid = await request(app)
    .post("/webhooks/whatsapp")
    .set("Content-Type", "application/json")
    .set("X-Hub-Signature-256", "sha256=invalid")
    .send(rawBody.toString("utf8"));

  assert.equal(invalid.status, 403);
  assert.equal(invalid.body.code, "INVALID_WEBHOOK_SIGNATURE");
  let responseReceived = false;
  const acceptedPromise = request(app)
    .post("/webhooks/whatsapp")
    .set("Content-Type", "application/json")
    .set("X-Hub-Signature-256", sign(rawBody))
    .send(rawBody.toString("utf8"))
    .then((response) => {
      responseReceived = true;
      return response;
    });

  await processingStarted;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(responseReceived, false);
  assert.deepEqual(processedPayload, payloadFor([]));

  finishProcessing();
  const accepted = await acceptedPromise;
  assert.equal(accepted.status, 200);
  assert.equal(accepted.text, "OK");
});

test("WhatsApp webhook returns a retryable status when processing is incomplete", async () => {
  const app = createTestApp({ processPayload: async () => false });
  const rawBody = Buffer.from(JSON.stringify(payloadFor([])));
  const response = await request(app)
    .post("/webhooks/whatsapp")
    .set("Content-Type", "application/json")
    .set("X-Hub-Signature-256", sign(rawBody))
    .send(rawBody.toString("utf8"));

  assert.equal(response.status, 503);
});

test("customer messages resolve the shop from Meta metadata and reach only the customer orchestrator role", async () => {
  const aiCalls = [];
  const sentMessages = [];
  const logs = [];
  const processor = createWhatsappWebhookProcessor({
    appSecret: APP_SECRET,
    findBusiness: async (phoneNumberId) => {
      assert.equal(phoneNumberId, "meta-business-number-id");
      return { businessId: "mapped-business-id", businessName: "Demo Shop" };
    },
    askAi: async (...args) => {
      aiCalls.push(args);
      return { reply: "Yes, the item is available.", route: "customer" };
    },
    sendMessage: async (...args) => sentMessages.push(args),
    logger: (metadata) => logs.push(metadata),
  });

  await processor.processPayload(
    payloadFor([textMessage("wamid.synthetic-1", "919000000001", "  Is rice available?  ")])
  );

  assert.equal(aiCalls.length, 1);
  assert.equal(aiCalls[0][0], "mapped-business-id");
  assert.equal(aiCalls[0][1], "/internal/orchestrate");
  assert.deepEqual(aiCalls[0][2], {
    method: "POST",
    body: {
      message: "Is rice available?",
      senderRole: "customer",
      shopName: "Demo Shop",
    },
    timeoutMs: 35_000,
  });
  assert.deepEqual(sentMessages, [[
    "meta-business-number-id",
    "919000000001",
    "Yes, the item is available.",
  ]]);
  assert.deepEqual(logs, []);
});

test("duplicate IDs and sender rate limits suppress repeat customer requests", async () => {
  let aiCalls = 0;
  let sends = 0;
  let timestamp = 1_000;
  const processor = createWhatsappWebhookProcessor({
    appSecret: APP_SECRET,
    findBusiness: async () => ({ businessId: "mapped-business-id", businessName: "Demo Shop" }),
    askAi: async () => {
      aiCalls += 1;
      return { reply: "A reply.", route: "customer" };
    },
    sendMessage: async () => {
      sends += 1;
    },
    now: () => timestamp,
    wait: async () => {},
  });

  await processor.processPayload(payloadFor([
    textMessage("duplicate-id", "919000000002", "First"),
    textMessage("duplicate-id", "919000000002", "Duplicate"),
  ]));
  assert.equal(aiCalls, 1);
  assert.equal(sends, 1);

  const firstTen = Array.from({ length: 10 }, (_, index) =>
    textMessage(`rate-limit-${index}`, "919000000003", `Question ${index}`)
  );
  timestamp = 59_000;
  await processor.processPayload(payloadFor(firstTen));
  assert.equal(aiCalls, 11);
  assert.equal(sends, 11);

  timestamp = 60_001;
  await processor.processPayload(
    payloadFor([textMessage("rate-limit-11", "919000000003", "Still within one minute.")])
  );
  assert.equal(aiCalls, 11);
  assert.equal(sends, 11);

  timestamp = 119_001;
  await processor.processPayload(
    payloadFor([textMessage("rate-limit-12", "919000000003", "Window has elapsed.")])
  );
  assert.equal(aiCalls, 12);
  assert.equal(sends, 12);
});

test("a failed reply delivery remains retryable and does not consume sender quota", async () => {
  let aiCalls = 0;
  let sendCalls = 0;
  const processor = createWhatsappWebhookProcessor({
    appSecret: APP_SECRET,
    findBusiness: async () => ({ businessId: "mapped-business-id", businessName: "Demo Shop" }),
    askAi: async () => {
      aiCalls += 1;
      return { reply: "A reply.", route: "customer" };
    },
    sendMessage: async () => {
      sendCalls += 1;
      if (sendCalls === 1) throw new Error("Temporary provider failure.");
    },
    logger: () => {},
  });
  const messagePayload = payloadFor([
    textMessage("retry-after-delivery-failure", "919000000009", "Is rice available?"),
  ]);

  assert.equal(await processor.processPayload(messagePayload), false);
  assert.equal(await processor.processPayload(messagePayload), true);
  assert.equal(aiCalls, 2);
  assert.equal(sendCalls, 2);
});

test("unknown phone-number IDs and status receipts are ignored; oversized text stays out of AI", async () => {
  const lookups = [];
  const sentMessages = [];
  let aiCalls = 0;
  const processor = createWhatsappWebhookProcessor({
    appSecret: APP_SECRET,
    findBusiness: async (phoneNumberId) => {
      lookups.push(phoneNumberId);
      return phoneNumberId === "known-number"
        ? { businessId: "mapped-business-id", businessName: "Demo Shop" }
        : null;
    },
    askAi: async () => {
      aiCalls += 1;
      return { reply: "Should not be used.", route: "customer" };
    },
    sendMessage: async (...args) => sentMessages.push(args),
    wait: async () => {},
  });

  await processor.processPayload({
    entry: [{
      changes: [
        {
          value: {
            metadata: { phone_number_id: "unknown-number" },
            messages: [textMessage("unknown-message", "919000000006", "Ignore this.")],
          },
        },
        {
          value: {
            metadata: { phone_number_id: "known-number" },
            statuses: [{ id: "status-only-receipt", status: "delivered" }],
          },
        },
        {
          value: {
            metadata: { phone_number_id: "known-number" },
            messages: [
              textMessage("oversized-message", "919000000007", "x".repeat(1001)),
            ],
          },
        },
      ],
    }],
  });

  assert.deepEqual(lookups, ["unknown-number", "known-number"]);
  assert.equal(aiCalls, 0);
  assert.deepEqual(sentMessages, [[
    "known-number",
    "919000000007",
    MESSAGE_TOO_LONG_REPLY,
  ]]);
});

test("non-text messages get a fixed reply and delivery failures log metadata only", async () => {
  const logs = [];
  let aiCalls = 0;
  const customerNumber = "919000000004";
  const privateText = "synthetic customer question";
  const processor = createWhatsappWebhookProcessor({
    appSecret: APP_SECRET,
    findBusiness: async () => ({ businessId: "mapped-business-id", businessName: "Demo Shop" }),
    askAi: async () => {
      aiCalls += 1;
      throw new Error("Never log generated or customer content.");
    },
    sendMessage: async (_phoneNumberId, _recipient, reply) => {
      assert.equal(reply, UNSUPPORTED_MESSAGE_REPLY);
      throw new Error(`${customerNumber} ${privateText} ${reply}`);
    },
    logger: (metadata) => logs.push(metadata),
  });

  await processor.processPayload(payloadFor([{
    id: "wamid.synthetic-media",
    from: customerNumber,
    type: "image",
    image: { id: "temporary-media-id" },
  }]));

  assert.equal(aiCalls, 0);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].code, "WHATSAPP_SEND_FAILED");
  assert.equal(JSON.stringify(logs).includes(customerNumber), false);
  assert.equal(JSON.stringify(logs).includes(privateText), false);
  assert.equal(JSON.stringify(logs).includes(UNSUPPORTED_MESSAGE_REPLY), false);
});

test("AI outages are retried once and produce a fixed bilingual reply", async () => {
  let aiCalls = 0;
  const sentMessages = [];
  const logs = [];
  const processor = createWhatsappWebhookProcessor({
    appSecret: APP_SECRET,
    findBusiness: async () => ({ businessId: "mapped-business-id", businessName: "Demo Shop" }),
    askAi: async () => {
      aiCalls += 1;
      const error = new Error("synthetic outage");
      error.code = "AI_UNAVAILABLE";
      throw error;
    },
    sendMessage: async (...args) => sentMessages.push(args),
    logger: (metadata) => logs.push(metadata),
    wait: async () => {},
  });

  const privateText = "synthetic customer question";
  await processor.processPayload(
    payloadFor([textMessage("wamid.synthetic-outage", "919000000005", privateText)])
  );

  assert.equal(aiCalls, 2);
  assert.match(sentMessages[0][2], /Sorry, I could not check that right now/);
  assert.match(sentMessages[0][2], /माफ़ कीजिए/);
  assert.equal(logs[0].code, "AI_UNAVAILABLE");
  assert.equal(JSON.stringify(logs).includes(privateText), false);
  assert.equal(JSON.stringify(logs).includes("919000000005"), false);
});

test("unexpected owner-only routes are never sent to customers", async () => {
  const sentMessages = [];
  const logs = [];
  const processor = createWhatsappWebhookProcessor({
    appSecret: APP_SECRET,
    findBusiness: async () => ({ businessId: "mapped-business-id", businessName: "Demo Shop" }),
    askAi: async () => ({
      reply: "Sensitive owner analytics must not be sent.",
      route: "insights",
    }),
    sendMessage: async (...args) => sentMessages.push(args),
    logger: (metadata) => logs.push(metadata),
  });

  await processor.processPayload(
    payloadFor([textMessage("wamid.synthetic-route", "919000000008", "Is tea available?")])
  );

  assert.equal(sentMessages[0][2], AI_UNAVAILABLE_REPLY);
  assert.equal(logs[0].code, "UNEXPECTED_AI_ROUTE");
  assert.equal(JSON.stringify(logs).includes("Sensitive owner analytics"), false);
});
