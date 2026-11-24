import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import test, { after, afterEach, beforeEach } from "node:test";
import request from "supertest";

dotenv.config();
// These tests never touch the database; the app only needs a connection string to start.
process.env.DATABASE_URL ??= "postgresql://nobody@localhost:5432/not_used";

const [{ default: app }, { env }, { signAiToken }, { callAi, pingAi }] = await Promise.all([
  import("../../src/app.js"),
  import("../../src/config/env.js"),
  import("../../src/utils/serviceToken.js"),
  import("../../src/services/aiClient.js"),
]);

const SECRET = "test-service-secret-test-service-secret-1";
const BUSINESS_ID = randomUUID();
const now = () => Math.floor(Date.now() / 1000);

// A token as the AI service would make it. Any claim can be changed, or removed with undefined.
function aiToken(overrides = {}, secret = SECRET, algorithm = "HS256") {
  const issuedAt = now();
  const claims = {
    iss: "bizpilot-ai",
    aud: "bizpilot-node",
    business_id: BUSINESS_ID,
    iat: issuedAt,
    exp: issuedAt + 60,
    ...overrides,
  };
  for (const key of Object.keys(claims)) if (claims[key] === undefined) delete claims[key];
  // jsonwebtoken adds an iat by itself unless told not to.
  return jwt.sign(claims, secret, { algorithm, noTimestamp: claims.iat === undefined });
}

const ping = (token) => {
  const req = request(app).get("/internal/ping");
  return token === undefined ? req : req.set("Authorization", `Bearer ${token}`);
};

const originalSecret = env.serviceJwtSecret;
const originalAiUrl = env.aiServiceUrl;

beforeEach(() => {
  env.serviceJwtSecret = SECRET;
});

afterEach(() => {
  env.serviceJwtSecret = originalSecret;
  env.aiServiceUrl = originalAiUrl;
});

after(() => {
  // the app opens no connection in these tests, so there is nothing to close
});

// ---- AI -> Node: /internal routes ---------------------------------------------------------------

test("a valid service token reaches /internal/ping and names the shop", async () => {
  const response = await ping(aiToken());
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    success: true,
    data: { status: "ok", businessId: BUSINESS_ID },
  });
});

test("the shop comes only from the token, never from the query or the body", async () => {
  const other = randomUUID();
  const response = await request(app)
    .get(`/internal/ping?businessId=${other}&business_id=${other}`)
    .set("Authorization", `Bearer ${aiToken()}`)
    .send({ businessId: other });
  assert.equal(response.body.data.businessId, BUSINESS_ID);
});

test("a missing or malformed Authorization header is refused", async () => {
  for (const header of [undefined, "", "Bearer", "Bearer ", "Basic abc", "abc"]) {
    const req = request(app).get("/internal/ping");
    if (header !== undefined) req.set("Authorization", header);
    const response = await req;
    assert.equal(response.status, 401, `header: ${JSON.stringify(header)}`);
    assert.equal(response.body.code, "UNAUTHENTICATED");
    assert.equal(response.body.success, false);
  }
});

test("a wrong service token is refused", async () => {
  const cases = {
    "not a token": "not-a-token",
    "wrong signature": aiToken({}, "a-different-secret-a-different-secret-12"),
    expired: aiToken({ iat: now() - 65, exp: now() - 5 }),
    "wrong audience": aiToken({ aud: "someone-else" }),
    "wrong issuer (Node's own token)": aiToken({ iss: "bizpilot-node" }),
    "no iat": aiToken({ iat: undefined }),
    "no exp": aiToken({ exp: undefined }),
    "no business": aiToken({ business_id: undefined }),
    "business is not a uuid": aiToken({ business_id: "not-a-uuid" }),
    "lives too long": aiToken({ iat: now(), exp: now() + 3600 }),
    "another algorithm": aiToken({}, SECRET, "HS512"),
  };

  for (const [label, token] of Object.entries(cases)) {
    const response = await ping(token);
    assert.equal(response.status, 401, label);
    assert.equal(response.body.code, "UNAUTHENTICATED", label);
  }
});

test("an owner's sign-in token cannot open /internal", async () => {
  env.jwtSecret = "owner-sign-in-secret-owner-sign-in-secret";
  const ownerToken = jwt.sign({ sub: randomUUID() }, env.jwtSecret, { expiresIn: "15m" });
  assert.equal((await ping(ownerToken)).status, 401);
});

test("without SERVICE_JWT_SECRET, /internal answers 503", async () => {
  env.serviceJwtSecret = undefined;
  const response = await ping(aiToken());
  assert.equal(response.status, 503);
  assert.equal(response.body.code, "SERVICE_NOT_CONFIGURED");
});

test("a service token cannot be used on the owner's routes", async () => {
  const originalDevUser = env.devUserId;
  env.devUserId = null; // a local DEV_USER_ID would let any request through
  const response = await request(app)
    .get("/api/v1/settings")
    .set("Authorization", `Bearer ${aiToken()}`);
  env.devUserId = originalDevUser;
  assert.equal(response.status, 401);
});

// ---- Node -> AI: the token Node sends ------------------------------------------------------------

test("a token for the AI service names the shop and lives 60 seconds", () => {
  const claims = jwt.verify(signAiToken(BUSINESS_ID), SECRET, {
    algorithms: ["HS256"],
    issuer: "bizpilot-node",
    audience: "bizpilot-ai",
  });
  assert.equal(claims.business_id, BUSINESS_ID);
  assert.equal(claims.exp - claims.iat, 60);
});

test("signing a token without SERVICE_JWT_SECRET fails with 503", () => {
  env.serviceJwtSecret = undefined;
  assert.throws(() => signAiToken(BUSINESS_ID), (error) => error.statusCode === 503);
});

// ---- Node -> AI: calling the service -------------------------------------------------------------

// A stand-in for the AI service that remembers the last request it was sent.
function fakeAi(handler) {
  const seen = {};
  const server = http.createServer((req, res) => {
    seen.method = req.method;
    seen.url = req.url;
    seen.authorization = req.headers.authorization;
    handler(req, res);
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => {
      env.aiServiceUrl = `http://127.0.0.1:${server.address().port}`;
      resolve({ server, seen });
    })
  );
}

const closeServer = (server) => new Promise((resolve) => server.closeAllConnections?.() ?? resolve()).then(
  () => new Promise((resolve) => server.close(resolve))
);

test("pingAi sends a POST with a service token naming the shop", async () => {
  const { server, seen } = await fakeAi((req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ status: "ok", businessId: BUSINESS_ID }));
  });
  try {
    const answer = await pingAi(BUSINESS_ID);
    assert.deepEqual(answer, { status: "ok", businessId: BUSINESS_ID });
    assert.equal(seen.method, "POST");
    assert.equal(seen.url, "/internal/ping");
    const claims = jwt.verify(seen.authorization.replace("Bearer ", ""), SECRET, {
      algorithms: ["HS256"],
      issuer: "bizpilot-node",
      audience: "bizpilot-ai",
    });
    assert.equal(claims.business_id, BUSINESS_ID);
  } finally {
    await closeServer(server);
  }
});

test("an AI service error, a dead service and a slow one all become 502 AI_UNAVAILABLE", async () => {
  const expectUnavailable = async (promise, label) => {
    await assert.rejects(promise, (error) => {
      assert.equal(error.statusCode, 502, label);
      assert.equal(error.code, "AI_UNAVAILABLE", label);
      return true;
    });
  };

  // answers 500
  let fake = await fakeAi((req, res) => {
    res.statusCode = 500;
    res.end("{}");
  });
  await expectUnavailable(pingAi(BUSINESS_ID), "500");
  await closeServer(fake.server);

  // never answers within the time allowed
  fake = await fakeAi(() => {});
  await expectUnavailable(callAi(BUSINESS_ID, "/internal/ping", { method: "POST", timeoutMs: 150 }), "timeout");
  await closeServer(fake.server);

  // nothing is listening any more
  await expectUnavailable(pingAi(BUSINESS_ID), "down");
});
