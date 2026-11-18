import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  test("dashboard integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
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

  async function createFixture() {
    const { rows: users } = await pool.query(
      `INSERT INTO app_users
         (first_name, last_name, email, password_hash, whatsapp_number)
       VALUES ('Priya', 'Sharma', 'priya@bizpilot.local', 'test-hash', '9000000021'),
              ('Other', 'Tenant', 'other-dash@bizpilot.local', 'test-hash', '9000000022')
       RETURNING user_id`
    );
    const userIds = users.map((row) => row.user_id);
    const { rows: businesses } = await pool.query(
      `INSERT INTO businesses
         (owner_user_id, business_name, business_type, owner_name,
          contact_number, business_email, business_address)
       VALUES ($1, 'Priya Kirana Store', 'Retail', 'Priya Sharma',
               '9000000021', 'priya@bizpilot.local', 'Test address'),
              ($2, 'Other Dash Business', 'Retail', 'Other Tenant',
               '9000000022', 'other-dash@bizpilot.local', 'Test address')
       RETURNING business_id`,
      userIds
    );
    env.nodeEnv = "test";
    env.devUserId = userIds[0];
    return {
      userId: userIds[0],
      otherUserId: userIds[1],
      businessId: businesses[0].business_id,
      otherBusinessId: businesses[1].business_id,
    };
  }

  async function addProduct({
    businessId = fixture.businessId,
    name,
    price = 10,
    quantity = 0,
    threshold = 5,
  }) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products
           (business_id, product_name, category, unit, selling_price)
         VALUES ($1, $2, 'Snacks', 'piece', $3)
         RETURNING product_id`,
        [businessId, name, price]
      );
      const productId = rows[0].product_id;
      await client.query(
        `INSERT INTO inventory (business_id, product_id, reorder_threshold)
         VALUES ($1, $2, $3)`,
        [businessId, productId, threshold]
      );
      if (quantity > 0) {
        await applyStockChange(client, {
          businessId,
          productId,
          delta: quantity,
          movementType: "MANUAL_ADJUSTMENT",
          source: "SYSTEM",
          skipAudit: true,
        });
      }
      return productId;
    });
  }

  // Inserts a sale directly so its date can be placed exactly where a test needs it.
  // `when` is a SQL timestamptz expression.
  async function insertSale({ businessId = fixture.businessId, total, when = "now()", voided = false }) {
    await pool.query(
      `INSERT INTO sales
         (business_id, sale_number, sale_date, source, subtotal, total_amount, status,
          voided_at, void_reason)
       VALUES ($1, $2, ${when}, 'MANUAL', $3, $3, $4, ${voided ? "now()" : "NULL"},
               ${voided ? "'test'" : "NULL"})`,
      [businessId, `T-${randomUUID().slice(0, 8)}`, total, voided ? "VOIDED" : "COMPLETED"]
    );
  }

  // The first moment of the previous week / month / year, in India time.
  const previousPeriodStart = (unit) =>
    `((date_trunc('${unit}', now() AT TIME ZONE 'Asia/Kolkata') - interval '1 ${unit}') AT TIME ZONE 'Asia/Kolkata')`;

  const summary = (period) =>
    request(app).get("/api/v1/dashboard/summary").query(period ? { period } : {});

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE TABLE inventory_alerts, stock_movements, audit_logs, sale_items, sales,
         purchase_batches, inventory, products, business_settings, businesses, app_users
       CASCADE`
    );
    fixture = await createFixture();
  });

  after(async () => {
    await pool.end();
  });

  test("summary counts the current stock and defaults to this month", async () => {
    await addProduct({ name: "In stock A", quantity: 50 });
    await addProduct({ name: "In stock B", quantity: 20 });
    await addProduct({ name: "Low", quantity: 3, threshold: 5 });
    await addProduct({ name: "Out", quantity: 0 });
    await addProduct({ businessId: fixture.otherBusinessId, name: "Other shop", quantity: 9 });

    const response = await summary();
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, {
      totalProducts: 4,
      inStockProducts: 2,
      lowStockProducts: 1,
      outOfStockProducts: 1,
      totalRevenue: 0,
      previousRevenue: 0,
      revenueChangePercent: null,
      period: "this_month",
    });
  });

  test("revenue compares this period so far with the same stretch of the previous one", async () => {
    for (const [period, unit] of [
      ["this_week", "week"],
      ["this_month", "month"],
      ["this_year", "year"],
    ]) {
      await pool.query(`TRUNCATE TABLE sales CASCADE`);
      await insertSale({ total: 100 });
      await insertSale({ total: 50.5 });
      await insertSale({ total: 60, when: previousPeriodStart(unit) });
      // None of these may count:
      await insertSale({ total: 999, voided: true });
      await insertSale({ total: 777, when: `now() - interval '5 years'` });
      await insertSale({ businessId: fixture.otherBusinessId, total: 555 });

      const response = await summary(period);
      assert.equal(response.status, 200, period);
      assert.equal(response.body.data.period, period);
      assert.equal(response.body.data.totalRevenue, 150.5, `${period}: current`);
      assert.equal(response.body.data.previousRevenue, 60, `${period}: previous`);
      assert.equal(response.body.data.revenueChangePercent, 151, `${period}: change`);
    }
  });

  test("a drop in revenue is a negative percentage, and no previous sales gives null", async () => {
    await insertSale({ total: 40 });
    await insertSale({ total: 100, when: previousPeriodStart("month") });
    assert.equal((await summary("this_month")).body.data.revenueChangePercent, -60);

    await pool.query(`TRUNCATE TABLE sales CASCADE`);
    await insertSale({ total: 40 });
    const noPrevious = (await summary("this_month")).body.data;
    assert.equal(noPrevious.previousRevenue, 0);
    assert.equal(noPrevious.revenueChangePercent, null);
  });

  test("a voided sale stops counting towards revenue", async () => {
    const productId = await addProduct({ name: "Parle-G", quantity: 20 });
    const sale = await request(app)
      .post("/api/v1/sales")
      .send({
        idempotencyKey: randomUUID(),
        lines: [{ productId, quantity: 4, unitPrice: 10 }],
      });
    assert.equal((await summary()).body.data.totalRevenue, 40);

    await request(app)
      .post(`/api/v1/sales/${sale.body.data.saleId}/void`)
      .send({ reason: "Entered by mistake" });
    assert.equal((await summary()).body.data.totalRevenue, 0);
  });

  test("the period must be one of the supported values", async () => {
    for (const bad of ["today", "month", "THIS_MONTH", "all"]) {
      const response = await summary(bad);
      assert.equal(response.status, 400, bad);
      assert.equal(response.body.code, "VALIDATION_ERROR");
    }
  });

  test("recent activity lists the latest changes, newest first, in plain words", async () => {
    const created = await request(app)
      .post("/api/v1/products")
      .send({
        name: "Amul Milk 1L",
        category: "Dairy",
        unit: "piece",
        price: 65,
        quantity: 10,
        lowStockThreshold: 5,
      });
    assert.equal(created.status, 201);
    const productId = created.body.data.id;
    await request(app).patch(`/api/v1/inventory/${productId}`).send({ type: "add", amount: 5 });
    await request(app).patch(`/api/v1/inventory/${productId}`).send({ type: "remove", amount: 2 });
    const sale = await request(app)
      .post("/api/v1/sales")
      .send({
        idempotencyKey: randomUUID(),
        lines: [{ productId, quantity: 3, unitPrice: 65 }],
      });
    await request(app)
      .post("/api/v1/purchases")
      .send({
        idempotencyKey: randomUUID(),
        lines: [{ productId, quantity: 20, unitPrice: 50 }],
      });
    await request(app)
      .post(`/api/v1/sales/${sale.body.data.saleId}/void`)
      .send({ reason: "Customer returned it" });

    const response = await request(app).get("/api/v1/dashboard/activity").query({ limit: 20 });
    assert.equal(response.status, 200);
    const items = response.body.data.items;
    assert.deepEqual(
      items.map((item) => [item.type, item.title]),
      [
        ["sale_voided", "Sale voided"],
        ["bill_generated", "Purchase recorded"],
        ["bill_generated", "Sale recorded"],
        ["stock_removed", "Stock updated"],
        ["stock_added", "Stock updated"],
        ["product_added", "Product added"],
      ]
    );
    assert.match(items[0].detail, /^SL-\d{8}-0001 voided {2}• {2}Customer returned it$/);
    assert.equal(items[1].detail, "Purchase  •  1 item  •  ₹1000");
    assert.match(items[2].detail, /^SL-\d{8}-0001 {2}• {2}1 item {2}• {2}₹195$/);
    assert.equal(items[3].detail, "Amul Milk 1L  •  -2 units (New stock: 13)");
    assert.equal(items[4].detail, "Amul Milk 1L  •  +5 units (New stock: 15)");
    assert.equal(items[5].detail, "Amul Milk 1L  •  ₹65");
    assert.ok(items.every((item) => item.id && item.createdAt));

    // The default shows the 5 newest, and a limit is honoured
    const defaultList = await request(app).get("/api/v1/dashboard/activity");
    assert.equal(defaultList.body.data.items.length, 5);
    assert.equal(defaultList.body.data.items[0].type, "sale_voided");
    const two = await request(app).get("/api/v1/dashboard/activity").query({ limit: 2 });
    assert.equal(two.body.data.items.length, 2);

    // Deleting a product is not shown as activity
    await request(app).delete(`/api/v1/products/${productId}`);
    const afterDelete = await request(app).get("/api/v1/dashboard/activity").query({ limit: 20 });
    assert.equal(afterDelete.body.data.items.length, 6);
  });

  test("activity limit is validated and activity is private to each business", async () => {
    for (const bad of ["0", "21", "abc", "-1"]) {
      const response = await request(app).get("/api/v1/dashboard/activity").query({ limit: bad });
      assert.equal(response.status, 400, bad);
    }

    await request(app)
      .post("/api/v1/products")
      .send({
        name: "Private Item",
        category: "Dairy",
        unit: "piece",
        price: 10,
        quantity: 1,
        lowStockThreshold: 1,
      });
    env.devUserId = fixture.otherUserId;
    const other = await request(app).get("/api/v1/dashboard/activity");
    assert.equal(other.status, 200);
    assert.deepEqual(other.body.data.items, []);
    env.devUserId = fixture.userId;
  });

  test("the profile is the signed-in owner and their shop", async () => {
    const mine = await request(app).get("/api/v1/profile");
    assert.equal(mine.status, 200);
    assert.deepEqual(mine.body.data, {
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya@bizpilot.local",
      businessName: "Priya Kirana Store",
    });

    env.devUserId = fixture.otherUserId;
    const other = await request(app).get("/api/v1/profile");
    assert.equal(other.body.data.firstName, "Other");
    assert.equal(other.body.data.businessName, "Other Dash Business");
    env.devUserId = fixture.userId;
  });
}
