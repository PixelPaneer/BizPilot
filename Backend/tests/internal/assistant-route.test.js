import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import test, { after } from "node:test";
import request from "supertest";

process.env.DATABASE_URL ||= "postgres://test:test@127.0.0.1:5432/test";
process.env.SERVICE_JWT_SECRET ||= "assistant-route-test-secret-at-least-32";

const aiRequests = [];
const aiServer = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  aiRequests.push({
    method: req.method,
    path: req.url,
    authorization: req.headers.authorization,
    body: chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null,
  });
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ reply: "Here is an insight.", route: "insights" }));
});

await new Promise((resolve) => aiServer.listen(0, "127.0.0.1", resolve));
process.env.AI_SERVICE_URL = `http://127.0.0.1:${aiServer.address().port}`;

const { default: assistantRoutes } = await import("../../src/routes/assistant.routes.js");
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.businessId = "business-from-auth-context";
  next();
});
app.use("/api/v1/assistant", assistantRoutes);
app.use((error, req, res, next) => {
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    errors: error.errors || [],
    ...(error.code ? { code: error.code } : {}),
  });
});

after(async () => {
  await new Promise((resolve, reject) =>
    aiServer.close((error) => (error ? reject(error) : resolve()))
  );
});

test("assistant message forwards a trimmed owner message to the AI orchestrator", async () => {
  const response = await request(app)
    .post("/api/v1/assistant/message")
    .send({ message: "  How are sales?  ", senderRole: "customer" });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: { reply: "Here is an insight.", route: "insights" },
  });
  assert.deepEqual(aiRequests[0].body, {
    message: "How are sales?",
    senderRole: "owner",
  });
  assert.equal(aiRequests[0].path, "/internal/orchestrate");
  assert.equal(aiRequests[0].method, "POST");
  assert.match(aiRequests[0].authorization, /^Bearer /);
});

test("assistant message rejects empty and oversized messages without calling AI", async () => {
  const requestCount = aiRequests.length;
  const responses = await Promise.all([
    request(app).post("/api/v1/assistant/message").send({ message: "  " }),
    request(app).post("/api/v1/assistant/message").send({ message: "x".repeat(1001) }),
    request(app).post("/api/v1/assistant/message").set("Content-Type", "application/json").send(),
  ]);

  for (const response of responses) {
    assert.equal(response.status, 400);
    assert.deepEqual(response.body.errors, []);
    assert.equal(response.body.code, "VALIDATION_ERROR");
  }
  assert.equal(aiRequests.length, requestCount);
});
