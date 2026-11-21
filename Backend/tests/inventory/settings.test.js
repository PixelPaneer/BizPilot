import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  test("settings integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not point to DATABASE_URL.");
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const [{ default: app }, { env }, { pool, withTransaction }, { applyStockChange }] =
    await Promise.all([
      import("../../src/app.js"),
      import("../../src/config/env.js"),
      import("../../src/config/db.js"),
      import("../../src/services/stock.service.js"),
    ]);

  let fixture;

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE TABLE inventory_alerts, stock_movements, audit_logs, sale_items, sales,
         purchase_batches, inventory, products, business_settings, businesses, app_users
       CASCADE`
    );
    const { rows: users } = await pool.query(
      `INSERT INTO app_users
         (first_name, last_name, email, password_hash, whatsapp_number)
       VALUES ('Priya', 'Sharma', 'priya-set@bizpilot.local', 'test-hash', '9000000031'),
              ('Other', 'Tenant', 'other-set@bizpilot.local', 'test-hash', '9000000032')
       RETURNING user_id`
    );
    const { rows: businesses } = await pool.query(
      `INSERT INTO businesses
         (owner_user_id, business_name, business_type, owner_name,
          contact_number, business_email, business_address)
       VALUES ($1, 'Priya Kirana Store', 'Retail', 'Priya Sharma',
               '9000000031', 'priya-set@bizpilot.local', 'Test address'),
              ($2, 'Other Settings Business', 'Retail', 'Other Tenant',
               '9000000032', 'other-set@bizpilot.local', 'Test address')
       RETURNING business_id`,
      users.map((row) => row.user_id)
    );
    env.nodeEnv = "test";
    env.devUserId = users[0].user_id;
    fixture = {
      businessId: businesses[0].business_id,
      otherBusinessId: businesses[1].business_id,
    };
  });

  after(async () => {
    await pool.end();
  });

  test("GET /settings returns this business's settings", async () => {
    const response = await request(app).get("/api/v1/settings");
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.data.business_id, fixture.businessId);
    assert.equal(typeof response.body.data.stock_alerts_enabled, "boolean");
  });

  test("PATCH /settings changes only the fields sent", async () => {
    const before = (await request(app).get("/api/v1/settings")).body.data;

    const response = await request(app)
      .patch("/api/v1/settings")
      .send({ appearance_theme: "dark", report_frequency: "Weekly" });

    assert.equal(response.status, 200);
    assert.equal(response.body.data.appearance_theme, "dark");
    assert.equal(response.body.data.report_frequency, "Weekly");
    assert.equal(response.body.data.dashboard_language, before.dashboard_language);

    const after = (await request(app).get("/api/v1/settings")).body.data;
    assert.equal(after.appearance_theme, "dark");
  });

  test("PATCH /settings never touches another business", async () => {
    await request(app).patch("/api/v1/settings").send({ appearance_theme: "dark" });

    const { rows } = await pool.query(
      "SELECT appearance_theme FROM business_settings WHERE business_id = $1",
      [fixture.otherBusinessId]
    );
    assert.notEqual(rows[0].appearance_theme, "dark");
  });

  test("PATCH /settings rejects bad input with a 400", async () => {
    const cases = [
      {},
      { unknown_field: true },
      { stock_alerts_enabled: "yes" },
      { appearance_theme: "blue" },
      { dashboard_language: "French" },
      { report_frequency: "Hourly" },
      { date_format: "" },
    ];

    for (const body of cases) {
      const response = await request(app).patch("/api/v1/settings").send(body);
      assert.equal(response.status, 400, JSON.stringify(body));
      assert.equal(response.body.success, false);
    }
  });

  // Drops a product's stock below its threshold and reports how many alerts that created.
  async function alertsAfterLowStock() {
    const productId = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products (business_id, product_name, category, unit, selling_price)
         VALUES ($1, 'Parle-G', 'Snacks', 'piece', 10) RETURNING product_id`,
        [fixture.businessId]
      );
      await client.query(
        `INSERT INTO inventory (business_id, product_id, reorder_threshold) VALUES ($1, $2, 5)`,
        [fixture.businessId, rows[0].product_id]
      );
      const change = (delta) =>
        applyStockChange(client, {
          businessId: fixture.businessId,
          productId: rows[0].product_id,
          delta,
          movementType: "MANUAL_ADJUSTMENT",
          source: "SYSTEM",
          skipAudit: true,
        });
      await change(10);
      await change(-7); // 3 left, below the threshold of 5
      return rows[0].product_id;
    });
    const { rows } = await pool.query(
      "SELECT count(*)::int AS n FROM inventory_alerts WHERE product_id = $1",
      [productId]
    );
    return rows[0].n;
  }

  test("a stock-alert setting changed through the API is obeyed by the alert rules", async () => {
    await request(app).patch("/api/v1/settings").send({ stock_alerts_enabled: false });
    assert.equal(await alertsAfterLowStock(), 0);
  });

  test("with stock alerts left on, low stock creates an alert", async () => {
    await request(app).patch("/api/v1/settings").send({ stock_alerts_enabled: true });
    assert.equal(await alertsAfterLowStock(), 1);
  });

  const validProfile = {
    business_name: "Priya General Store",
    business_type: "Retail",
    owner_name: "Priya Sharma",
    contact_number: "9876543210",
    business_email: "store@example.com",
    business_address: "12 MG Road, Pune",
    business_description: "Daily needs",
    gstin: "27ABCDE1234F1Z5",
  };

  test("GET and PUT /settings/profile read and update this business only", async () => {
    const read = await request(app).get("/api/v1/settings/profile");
    assert.equal(read.status, 200);
    assert.equal(read.body.data.business_name, "Priya Kirana Store");

    const update = await request(app).put("/api/v1/settings/profile").send(validProfile);
    assert.equal(update.status, 200);
    assert.equal(update.body.data.business_name, "Priya General Store");
    assert.equal(update.body.data.gstin, "27ABCDE1234F1Z5");

    const { rows } = await pool.query(
      "SELECT business_name FROM businesses WHERE business_id = $1",
      [fixture.otherBusinessId]
    );
    assert.equal(rows[0].business_name, "Other Settings Business");
  });

  test("PUT /settings/profile rejects incomplete or malformed details", async () => {
    const cases = [
      { ...validProfile, business_name: "" },
      { ...validProfile, business_email: "not-an-email" },
      { ...validProfile, gstin: "SHORT" },
      { ...validProfile, contact_number: "123" },
      { ...validProfile, business_address: undefined },
    ];
    for (const body of cases) {
      const response = await request(app).put("/api/v1/settings/profile").send(body);
      assert.equal(response.status, 400, JSON.stringify(body));
    }
  });

  test("GET /settings/account returns the account without any password data", async () => {
    const response = await request(app).get("/api/v1/settings/account");
    assert.equal(response.status, 200);
    assert.equal(response.body.data.email, "priya-set@bizpilot.local");
    assert.equal(Object.hasOwn(response.body.data, "password_hash"), false);
  });

  test("PUT /settings/account updates details and re-verifies a changed WhatsApp number", async () => {
    await pool.query("UPDATE app_users SET whatsapp_verified_at = now() WHERE user_id = $1", [
      env.devUserId,
    ]);

    const sameNumber = await request(app).put("/api/v1/settings/account").send({
      first_name: "Priya",
      last_name: "Verma",
      email: "Priya-New@Example.com",
      whatsapp_number: "9000000031",
    });
    assert.equal(sameNumber.status, 200);
    assert.equal(sameNumber.body.data.last_name, "Verma");
    assert.equal(sameNumber.body.data.email, "priya-new@example.com", "stored in lower case");
    let { rows } = await pool.query(
      "SELECT whatsapp_verified_at FROM app_users WHERE user_id = $1",
      [env.devUserId]
    );
    assert.ok(rows[0].whatsapp_verified_at, "an unchanged number stays verified");

    await request(app).put("/api/v1/settings/account").send({
      first_name: "Priya",
      last_name: "Verma",
      email: "priya-new@example.com",
      whatsapp_number: "9111111111",
    });
    ({ rows } = await pool.query(
      "SELECT whatsapp_verified_at FROM app_users WHERE user_id = $1",
      [env.devUserId]
    ));
    assert.equal(rows[0].whatsapp_verified_at, null, "a new number must be verified again");
  });

  test("PUT /settings/account answers 409 for an email another account uses", async () => {
    const response = await request(app).put("/api/v1/settings/account").send({
      first_name: "Priya",
      last_name: "Sharma",
      email: "OTHER-SET@bizpilot.local",
      whatsapp_number: "9000000031",
    });
    assert.equal(response.status, 409);
  });

  test("PUT /settings/account rejects bad input", async () => {
    const good = {
      first_name: "Priya",
      last_name: "Sharma",
      email: "p@example.com",
      whatsapp_number: "9000000031",
    };
    const cases = [
      { ...good, first_name: " " },
      { ...good, email: "nope" },
      { ...good, whatsapp_number: "12ab" },
      { ...good, last_name: "x".repeat(61) },
      { ...good, email: undefined },
    ];
    for (const body of cases) {
      const response = await request(app).put("/api/v1/settings/account").send(body);
      assert.equal(response.status, 400, JSON.stringify(body));
    }
  });

  test("PUT /settings/account/password needs the right current password", async () => {
    await pool.query("UPDATE app_users SET password_hash = $1 WHERE user_id = $2", [
      await bcrypt.hash("old-password-1", 4),
      env.devUserId,
    ]);

    const wrong = await request(app)
      .put("/api/v1/settings/account/password")
      .send({ currentPassword: "not-it", newPassword: "brand-new-pass" });
    assert.equal(wrong.status, 400);

    const ok = await request(app)
      .put("/api/v1/settings/account/password")
      .send({ currentPassword: "old-password-1", newPassword: "brand-new-pass" });
    assert.equal(ok.status, 200);

    const { rows } = await pool.query("SELECT password_hash FROM app_users WHERE user_id = $1", [
      env.devUserId,
    ]);
    assert.equal(await bcrypt.compare("brand-new-pass", rows[0].password_hash), true);
    assert.equal(await bcrypt.compare("old-password-1", rows[0].password_hash), false);
    assert.equal(JSON.stringify(ok.body).includes("brand-new-pass"), false);
  });

  test("PUT /settings/account/password rejects weak or unchanged passwords", async () => {
    const cases = [
      { currentPassword: "old-password-1", newPassword: "short" },
      { currentPassword: "old-password-1", newPassword: "old-password-1" },
      { currentPassword: "old-password-1", newPassword: "x".repeat(73) },
      { newPassword: "brand-new-pass" },
      { currentPassword: "old-password-1" },
    ];
    for (const body of cases) {
      const response = await request(app).put("/api/v1/settings/account/password").send(body);
      assert.equal(response.status, 400, JSON.stringify(Object.keys(body)));
    }
  });

  test("POST /settings/profile/logo refuses a missing, wrong-type or oversized file", async () => {
    const none = await request(app).post("/api/v1/settings/profile/logo");
    assert.equal(none.status, 400);

    const wrongType = await request(app)
      .post("/api/v1/settings/profile/logo")
      .attach("logo", Buffer.from("not an image"), { filename: "a.txt", contentType: "text/plain" });
    assert.equal(wrongType.status, 400);

    const tooBig = await request(app)
      .post("/api/v1/settings/profile/logo")
      .attach("logo", Buffer.alloc(2 * 1024 * 1024 + 10), {
        filename: "big.png",
        contentType: "image/png",
      });
    assert.equal(tooBig.status, 400);
    assert.match(tooBig.body.message, /2 MB/);
  });

  test(
    "POST /settings/profile/logo says so plainly when Cloudinary is not configured",
    { skip: Boolean(process.env.CLOUDINARY_CLOUD_NAME) },
    async () => {
      const response = await request(app)
        .post("/api/v1/settings/profile/logo")
        .attach("logo", Buffer.from("png-bytes"), { filename: "logo.png", contentType: "image/png" });
      assert.equal(response.status, 503);
      assert.equal(response.body.code, "UPLOAD_NOT_CONFIGURED");
    }
  );
}
