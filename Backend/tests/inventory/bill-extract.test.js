import assert from "node:assert/strict";
import http from "node:http";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import test, { after, afterEach, beforeEach } from "node:test";
import request from "supertest";

dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  test("bill extraction integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not point to DATABASE_URL.");
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const [{ default: app }, { env }, { pool }] = await Promise.all([
    import("../../src/app.js"),
    import("../../src/config/env.js"),
    import("../../src/config/db.js"),
  ]);

  const SECRET = "test-service-secret-test-service-secret-1";
  const originalAiUrl = env.aiServiceUrl;
  const originalDevUser = env.devUserId;
  const originalSecret = env.serviceJwtSecret;
  const AUDIO = Buffer.from("not-really-audio-just-bytes");

  let fixture;
  let ai; // the stand-in AI service
  const seen = {};

  // What the AI service answers (snake_case, as the Python service does).
  const DRAFT = {
    type: "PURCHASE",
    lines: [
      {
        type: "PURCHASE",
        raw_text: "Parle-G 50 aur aaye",
        quantity: 50,
        unit: null,
        price: null,
        matched_product_id: "11111111-1111-4111-8111-111111111111",
        matched_product_name: "Parle-G",
        confidence: 0.9,
        candidates: [{ product_id: "11111111-1111-4111-8111-111111111111", name: "Parle-G", price: 10 }],
      },
    ],
    warnings: [],
    transcript: null,
  };

  async function startAi(handler) {
    ai = http.createServer((req, res) => {
      const chunks = [];
      req.on("data", (chunk) => chunks.push(chunk));
      req.on("end", () => {
        seen.method = req.method;
        seen.url = req.url;
        seen.authorization = req.headers.authorization;
        seen.contentType = req.headers["content-type"];
        seen.body = Buffer.concat(chunks);
        handler(req, res);
      });
    });
    await new Promise((resolve) =>
      ai.listen(0, "127.0.0.1", () => {
        env.aiServiceUrl = `http://127.0.0.1:${ai.address().port}`;
        resolve();
      })
    );
  }

  const answer = (payload, status = 200) => (req, res) => {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(payload));
  };

  const extract = (build = (req) => req.attach("audio", AUDIO, { filename: "note.webm", contentType: "audio/webm" })) =>
    build(request(app).post("/api/v1/bills/extract"));

  async function createFixture() {
    const { rows: users } = await pool.query(
      `INSERT INTO app_users (first_name, last_name, email, password_hash, whatsapp_number)
       VALUES ('Bill', 'Tester', 'bill-test@bizpilot.local', 'test-hash', '9000000061')
       RETURNING user_id`
    );
    const { rows: businesses } = await pool.query(
      `INSERT INTO businesses
         (owner_user_id, business_name, business_type, owner_name,
          contact_number, business_email, business_address)
       VALUES ($1, 'Bill Test Business', 'Retail', 'Bill Tester',
               '9000000061', 'bill-test@bizpilot.local', 'Test address')
       RETURNING business_id`,
      [users[0].user_id]
    );
    env.nodeEnv = "test";
    env.devUserId = users[0].user_id;
    return { userId: users[0].user_id, businessId: businesses[0].business_id };
  }

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE TABLE inventory_alerts, stock_movements, audit_logs, sale_items, sales,
         purchase_batches, inventory, products, business_settings, businesses, app_users
       CASCADE`
    );
    fixture = await createFixture();
    env.serviceJwtSecret = SECRET;
    for (const key of Object.keys(seen)) delete seen[key];
    await startAi(answer(DRAFT));
  });

  afterEach(async () => {
    env.aiServiceUrl = originalAiUrl;
    env.devUserId = originalDevUser;
    env.serviceJwtSecret = originalSecret;
    ai.closeAllConnections?.();
    await new Promise((resolve) => ai.close(resolve));
  });

  after(async () => {
    await pool.end();
  });

  test("a voice note is forwarded to the AI service as audio and the draft comes back in camelCase", async () => {
    const response = await extract();

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      success: true,
      data: {
        type: "PURCHASE",
        lines: [
          {
            type: "PURCHASE",
            rawText: "Parle-G 50 aur aaye",
            quantity: 50,
            unit: null,
            price: null,
            matchedProductId: "11111111-1111-4111-8111-111111111111",
            matchedProductName: "Parle-G",
            confidence: 0.9,
            candidates: [{ productId: "11111111-1111-4111-8111-111111111111", name: "Parle-G", price: 10 }],
          },
        ],
        warnings: [],
      },
    });
    assert.equal(seen.method, "POST");
    assert.equal(seen.url, "/internal/bills/extract");
    assert.equal(seen.contentType, "audio/webm");
    assert.deepEqual(seen.body, AUDIO);
  });

  test("the service token names the owner's shop and nothing from the request can change it", async () => {
    await extract((req) =>
      req
        .field("businessId", "22222222-2222-4222-8222-222222222222")
        .attach("audio", AUDIO, { filename: "n.webm", contentType: "audio/webm" })
    );
    const claims = jwt.verify(seen.authorization.replace("Bearer ", ""), SECRET, {
      algorithms: ["HS256"],
      issuer: "bizpilot-node",
      audience: "bizpilot-ai",
    });
    assert.equal(claims.business_id, fixture.businessId);
  });

  test("a type hint is passed on, and a bad one is refused before the AI service is called", async () => {
    const ok = await extract((req) =>
      req.field("type", "SALE").attach("audio", AUDIO, { filename: "n.webm", contentType: "audio/webm" })
    );
    assert.equal(ok.status, 200);
    assert.equal(seen.url, "/internal/bills/extract?type=SALE");

    for (const key of Object.keys(seen)) delete seen[key];
    const bad = await extract((req) =>
      req.field("type", "REFUND").attach("audio", AUDIO, { filename: "n.webm", contentType: "audio/webm" })
    );
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, "VALIDATION_ERROR");
    assert.equal(seen.url, undefined);
  });

  test("a codec in the audio type is accepted and dropped", async () => {
    const response = await extract((req) =>
      req.attach("audio", AUDIO, { filename: "n.webm", contentType: "audio/webm;codecs=opus" })
    );
    assert.equal(response.status, 200);
    assert.equal(seen.contentType, "audio/webm");
  });

  test("no file, the wrong kind of file and a file that is too large are refused with 400", async () => {
    const none = await extract((req) => req.field("type", "SALE"));
    assert.equal(none.status, 400);

    const image = await extract((req) =>
      req.attach("audio", Buffer.from("x"), { filename: "bill.png", contentType: "image/png" })
    );
    assert.equal(image.status, 400);

    const huge = await extract((req) =>
      req.attach("audio", Buffer.alloc(5 * 1024 * 1024 + 1), { filename: "n.webm", contentType: "audio/webm" })
    );
    assert.equal(huge.status, 400);
    assert.match(huge.body.message, /5 MB/);

    assert.equal(seen.url, undefined, "the AI service was never called");
  });

  const PHOTO = Buffer.from("not-really-a-jpeg-just-bytes");
  const photo = (req, type = "image/jpeg") =>
    req.attach("image", PHOTO, { filename: "bill.jpg", contentType: type });

  test("a bill photo, from a file or straight from the camera, is forwarded as an image", async () => {
    const response = await extract((req) => photo(req));
    assert.equal(response.status, 200);
    assert.equal(response.body.data.lines[0].matchedProductName, "Parle-G");
    assert.equal(seen.url, "/internal/bills/extract");
    assert.equal(seen.contentType, "image/jpeg");
    assert.deepEqual(seen.body, PHOTO);

    for (const type of ["image/png", "image/webp"]) {
      assert.equal((await extract((req) => photo(req, type))).status, 200, type);
      assert.equal(seen.contentType, type);
    }
  });

  test("a photo may be up to 10 MB, a voice note only 5 MB", async () => {
    const sixMb = Buffer.alloc(6 * 1024 * 1024);
    const bigPhoto = await extract((req) =>
      req.attach("image", sixMb, { filename: "bill.jpg", contentType: "image/jpeg" })
    );
    assert.equal(bigPhoto.status, 200);

    const bigAudio = await extract((req) =>
      req.attach("audio", sixMb, { filename: "n.webm", contentType: "audio/webm" })
    );
    assert.equal(bigAudio.status, 400);
    assert.match(bigAudio.body.message, /5 MB/);

    const hugePhoto = await extract((req) =>
      req.attach("image", Buffer.alloc(10 * 1024 * 1024 + 1), { filename: "b.jpg", contentType: "image/jpeg" })
    );
    assert.equal(hugePhoto.status, 400);
    assert.match(hugePhoto.body.message, /10 MB/);
  });

  test("exactly one file is required, and each field takes only its own kind", async () => {
    const both = await extract((req) =>
      photo(req).attach("audio", AUDIO, { filename: "n.webm", contentType: "audio/webm" })
    );
    assert.equal(both.status, 400);

    const audioInImageField = await extract((req) =>
      req.attach("image", AUDIO, { filename: "n.webm", contentType: "audio/webm" })
    );
    assert.equal(audioInImageField.status, 400);

    const pdf = await extract((req) =>
      req.attach("image", PHOTO, { filename: "bill.pdf", contentType: "application/pdf" })
    );
    assert.equal(pdf.status, 400);

    const strangeField = await extract((req) =>
      req.attach("file", PHOTO, { filename: "bill.jpg", contentType: "image/jpeg" })
    );
    assert.equal(strangeField.status, 400);

    assert.equal(seen.url, undefined, "the AI service was never called");
  });

  test("each line keeps its own kind, so one note can hold sales and purchases", async () => {
    ai.closeAllConnections?.();
    await new Promise((resolve) => ai.close(resolve));
    const line = (type) => ({ ...DRAFT.lines[0], type });
    await startAi(answer({ ...DRAFT, type: null, lines: [line("SALE"), line("PURCHASE"), line(null)] }));

    const response = await extract();
    assert.equal(response.status, 200);
    assert.equal(response.body.data.type, null);
    assert.deepEqual(
      response.body.data.lines.map((item) => item.type),
      ["SALE", "PURCHASE", null]
    );
  });

  test("a call without sign-in is refused", async () => {
    env.devUserId = null;
    const response = await request(app)
      .post("/api/v1/bills/extract")
      .attach("audio", AUDIO, { filename: "n.webm", contentType: "audio/webm" });
    assert.equal(response.status, 401);
    assert.equal(seen.url, undefined);
  });

  test("an AI service that fails or answers nonsense becomes 502 AI_UNAVAILABLE", async () => {
    ai.closeAllConnections?.();
    await new Promise((resolve) => ai.close(resolve));

    await startAi(answer({ success: false }, 502));
    let response = await extract();
    assert.equal(response.status, 502);
    assert.equal(response.body.code, "AI_UNAVAILABLE");

    ai.closeAllConnections?.();
    await new Promise((resolve) => ai.close(resolve));
    await startAi(answer({ unexpected: true }));
    response = await extract();
    assert.equal(response.status, 502);
    assert.equal(response.body.code, "AI_UNAVAILABLE");
  });

  test("the transcript appears only when the AI service sends one (its testing-only setting)", async () => {
    assert.equal("transcript" in (await extract()).body.data, false);

    ai.closeAllConnections?.();
    await new Promise((resolve) => ai.close(resolve));
    await startAi(answer({ ...DRAFT, transcript: "Parle-G 50 aur aaye" }));
    assert.equal((await extract()).body.data.transcript, "Parle-G 50 aur aaye");
  });
}
