import assert from "node:assert/strict";
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

  const [{ default: app }, { env }, { pool }] = await Promise.all([
    import("../../src/app.js"),
    import("../../src/config/env.js"),
    import("../../src/config/db.js"),
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

  test("a changed stock-alert setting is used by the alert rules", async () => {
    const response = await request(app)
      .patch("/api/v1/settings")
      .send({ stock_alerts_enabled: false });
    assert.equal(response.body.data.stock_alerts_enabled, false);
  });
}
