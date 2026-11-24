import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  test("stock insights integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not point to DATABASE_URL.");
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const [{ default: app }, { env }, { pool, withTransaction }, { applyStockChange }, inventory] =
    await Promise.all([
      import("../../src/app.js"),
      import("../../src/config/env.js"),
      import("../../src/config/db.js"),
      import("../../src/services/stock.service.js"),
      import("../../src/services/inventory.service.js"),
    ]);

  let fixture;

  async function createFixture() {
    const { rows: users } = await pool.query(
      `INSERT INTO app_users
         (first_name, last_name, email, password_hash, whatsapp_number)
       VALUES ('Insight', 'Tester', 'insight-test@bizpilot.local', 'test-hash', '9000000041'),
              ('Other', 'Tenant', 'other-insight@bizpilot.local', 'test-hash', '9000000042')
       RETURNING user_id`
    );
    const userIds = users.map((row) => row.user_id);
    const { rows: businesses } = await pool.query(
      `INSERT INTO businesses
         (owner_user_id, business_name, business_type, owner_name,
          contact_number, business_email, business_address)
       VALUES ($1, 'Insight Test Business', 'Retail', 'Insight Tester',
               '9000000041', 'insight-test@bizpilot.local', 'Test address'),
              ($2, 'Other Insight Business', 'Retail', 'Other Tenant',
               '9000000042', 'other-insight@bizpilot.local', 'Test address')
       RETURNING business_id`,
      userIds
    );
    env.nodeEnv = "test";
    env.devUserId = userIds[0];
    return {
      businessId: businesses[0].business_id,
      otherBusinessId: businesses[1].business_id,
    };
  }

  // `ageDays` backdates the product, because a product must have been in the shop for a week
  // before it can count as a slow mover.
  async function addProduct({
    businessId = fixture.businessId,
    name,
    price = 10,
    quantity = 0,
    threshold = 5,
    ageDays = 30,
  }) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products
           (business_id, product_name, category, unit, selling_price, created_at)
         VALUES ($1, $2, 'Snacks', 'piece', $3, now() - make_interval(days => $4::integer))
         RETURNING product_id`,
        [businessId, name, price, ageDays]
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

  const sell = (productId, quantity, unitPrice) =>
    request(app)
      .post("/api/v1/sales")
      .send({ idempotencyKey: randomUUID(), lines: [{ productId, quantity, unitPrice }] });

  const names = (response, key = "products") =>
    response.body.data[key].map((item) => item.productName);

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

  // ---- top products: sort by units or revenue ---------------------------------------------------

  test("top products can be ordered by revenue (default) or by units", async () => {
    const dear = await addProduct({ name: "Dear item", price: 100, quantity: 50 });
    const cheap = await addProduct({ name: "Cheap item", price: 5, quantity: 50 });
    await sell(dear, 2, 100); // 2 units, 200 revenue
    await sell(cheap, 20, 5); // 20 units, 100 revenue

    const byRevenue = await request(app).get("/api/v1/analytics/top-products");
    assert.deepEqual(names(byRevenue), ["Dear item", "Cheap item"]);

    const byUnits = await request(app).get("/api/v1/analytics/top-products?sort=units");
    assert.deepEqual(names(byUnits), ["Cheap item", "Dear item"]);

    const explicit = await request(app).get("/api/v1/analytics/top-products?sort=revenue");
    assert.deepEqual(names(explicit), ["Dear item", "Cheap item"]);

    assert.equal((await request(app).get("/api/v1/analytics/top-products?sort=name")).status, 400);
  });

  // ---- slow movers --------------------------------------------------------------------------------

  async function slowMoverFixture() {
    const never = await addProduct({ name: "Never sold", price: 10, quantity: 40 });
    const fewDear = await addProduct({ name: "Few but dear", price: 500, quantity: 40 });
    const manyCheap = await addProduct({ name: "Many but cheap", price: 5, quantity: 40 });
    await sell(fewDear, 1, 500); // 1 unit, 500 revenue
    await sell(manyCheap, 10, 5); // 10 units, 50 revenue
    return { never, fewDear, manyCheap };
  }

  test("slow movers are ordered by units (default) or by revenue, never-sold first", async () => {
    await slowMoverFixture();

    const byUnits = await request(app).get("/api/v1/analytics/slow-movers");
    assert.equal(byUnits.status, 200);
    assert.deepEqual(names(byUnits), ["Never sold", "Few but dear", "Many but cheap"]);
    assert.deepEqual(
      byUnits.body.data.products.map((item) => [item.unitsSold, item.revenue, item.quantity]),
      [
        [0, 0, 40],
        [1, 500, 39],
        [10, 50, 30],
      ]
    );

    const byRevenue = await request(app).get("/api/v1/analytics/slow-movers?sort=revenue");
    assert.deepEqual(names(byRevenue), ["Never sold", "Many but cheap", "Few but dear"]);

    const limited = await request(app).get("/api/v1/analytics/slow-movers?limit=1");
    assert.deepEqual(names(limited), ["Never sold"]);
  });

  test("slow movers leave out empty, new, switched-off and other shops' products", async () => {
    await addProduct({ name: "Eligible", quantity: 10 });
    await addProduct({ name: "Out of stock", quantity: 0 });
    await addProduct({ name: "Added yesterday", quantity: 10, ageDays: 1 });
    const removed = await addProduct({ name: "Removed", quantity: 10 });
    await pool.query("UPDATE products SET is_active = FALSE WHERE product_id = $1", [removed]);
    await addProduct({ businessId: fixture.otherBusinessId, name: "Someone else's", quantity: 10 });

    const response = await request(app).get("/api/v1/analytics/slow-movers");
    assert.deepEqual(names(response), ["Eligible"]);
  });

  test("a voided sale does not count towards what a product sold", async () => {
    const product = await addProduct({ name: "Returned item", price: 10, quantity: 40 });
    const other = await addProduct({ name: "Other item", price: 10, quantity: 40 });
    const sale = (await sell(product, 8, 10)).body.data;
    await sell(other, 2, 10);

    const before = await request(app).get("/api/v1/analytics/slow-movers");
    assert.deepEqual(names(before), ["Other item", "Returned item"]);
    assert.equal(
      before.body.data.products.find((item) => item.productName === "Returned item").unitsSold,
      8
    );

    await request(app).post(`/api/v1/sales/${sale.saleId}/void`).send({ reason: "Entered by mistake" });

    const after = await request(app).get("/api/v1/analytics/slow-movers");
    assert.equal(
      after.body.data.products.find((item) => item.productName === "Returned item").unitsSold,
      0
    );
  });

  test("slow movers only count sales inside the chosen period", async () => {
    const product = await addProduct({ name: "Old seller", price: 10, quantity: 40 });
    const sale = (await sell(product, 5, 10)).body.data;
    await pool.query("UPDATE sales SET sale_date = now() - interval '60 days' WHERE sale_id = $1", [
      sale.saleId,
    ]);

    const recent = await request(app).get("/api/v1/analytics/slow-movers?period=last30");
    assert.equal(recent.body.data.products[0].unitsSold, 0);
    const wide = await request(app).get("/api/v1/analytics/slow-movers?period=last90");
    assert.equal(wide.body.data.products[0].unitsSold, 5);
  });

  // ---- reorder suggestions ------------------------------------------------------------------------

  test("the reorder rule, on its own", () => {
    const base = {
      productId: "p",
      productName: "Item",
      category: "Snacks",
      unit: "piece",
      quantity: 20,
      reorderThreshold: 5,
      unitsSold: 0,
    };

    // plenty of stock and slow sales: nothing to do
    assert.equal(inventory.reorderSuggestionFor({ ...base, quantity: 100, unitsSold: 3 }, 30), null);

    // out of stock, sells 1 a day: two weeks of sales
    const out = inventory.reorderSuggestionFor({ ...base, quantity: 0, unitsSold: 30 }, 30);
    assert.equal(out.reason, "OUT_OF_STOCK");
    assert.equal(out.suggestedQuantity, 14);
    assert.equal(out.weeklySales, 7);
    assert.equal(out.daysOfStockLeft, 0);

    // at or below the minimum, no sales history: twice the minimum
    const low = inventory.reorderSuggestionFor({ ...base, quantity: 3 }, 30);
    assert.equal(low.reason, "LOW_STOCK");
    assert.equal(low.suggestedQuantity, 7);
    assert.equal(low.daysOfStockLeft, null);

    // above the minimum but selling 3 a day with 20 left: about 6.7 days
    const running = inventory.reorderSuggestionFor({ ...base, quantity: 20, unitsSold: 90 }, 30);
    assert.equal(running.reason, "RUNNING_OUT");
    assert.equal(running.daysOfStockLeft, 6.7);
    assert.equal(running.suggestedQuantity, 22);
  });

  test("reorder suggestions list the urgent products first", async () => {
    const out = await addProduct({ name: "Sold out", price: 10, quantity: 40 });
    await sell(out, 30, 10); // sold 30 and now has 10 ...
    await sell(out, 10, 10); // ... then 0 left
    const running = await addProduct({ name: "Running out", price: 10, quantity: 110 });
    await sell(running, 90, 10); // 20 left, 3 a day
    await addProduct({ name: "Low", quantity: 3, threshold: 5 });
    await addProduct({ name: "Fine", price: 10, quantity: 100 });

    const response = await request(app).get("/api/v1/inventory/reorder-suggestions");
    assert.equal(response.status, 200);
    assert.equal(response.body.data.days, 30);
    assert.equal(response.body.data.total, 3);
    assert.deepEqual(
      response.body.data.items.map((item) => [item.productName, item.reason]),
      [
        ["Sold out", "OUT_OF_STOCK"],
        ["Running out", "RUNNING_OUT"],
        ["Low", "LOW_STOCK"],
      ]
    );

    const limited = await request(app).get("/api/v1/inventory/reorder-suggestions?limit=2");
    assert.equal(limited.body.data.items.length, 2);
    assert.equal(limited.body.data.total, 3, "total counts every suggestion, not just the page");
  });

  test("reorder suggestions use only this shop's products and completed sales", async () => {
    await addProduct({ businessId: fixture.otherBusinessId, name: "Someone else's", quantity: 0 });
    const product = await addProduct({ name: "Mine", price: 10, quantity: 40 });
    const sale = (await sell(product, 40, 10)).body.data;
    await request(app).post(`/api/v1/sales/${sale.saleId}/void`).send({ reason: "Entered by mistake" });

    const response = await request(app).get("/api/v1/inventory/reorder-suggestions");
    assert.deepEqual(response.body.data.items, [], "the voided sale restored the stock and counts for nothing");
  });

  test("reorder suggestions reject bad parameters", async () => {
    for (const query of ["days=3", "days=400", "days=abc", "limit=0", "limit=100"]) {
      const response = await request(app).get(`/api/v1/inventory/reorder-suggestions?${query}`);
      assert.equal(response.status, 400, query);
    }
  });
}
