import assert from "node:assert/strict";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  test("auth integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not point to DATABASE_URL.");
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  // The tests sign up and in far more often than a person would.
  process.env.AUTH_RATE_LIMIT = "1000";

  const [{ default: app }, { env }, { pool }] = await Promise.all([
    import("../../src/app.js"),
    import("../../src/config/env.js"),
    import("../../src/config/db.js"),
  ]);

  const account = {
    firstName: "Asha",
    lastName: "Verma",
    email: "Asha.Verma@Example.com",
    whatsappNumber: "+919876543210",
    password: "correct-horse-battery",
    business: { name: "Asha General Store", type: "Retail", address: "12 MG Road, Pune" },
  };

  const register = (body = account) => request(app).post("/api/v1/auth/register").send(body);
  const login = (email = account.email, password = account.password) =>
    request(app).post("/api/v1/auth/login").send({ email, password });

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE TABLE inventory_alerts, stock_movements, audit_logs, sale_items, sales,
         purchase_batches, inventory, products, business_settings, businesses, app_users
       CASCADE`
    );
    // These tests use real sign-in: no development shortcut, and a signing key.
    env.nodeEnv = "test";
    env.devUserId = null;
    env.jwtSecret = "test-secret-test-secret-test-secret-1234";
    env.refreshReuseGraceSeconds = 10;
    env.jwtExpiresIn = "15m"; // not whatever a local .env sets
  });

  after(async () => {
    await pool.end();
  });

  test("register creates the account, stores only a hash, and returns no token", async () => {
    const response = await register();
    assert.equal(response.status, 201);
    assert.equal(response.body.data.user.email, "asha.verma@example.com", "stored in lower case");
    assert.equal(response.body.data.accessToken, undefined);
    assert.equal(Object.hasOwn(response.body.data.user, "password_hash"), false);

    const { rows } = await pool.query("SELECT password_hash FROM app_users");
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].password_hash, account.password);
    assert.match(rows[0].password_hash, /^\$2[aby]\$/);
  });

  test("register creates the business together with the owner, with default settings", async () => {
    const response = await register();
    const { user, business } = response.body.data;
    assert.equal(business.business_name, "Asha General Store");
    assert.equal(business.business_type, "Retail");
    assert.equal(business.owner_name, "Asha Verma");
    assert.equal(business.contact_number, "+919876543210");
    assert.equal(business.business_email, "asha.verma@example.com");

    const owned = await pool.query("SELECT business_id FROM businesses WHERE owner_user_id = $1", [
      user.user_id,
    ]);
    assert.equal(owned.rows.length, 1);
    const settings = await pool.query("SELECT 1 FROM business_settings WHERE business_id = $1", [
      business.business_id,
    ]);
    assert.equal(settings.rows.length, 1, "the default settings row exists");
  });

  test("a failed sign-up leaves nothing behind (no user without a business)", async () => {
    // A business type longer than its column makes the business insert fail after the user was
    // inserted; the service is called directly because the route would reject it first.
    const { registerOwner } = await import("../../src/services/auth.service.js");
    await assert.rejects(
      registerOwner({ ...account, business: { ...account.business, type: "x".repeat(101) } })
    );
    assert.equal((await pool.query("SELECT 1 FROM app_users")).rows.length, 0);
    assert.equal((await pool.query("SELECT 1 FROM businesses")).rows.length, 0);
  });

  test("right after signing up and in, the owner can use their business", async () => {
    await register();
    const { body } = await login();
    const token = body.data.accessToken;

    const settings = await request(app).get("/api/v1/settings").set("Authorization", `Bearer ${token}`);
    assert.equal(settings.status, 200);
    const profile = await request(app).get("/api/v1/profile").set("Authorization", `Bearer ${token}`);
    assert.equal(profile.status, 200);
    assert.equal(profile.body.data.businessName, "Asha General Store");
  });

  test("register refuses a duplicate email (any letter case) with 409", async () => {
    await register();
    const again = await register({ ...account, email: "ASHA.VERMA@example.com" });
    assert.equal(again.status, 409);
  });

  test("register rejects bad input with a 400 that names the fields", async () => {
    const cases = [
      { ...account, firstName: "" },
      { ...account, email: "not-an-email" },
      { ...account, whatsappNumber: "123" },
      { ...account, password: "short" },
      { ...account, password: "x".repeat(73) },
      { ...account, business: undefined },
      { ...account, business: { ...account.business, name: " " } },
      { ...account, business: { ...account.business, type: "Spaceship" } },
      { ...account, business: { ...account.business, address: "" } },
    ];
    for (const body of cases) {
      const response = await register(body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(response.body.success, false);
      assert.ok(response.body.errors.length > 0);
    }
  });

  test("login returns a token, and the same answer for a wrong password or an unknown email", async () => {
    await register();

    const ok = await login();
    assert.equal(ok.status, 200);
    assert.equal(typeof ok.body.data.accessToken, "string");

    const wrongPassword = await login(account.email, "not-the-password");
    const unknownEmail = await login("nobody@example.com", account.password);
    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);
  });

  test("an inactive account cannot sign in", async () => {
    await register();
    await pool.query("UPDATE app_users SET is_active = FALSE");
    assert.equal((await login()).status, 403);
  });

  test("GET /auth/me needs a valid token", async () => {
    await register();
    const { body } = await login();

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${body.data.accessToken}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.data.user.email, "asha.verma@example.com");

    assert.equal((await request(app).get("/api/v1/auth/me")).status, 401);
    assert.equal(
      (await request(app).get("/api/v1/auth/me").set("Authorization", "Bearer garbage")).status,
      401
    );
  });

  test("owner routes need the token, and a token from another signing key is refused", async () => {
    await register();
    const { body } = await login();
    const token = body.data.accessToken;

    assert.equal((await request(app).get("/api/v1/settings")).status, 401);

    const authed = await request(app).get("/api/v1/settings").set("Authorization", `Bearer ${token}`);
    assert.equal(authed.status, 200);

    env.jwtSecret = "a-different-secret-a-different-secret-12";
    const forged = await request(app).get("/api/v1/settings").set("Authorization", `Bearer ${token}`);
    assert.equal(forged.status, 401);
  });

  // ---- refresh tokens -------------------------------------------------------------------------

  const refreshCookieOf = (response) =>
    (response.headers["set-cookie"] ?? []).find((cookie) => cookie.startsWith("bizpilot_refresh="));
  const cookiePair = (setCookie) => setCookie.split(";")[0];
  const refresh = (cookie, origin) => {
    const req = request(app).post("/api/v1/auth/refresh");
    if (cookie) req.set("Cookie", cookie);
    if (origin) req.set("Origin", origin);
    return req;
  };

  async function signedIn() {
    await register();
    const response = await login();
    return { response, cookie: cookiePair(refreshCookieOf(response)) };
  }

  test("login gives a short-lived access token and an httpOnly refresh cookie", async () => {
    const { response, cookie } = await signedIn();

    const setCookie = refreshCookieOf(response);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /Path=\/api\/v1\/auth/);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.equal(response.body.data.refreshToken, undefined, "the refresh token is not in the body");

    const claims = jwt.decode(response.body.data.accessToken);
    assert.equal(claims.exp - claims.iat, 15 * 60, "the access token lasts 15 minutes");

    // Only a hash is stored, never the token.
    const { rows } = await pool.query("SELECT token_hash FROM refresh_tokens");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].token_hash.length, 64);
    assert.equal(cookie.includes(rows[0].token_hash), false);
  });

  test("refresh gives a new working access token and rotates the cookie", async () => {
    const { cookie } = await signedIn();

    const response = await refresh(cookie);
    assert.equal(response.status, 200);
    const next = cookiePair(refreshCookieOf(response));
    assert.notEqual(next, cookie, "a new refresh token is issued each time");

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${response.body.data.accessToken}`);
    assert.equal(me.status, 200);

    // and the new cookie can be used in turn
    assert.equal((await refresh(next)).status, 200);
  });

  test("a refresh token that was already used, shown again later, ends the whole sign-in", async () => {
    env.refreshReuseGraceSeconds = 0;
    const { cookie } = await signedIn();

    const first = await refresh(cookie);
    const newer = cookiePair(refreshCookieOf(first));

    const replay = await refresh(cookie); // the old token comes back: it was copied
    assert.equal(replay.status, 401);
    assert.equal(replay.body.code, "INVALID_REFRESH_TOKEN");

    assert.equal((await refresh(newer)).status, 401, "the newer token was revoked with the family");
  });

  test("two tabs refreshing at the same moment do not sign each other out", async () => {
    const { cookie } = await signedIn();
    assert.equal((await refresh(cookie)).status, 200);
    assert.equal((await refresh(cookie)).status, 200, "the second tab uses the same token inside the grace window");
  });

  test("refresh without a cookie, or with a made-up one, answers 401 and clears the cookie", async () => {
    const none = await refresh();
    assert.equal(none.status, 401);

    const fake = await refresh("bizpilot_refresh=made-up-token");
    assert.equal(fake.status, 401);
    assert.match(refreshCookieOf(fake) ?? "", /bizpilot_refresh=;/);
  });

  test("an expired refresh token is refused", async () => {
    const { cookie } = await signedIn();
    await pool.query("UPDATE refresh_tokens SET expires_at = now() - interval '1 minute'");
    assert.equal((await refresh(cookie)).status, 401);
  });

  test("a switched-off account cannot refresh, and its sign-in is revoked", async () => {
    const { cookie } = await signedIn();
    await pool.query("UPDATE app_users SET is_active = FALSE");
    assert.equal((await refresh(cookie)).status, 401);

    await pool.query("UPDATE app_users SET is_active = TRUE");
    assert.equal((await refresh(cookie)).status, 401, "stays revoked even if the account returns");
  });

  test("logout revokes the refresh token and clears the cookie", async () => {
    const { cookie } = await signedIn();

    const response = await request(app).post("/api/v1/auth/logout").set("Cookie", cookie);
    assert.equal(response.status, 200);
    assert.match(refreshCookieOf(response) ?? "", /bizpilot_refresh=;/);

    assert.equal((await refresh(cookie)).status, 401);
    assert.equal((await request(app).post("/api/v1/auth/logout")).status, 200, "harmless without a cookie");
  });

  test("refresh and logout refuse a request that comes from another site", async () => {
    const { cookie } = await signedIn();

    const foreign = await refresh(cookie, "https://evil.example");
    assert.equal(foreign.status, 403);
    assert.equal(foreign.body.code, "ORIGIN_NOT_ALLOWED");
    assert.equal(
      (await request(app).post("/api/v1/auth/logout").set("Cookie", cookie).set("Origin", "https://evil.example")).status,
      403
    );

    assert.equal((await refresh(cookie, env.frontendOrigin.split(",")[0].trim())).status, 200);
  });

  test("without JWT_SECRET, sign-in answers 503 instead of failing oddly", async () => {
    await register();
    env.jwtSecret = undefined;
    const response = await login();
    assert.equal(response.status, 503);
    assert.equal(response.body.code, "AUTH_NOT_CONFIGURED");
  });
}
