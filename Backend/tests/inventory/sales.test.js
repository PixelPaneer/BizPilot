import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  test("sales integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not point to DATABASE_URL.");
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const [{ default: app }, { env }, { pool, withTransaction }, { applyStockChange }, analytics] =
    await Promise.all([
      import("../../src/app.js"),
      import("../../src/config/env.js"),
      import("../../src/config/db.js"),
      import("../../src/services/stock.service.js"),
      import("../../src/services/analytics.service.js"),
    ]);

  let fixture;

  async function createFixture() {
    const { rows: users } = await pool.query(
      `INSERT INTO app_users
         (first_name, last_name, email, password_hash, whatsapp_number)
       VALUES ('Sales', 'Tester', 'sales-test@bizpilot.local', 'test-hash', '9000000011'),
              ('Other', 'Tenant', 'other-sales@bizpilot.local', 'test-hash', '9000000012')
       RETURNING user_id`
    );
    const userIds = users.map((row) => row.user_id);
    const { rows: businesses } = await pool.query(
      `INSERT INTO businesses
         (owner_user_id, business_name, business_type, owner_name,
          contact_number, business_email, business_address)
       VALUES ($1, 'Sales Test Business', 'Retail', 'Sales Tester',
               '9000000011', 'sales-test@bizpilot.local', 'Test address'),
              ($2, 'Other Sales Business', 'Retail', 'Other Tenant',
               '9000000012', 'other-sales@bizpilot.local', 'Test address')
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
    category = "Snacks",
    price = 10,
    cost = null,
    quantity = 0,
    threshold = 5,
  }) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products
           (business_id, product_name, category, unit, selling_price, cost_price)
         VALUES ($1, $2, $3, 'piece', $4, $5)
         RETURNING product_id`,
        [businessId, name, category, price, cost]
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

  const sell = (lines, extra = {}) =>
    request(app)
      .post("/api/v1/sales")
      .send({ idempotencyKey: randomUUID(), lines, ...extra });

  const buy = (lines, extra = {}) =>
    request(app)
      .post("/api/v1/purchases")
      .send({ idempotencyKey: randomUUID(), lines, ...extra });

  async function stockOf(productId) {
    const { rows } = await pool.query(
      `SELECT available_quantity FROM inventory WHERE product_id = $1`,
      [productId]
    );
    return Number(rows[0].available_quantity);
  }

  async function count(table, where = "TRUE", params = []) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::integer AS n FROM ${table} WHERE ${where}`,
      params
    );
    return rows[0].n;
  }

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

  test("recording a sale saves the sale, its lines, stock movements and an audit row", async () => {
    const a = await addProduct({ name: "Parle-G", price: 10, cost: 8, quantity: 50 });
    const b = await addProduct({ name: "Maggi", category: "Noodles", price: 14, quantity: 10 });

    const response = await sell([
      { productId: a, quantity: 5, unitPrice: 10 },
      { productId: b, quantity: 2, unitPrice: 21.5 },
    ]);
    assert.equal(response.status, 201);
    const sale = response.body.data;
    assert.match(sale.saleNumber, /^SL-\d{8}-0001$/);
    assert.equal(sale.status, "COMPLETED");
    assert.equal(sale.totalAmount, 93);
    const byName = Object.fromEntries(sale.lines.map((line) => [line.productName, line]));
    assert.equal(sale.lines.length, 2);
    assert.deepEqual(
      [byName["Parle-G"].newQuantity, byName["Parle-G"].shortfall],
      [45, 0]
    );
    assert.deepEqual([byName["Maggi"].newQuantity, byName["Maggi"].shortfall], [8, 0]);
    assert.deepEqual(sale.warnings, []);

    assert.equal(await stockOf(a), 45);
    assert.equal(await stockOf(b), 8);

    const { rows: saleRows } = await pool.query(
      `SELECT status, total_amount, subtotal, source, idempotency_key FROM sales`
    );
    assert.equal(saleRows.length, 1);
    assert.equal(saleRows[0].status, "COMPLETED");
    assert.equal(Number(saleRows[0].total_amount), 93);
    assert.equal(saleRows[0].source, "MANUAL");

    const { rows: items } = await pool.query(
      `SELECT product_name_snapshot, category_snapshot, quantity, unit_selling_price,
              unit_cost_at_sale, revenue
         FROM sale_items ORDER BY product_name_snapshot`
    );
    assert.deepEqual(
      items.map((row) => [
        row.product_name_snapshot,
        row.category_snapshot,
        Number(row.quantity),
        Number(row.unit_selling_price),
        row.unit_cost_at_sale === null ? null : Number(row.unit_cost_at_sale),
        Number(row.revenue),
      ]),
      [
        ["Maggi", "Noodles", 2, 21.5, null, 43],
        ["Parle-G", "Snacks", 5, 10, 8, 50],
      ]
    );

    const { rows: movements } = await pool.query(
      `SELECT movement_type, quantity_change, reference_id, source, user_id
         FROM stock_movements WHERE movement_type = 'SALE' ORDER BY quantity_change`
    );
    assert.equal(movements.length, 2);
    assert.ok(movements.every((row) => row.reference_id === sale.saleId));
    assert.ok(movements.every((row) => row.user_id === fixture.userId));
    assert.deepEqual(movements.map((row) => Number(row.quantity_change)), [-5, -2]);

    const { rows: audit } = await pool.query(
      `SELECT description FROM audit_logs WHERE action_type = 'BILL_CONFIRMED'`
    );
    assert.equal(audit.length, 1);
    assert.equal(audit[0].description, `${sale.saleNumber}  •  2 items  •  ₹93`);

    const second = await sell([{ productId: a, quantity: 1, unitPrice: 10 }]);
    assert.match(second.body.data.saleNumber, /^SL-\d{8}-0002$/);
  });

  test("a repeated idempotency key returns the first result and changes nothing", async () => {
    const a = await addProduct({ name: "Parle-G", price: 10, quantity: 50 });
    const key = randomUUID();
    const body = {
      idempotencyKey: key,
      lines: [{ productId: a, quantity: 5, unitPrice: 10 }],
    };

    const first = await request(app).post("/api/v1/sales").send(body);
    const again = await request(app).post("/api/v1/sales").send(body);
    assert.equal(first.status, 201);
    assert.equal(again.status, 200);
    assert.deepEqual(again.body.data, first.body.data);
    assert.equal(await stockOf(a), 45);
    assert.equal(await count("sales"), 1);
    assert.equal(await count("stock_movements", "movement_type = 'SALE'"), 1);
  });

  test("a sale larger than stock is refused unless overselling is allowed", async () => {
    const c = await addProduct({ name: "Rusk", price: 20, quantity: 3 });

    const refused = await sell([{ productId: c, quantity: 5, unitPrice: 20 }]);
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, "INSUFFICIENT_STOCK");
    assert.equal(refused.body.errors[0].available, 3);
    assert.equal(refused.body.errors[0].requested, 5);
    assert.equal(await count("sales"), 0);
    assert.equal(await stockOf(c), 3);

    const allowed = await sell([{ productId: c, quantity: 5, unitPrice: 20 }], {
      allowOversell: true,
    });
    assert.equal(allowed.status, 201);
    assert.equal(allowed.body.data.lines[0].newQuantity, 0);
    assert.equal(allowed.body.data.lines[0].shortfall, 2);
    assert.equal(allowed.body.data.warnings.length, 1);
    assert.equal(allowed.body.data.totalAmount, 100);
    assert.equal(await stockOf(c), 0);

    const { rows: items } = await pool.query(`SELECT quantity FROM sale_items`);
    assert.equal(Number(items[0].quantity), 5);
    const { rows: movements } = await pool.query(
      `SELECT quantity_change FROM stock_movements WHERE movement_type = 'SALE'`
    );
    assert.deepEqual(movements.map((row) => Number(row.quantity_change)), [-3]);
    const { rows: alerts } = await pool.query(
      `SELECT alert_type FROM inventory_alerts WHERE status = 'ACTIVE'`
    );
    assert.deepEqual(alerts.map((row) => row.alert_type), ["OUT_OF_STOCK"]);
  });

  test("sale and purchase requests are validated", async () => {
    const a = await addProduct({ name: "Parle-G", price: 10, quantity: 50 });
    const other = await addProduct({
      businessId: fixture.otherBusinessId,
      name: "Other Shop Item",
      quantity: 10,
    });
    const good = { productId: a, quantity: 1, unitPrice: 10 };

    const cases = [
      ["no lines", { lines: [] }],
      ["duplicate product", { lines: [good, good] }],
      ["zero quantity", { lines: [{ ...good, quantity: 0 }] }],
      ["too many decimals in quantity", { lines: [{ ...good, quantity: 1.2345 }] }],
      ["negative price", { lines: [{ ...good, unitPrice: -1 }] }],
      ["three decimals in price", { lines: [{ ...good, unitPrice: 9.999 }] }],
      ["quantity as text", { lines: [{ ...good, quantity: "2" }] }],
      ["bad product id", { lines: [{ ...good, productId: "nope" }] }],
      ["unknown field in a line", { lines: [{ ...good, discount: 5 }] }],
      ["unknown field in the body", { lines: [good], customerName: "x" }],
      ["short idempotency key", { idempotencyKey: "abc", lines: [good] }],
      ["bad source", { lines: [good], source: "FAX" }],
      ["allowOversell as text", { lines: [good], allowOversell: "yes" }],
    ];
    for (const [label, extra] of cases) {
      const response = await request(app)
        .post("/api/v1/sales")
        .send({ idempotencyKey: randomUUID(), ...extra });
      assert.equal(response.status, 400, `${label} should be rejected`);
      assert.equal(response.body.code, "VALIDATION_ERROR", label);
    }
    const noKey = await request(app).post("/api/v1/sales").send({ lines: [good] });
    assert.equal(noKey.status, 400);
    assert.equal(
      (await buy([good, good])).status,
      400,
      "purchases reject duplicate products too"
    );
    assert.equal((await buy([good], { allowOversell: true })).status, 400);

    // Unknown product, and a product that belongs to another business
    const unknown = await sell([{ productId: randomUUID(), quantity: 1, unitPrice: 1 }]);
    assert.equal(unknown.status, 404);
    assert.equal(unknown.body.code, "NOT_FOUND");
    const foreign = await sell([{ productId: other, quantity: 1, unitPrice: 1 }]);
    assert.equal(foreign.status, 404);
    assert.equal((await buy([{ productId: other, quantity: 1, unitPrice: 1 }])).status, 404);

    assert.equal(await count("sales"), 0);
    assert.equal(await stockOf(a), 50);
    assert.equal(await stockOf(other), 10);
  });

  test("recording a purchase raises stock, sets the cost price and is idempotent", async () => {
    const a = await addProduct({ name: "Parle-G", price: 10, cost: 8, quantity: 5 });
    const key = randomUUID();
    const body = {
      idempotencyKey: key,
      source: "MANUAL",
      lines: [{ productId: a, quantity: 20, unitPrice: 9.5 }],
    };

    const first = await request(app).post("/api/v1/purchases").send(body);
    assert.equal(first.status, 201);
    assert.equal(first.body.data.totalAmount, 190);
    assert.equal(first.body.data.lines[0].newQuantity, 25);
    assert.equal(await stockOf(a), 25);

    const { rows: product } = await pool.query(
      `SELECT cost_price FROM products WHERE product_id = $1`,
      [a]
    );
    assert.equal(Number(product[0].cost_price), 9.5);
    const { rows: movements } = await pool.query(
      `SELECT movement_type, quantity_change, reference_id FROM stock_movements
        WHERE movement_type = 'PURCHASE'`
    );
    assert.equal(movements.length, 1);
    assert.equal(Number(movements[0].quantity_change), 20);
    assert.equal(movements[0].reference_id, first.body.data.purchaseId);
    const { rows: audit } = await pool.query(
      `SELECT description FROM audit_logs WHERE action_type = 'BILL_CONFIRMED'`
    );
    assert.equal(audit[0].description, "Purchase  •  1 item  •  ₹190");
    assert.equal(await count("sales"), 0, "purchases do not create sales");

    const again = await request(app).post("/api/v1/purchases").send(body);
    assert.equal(again.status, 200);
    assert.deepEqual(again.body.data, first.body.data);
    assert.equal(await stockOf(a), 25);
    assert.equal(await count("purchase_batches"), 1);

    // Later sales snapshot the new cost price
    const sale = await sell([{ productId: a, quantity: 1, unitPrice: 12 }]);
    assert.equal(sale.status, 201);
    const { rows: item } = await pool.query(`SELECT unit_cost_at_sale FROM sale_items`);
    assert.equal(Number(item[0].unit_cost_at_sale), 9.5);
  });

  test("voiding a sale restores the stock and removes it from the analytics", async () => {
    const a = await addProduct({ name: "Parle-G", price: 10, cost: 8, quantity: 50 });
    const sale = (await sell([{ productId: a, quantity: 5, unitPrice: 10 }])).body.data;

    const before = await analytics.getTopProducts(fixture.businessId, { period: "last30" });
    assert.equal(before.products.length, 1);
    assert.equal(before.products[0].productName, "Parle-G");
    assert.equal(before.products[0].unitsSold, 5);
    assert.equal(before.products[0].revenue, 50);
    const categoriesBefore = await analytics.getCategorySales(fixture.businessId, {
      period: "last30",
    });
    assert.equal(categoriesBefore.categories[0].revenue, 50);

    const tooShort = await request(app)
      .post(`/api/v1/sales/${sale.saleId}/void`)
      .send({ reason: "no" });
    assert.equal(tooShort.status, 400);
    const noReason = await request(app).post(`/api/v1/sales/${sale.saleId}/void`).send({});
    assert.equal(noReason.status, 400);

    const voided = await request(app)
      .post(`/api/v1/sales/${sale.saleId}/void`)
      .send({ reason: "Entered 5 instead of 1" });
    assert.equal(voided.status, 200);
    assert.equal(voided.body.data.status, "VOIDED");
    assert.equal(voided.body.data.voidReason, "Entered 5 instead of 1");
    assert.ok(voided.body.data.voidedAt);
    assert.equal(voided.body.data.items.length, 1);
    assert.deepEqual(voided.body.data.warnings, []);
    assert.equal(await stockOf(a), 50);

    const { rows: returns } = await pool.query(
      `SELECT quantity_change, reference_id, source, user_id FROM stock_movements
        WHERE movement_type = 'RETURN'`
    );
    assert.equal(returns.length, 1);
    assert.equal(Number(returns[0].quantity_change), 5);
    assert.equal(returns[0].reference_id, sale.saleId);
    assert.equal(returns[0].user_id, fixture.userId);
    const { rows: voidedRow } = await pool.query(
      `SELECT status, voided_by, void_reason FROM sales`
    );
    assert.equal(voidedRow[0].status, "VOIDED");
    assert.equal(voidedRow[0].voided_by, fixture.userId);
    const { rows: audit } = await pool.query(
      `SELECT description FROM audit_logs WHERE action_type = 'SALE_VOIDED'`
    );
    assert.equal(audit[0].description, `${sale.saleNumber} voided  •  Entered 5 instead of 1`);

    const after = await analytics.getTopProducts(fixture.businessId, { period: "last30" });
    assert.equal(after.products.length, 0);
    const categoriesAfter = await analytics.getCategorySales(fixture.businessId, {
      period: "last30",
    });
    assert.equal(categoriesAfter.categories.length, 0);

    const twice = await request(app)
      .post(`/api/v1/sales/${sale.saleId}/void`)
      .send({ reason: "Trying again" });
    assert.equal(twice.status, 409);
    assert.equal(twice.body.code, "SALE_ALREADY_VOIDED");
    assert.equal(await stockOf(a), 50, "a second void must not restore stock again");

    const missing = await request(app)
      .post(`/api/v1/sales/${randomUUID()}/void`)
      .send({ reason: "Does not exist" });
    assert.equal(missing.status, 404);
  });

  test("voiding an oversold sale restores only what was deducted", async () => {
    const c = await addProduct({ name: "Rusk", price: 20, quantity: 3 });
    const sale = (
      await sell([{ productId: c, quantity: 5, unitPrice: 20 }], { allowOversell: true })
    ).body.data;
    assert.equal(await stockOf(c), 0);

    const voided = await request(app)
      .post(`/api/v1/sales/${sale.saleId}/void`)
      .send({ reason: "Customer returned everything" });
    assert.equal(voided.status, 200);
    assert.equal(await stockOf(c), 3, "only the 3 units that were taken out come back");
  });

  test("voiding skips the stock of a product that was deleted afterwards", async () => {
    const a = await addProduct({ name: "Parle-G", price: 10, quantity: 20 });
    const sale = (await sell([{ productId: a, quantity: 4, unitPrice: 10 }])).body.data;
    const removed = await request(app).delete(`/api/v1/products/${a}`);
    assert.equal(removed.status, 200);

    const voided = await request(app)
      .post(`/api/v1/sales/${sale.saleId}/void`)
      .send({ reason: "Wrong bill" });
    assert.equal(voided.status, 200);
    assert.equal(voided.body.data.status, "VOIDED");
    assert.equal(voided.body.data.warnings.length, 1);
    assert.equal(await count("stock_movements", "movement_type = 'RETURN'"), 0);
  });

  test("another business cannot void a sale it does not own", async () => {
    const a = await addProduct({ name: "Parle-G", price: 10, quantity: 20 });
    const sale = (await sell([{ productId: a, quantity: 4, unitPrice: 10 }])).body.data;

    env.devUserId = fixture.otherUserId;
    const attempt = await request(app)
      .post(`/api/v1/sales/${sale.saleId}/void`)
      .send({ reason: "Not mine to void" });
    assert.equal(attempt.status, 404);
    assert.equal(attempt.body.code, "NOT_FOUND");

    // The same idempotency key in another business is a different, independent sale
    const otherProduct = await addProduct({
      businessId: fixture.otherBusinessId,
      name: "Other Item",
      quantity: 9,
    });
    const reuse = await request(app)
      .post("/api/v1/sales")
      .send({
        idempotencyKey: randomUUID(),
        lines: [{ productId: otherProduct, quantity: 1, unitPrice: 5 }],
      });
    assert.equal(reuse.status, 201);

    env.devUserId = fixture.userId;
    assert.equal(await stockOf(a), 16, "the original sale is untouched");
    assert.equal(await count("sales", "status = 'COMPLETED'"), 2);
  });

  test("concurrent sales of the same product never take stock below zero", async () => {
    const a = await addProduct({ name: "Parle-G", price: 10, quantity: 10 });
    const results = await Promise.all(
      Array.from({ length: 5 }, () => sell([{ productId: a, quantity: 4, unitPrice: 10 }]))
    );
    const created = results.filter((response) => response.status === 201).length;
    const refused = results.filter((response) => response.status === 409).length;
    assert.equal(created, 2);
    assert.equal(refused, 3);
    assert.equal(await stockOf(a), 2);
    const numbers = (await pool.query(`SELECT sale_number FROM sales ORDER BY sale_number`)).rows;
    assert.equal(new Set(numbers.map((row) => row.sale_number)).size, 2);
  });
}
