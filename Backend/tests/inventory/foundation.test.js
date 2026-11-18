import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { body } from "express-validator";
import app from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { pool, withTransaction } from "../../src/config/db.js";
import { authenticate } from "../../src/middleware/auth.middleware.js";
import { errorMiddleware } from "../../src/middleware/error.middleware.js";
import { validate } from "../../src/middleware/validate.middleware.js";
import { ApiError } from "../../src/utils/ApiError.js";

function errorTestApp(error) {
  const testApp = express();
  testApp.get("/", (req, res, next) => next(error));
  testApp.use(errorMiddleware);
  return testApp;
}

test("GET /health continues to return success", async () => {
  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
});

test("validate middleware returns the standard validation error", async () => {
  const testApp = express();
  testApp.use(express.json());
  testApp.post(
    "/",
    body("name").isLength({ min: 1 }),
    validate,
    (req, res) => res.json({ success: true })
  );
  testApp.use(errorMiddleware);

  const response = await request(testApp).post("/").send({ name: "" });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, {
    success: false,
    message: "Validation failed",
    errors: [{ field: "name", message: "Invalid value" }],
    code: "VALIDATION_ERROR",
  });
});

test("error middleware includes an error code only when set", async () => {
  const codedResponse = await request(
    errorTestApp(
      new ApiError(401, "Authentication required", [], "UNAUTHENTICATED")
    )
  ).get("/");

  assert.equal(codedResponse.body.code, "UNAUTHENTICATED");

  const uncodedResponse = await request(
    errorTestApp(new ApiError(400, "Bad request"))
  ).get("/");

  assert.equal(Object.hasOwn(uncodedResponse.body, "code"), false);
});

test("authenticate only allows the configured development stub outside production", async () => {
  const originalNodeEnv = env.nodeEnv;
  const originalDevUserId = env.devUserId;
  const testApp = express();
  testApp.get("/", authenticate, (req, res) =>
    res.json({ user: req.user })
  );
  testApp.use(errorMiddleware);

  try {
    env.nodeEnv = "development";
    env.devUserId = "dev-user-id";

    const developmentResponse = await request(testApp).get("/");
    assert.deepEqual(developmentResponse.body, {
      user: { user_id: "dev-user-id" },
    });

    env.nodeEnv = "production";

    const productionResponse = await request(testApp).get("/");
    assert.equal(productionResponse.status, 401);
    assert.equal(productionResponse.body.code, "UNAUTHENTICATED");
  } finally {
    env.nodeEnv = originalNodeEnv;
    env.devUserId = originalDevUserId;
  }
});

test("withTransaction commits on success and rolls back/releases on failure", async () => {
  const originalConnect = pool.connect;
  const calls = [];
  const client = {
    async query(statement) {
      calls.push(statement);
    },
    release() {
      calls.push("RELEASE");
    },
  };
  pool.connect = async () => client;

  try {
    const value = await withTransaction(async (transactionClient) => {
      assert.equal(transactionClient, client);
      return "committed";
    });
    assert.equal(value, "committed");
    assert.deepEqual(calls, ["BEGIN", "COMMIT", "RELEASE"]);

    calls.length = 0;
    const failure = new Error("transaction failed");
    await assert.rejects(
      withTransaction(async () => {
        throw failure;
      }),
      (error) => error === failure
    );
    assert.deepEqual(calls, ["BEGIN", "ROLLBACK", "RELEASE"]);
  } finally {
    pool.connect = originalConnect;
  }
});
