import assert from "node:assert/strict";
import dotenv from "dotenv";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  test("inventory integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not point to DATABASE_URL.");
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const [
    { default: app },
    { env },
    { pool, withTransaction },
    { applyStockChange },
    { syncAlerts },
  ] = await Promise.all([
    import("../../src/app.js"),
    import("../../src/config/env.js"),
    import("../../src/config/db.js"),
    import("../../src/services/stock.service.js"),
    import("../../src/services/alert.service.js"),
  ]);

let fixture;

async function createFixture() {
  const { rows: users } = await pool.query(
    `INSERT INTO app_users
       (first_name, last_name, email, password_hash, whatsapp_number)
     VALUES ('Inventory', 'Tester', 'inventory-test@bizpilot.local', 'test-hash', '9000000001'),
            ('Other', 'Tenant', 'other-test@bizpilot.local', 'test-hash', '9000000002')
     RETURNING user_id`
  );
  const userIds = users.map((row) => row.user_id);
  const { rows: businesses } = await pool.query(
    `INSERT INTO businesses
       (owner_user_id, business_name, business_type, owner_name,
        contact_number, business_email, business_address)
     VALUES ($1, 'Inventory Test Business', 'Retail', 'Inventory Tester',
             '9000000001', 'inventory-test@bizpilot.local', 'Test address'),
            ($2, 'Other Test Business', 'Retail', 'Other Tenant',
             '9000000002', 'other-test@bizpilot.local', 'Test address')
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
  quantity = 0,
  threshold = 5,
}) {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO products
         (business_id, product_name, category, unit, selling_price)
       VALUES ($1, $2, $3, 'piece', $4)
       RETURNING product_id`,
      [businessId, name, category, price]
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
    } else {
      await syncAlerts(client, businessId, productId);
    }
    return productId;
  });
}

beforeEach(async () => {
  await pool.query(
    `TRUNCATE TABLE inventory_alerts, stock_movements, audit_logs,
       inventory, products, business_settings, businesses, app_users
     CASCADE`
  );
  fixture = await createFixture();
});

after(async () => {
  await pool.end();
});

test("stock changes update the ledger, alerts, and audit atomically", async () => {
  const productId = await addProduct({ name: "Stock Test", quantity: 0.1 });

  await withTransaction((client) =>
    applyStockChange(client, {
      businessId: fixture.businessId,
      productId,
      delta: 0.2,
      movementType: "MANUAL_ADJUSTMENT",
      source: "MANUAL",
      userId: fixture.userId,
    })
  );
  await withTransaction((client) =>
    applyStockChange(client, {
      businessId: fixture.businessId,
      productId,
      delta: -0.1,
      movementType: "DAMAGE",
      source: "MANUAL",
      userId: fixture.userId,
    })
  );

  const { rows: movements } = await pool.query(
    `SELECT quantity_change, previous_quantity, new_quantity
       FROM stock_movements
      WHERE business_id = $1 AND product_id = $2 AND source = 'MANUAL'
      ORDER BY created_at, movement_id`,
    [fixture.businessId, productId]
  );
  assert.deepEqual(
    movements.map((row) => [
      Number(row.previous_quantity),
      Number(row.quantity_change),
      Number(row.new_quantity),
    ]),
    [[0.1, 0.2, 0.3], [0.3, -0.1, 0.2]]
  );
  const { rows: audits } = await pool.query(
    `SELECT action_type, description
       FROM audit_logs
      WHERE business_id = $1 AND entity_id = $2
      ORDER BY created_at, audit_id`,
    [fixture.businessId, productId]
  );
  assert.deepEqual(
    audits.map((row) => [row.action_type, row.description]),
    [
      ["STOCK_ADDED", "Stock Test  •  +0.2 units (New stock: 0.3)"],
      ["STOCK_REMOVED", "Stock Test  •  -0.1 units (New stock: 0.2)"],
    ]
  );

  await assert.rejects(
    withTransaction((client) =>
      applyStockChange(client, {
        businessId: fixture.businessId,
        productId,
        delta: -0.3,
        movementType: "MANUAL_ADJUSTMENT",
        source: "MANUAL",
        userId: fixture.userId,
      })
    ),
    (error) => error.code === "INSUFFICIENT_STOCK" && error.statusCode === 409
  );
  await assert.rejects(
    withTransaction((client) =>
      applyStockChange(client, {
        businessId: fixture.businessId,
        productId,
        delta: 0,
        movementType: "MANUAL_ADJUSTMENT",
        source: "MANUAL",
        userId: fixture.userId,
      })
    ),
    (error) => error.code === "VALIDATION_ERROR"
  );
  const afterRejectedChanges = await pool.query(
    `SELECT COUNT(*)::integer AS count
       FROM stock_movements
      WHERE business_id = $1 AND product_id = $2`,
    [fixture.businessId, productId]
  );
  assert.equal(afterRejectedChanges.rows[0].count, 3);
});

test("stock alerts transition, respect settings, and remain unique", async () => {
  const productId = await addProduct({
    name: "Alert Test",
    quantity: 6,
    threshold: 5,
  });

  await withTransaction((client) =>
    applyStockChange(client, {
      businessId: fixture.businessId,
      productId,
      delta: -1,
      movementType: "MANUAL_ADJUSTMENT",
      source: "MANUAL",
      userId: fixture.userId,
    })
  );
  await withTransaction((client) =>
    syncAlerts(client, fixture.businessId, productId)
  );
  let { rows: alerts } = await pool.query(
    `SELECT alert_type, status
       FROM inventory_alerts
      WHERE business_id = $1 AND product_id = $2`,
    [fixture.businessId, productId]
  );
  assert.equal(alerts.filter((alert) => alert.status === "ACTIVE").length, 1);
  assert.equal(alerts.find((alert) => alert.status === "ACTIVE").alert_type, "LOW_STOCK");

  await withTransaction((client) =>
    applyStockChange(client, {
      businessId: fixture.businessId,
      productId,
      delta: -5,
      movementType: "MANUAL_ADJUSTMENT",
      source: "MANUAL",
      userId: fixture.userId,
    })
  );
  ({ rows: alerts } = await pool.query(
    `SELECT alert_type, status
       FROM inventory_alerts
      WHERE business_id = $1 AND product_id = $2`,
    [fixture.businessId, productId]
  ));
  assert.equal(
    alerts.some(
      (alert) => alert.status === "ACTIVE" && alert.alert_type === "OUT_OF_STOCK"
    ),
    true
  );
  assert.equal(
    alerts.some(
      (alert) => alert.status === "RESOLVED" && alert.alert_type === "LOW_STOCK"
    ),
    true
  );

  await withTransaction((client) =>
    applyStockChange(client, {
      businessId: fixture.businessId,
      productId,
      delta: 6,
      movementType: "MANUAL_ADJUSTMENT",
      source: "MANUAL",
      userId: fixture.userId,
    })
  );
  ({ rows: alerts } = await pool.query(
    `SELECT status FROM inventory_alerts
      WHERE business_id = $1 AND product_id = $2`,
    [fixture.businessId, productId]
  ));
  assert.equal(alerts.every((alert) => alert.status === "RESOLVED"), true);

  await pool.query(
    `UPDATE business_settings SET low_stock_alerts_enabled = FALSE
      WHERE business_id = $1`,
    [fixture.businessId]
  );
  await withTransaction((client) =>
    applyStockChange(client, {
      businessId: fixture.businessId,
      productId,
      delta: -2,
      movementType: "MANUAL_ADJUSTMENT",
      source: "MANUAL",
      userId: fixture.userId,
    })
  );
  const lowAlerts = await pool.query(
    `SELECT COUNT(*)::integer AS count
       FROM inventory_alerts
      WHERE business_id = $1 AND product_id = $2
        AND alert_type = 'LOW_STOCK' AND status = 'ACTIVE'`,
    [fixture.businessId, productId]
  );
  assert.equal(lowAlerts.rows[0].count, 0);

  await pool.query(
    `UPDATE business_settings SET out_of_stock_alerts_enabled = FALSE
      WHERE business_id = $1`,
    [fixture.businessId]
  );
  await withTransaction((client) =>
    applyStockChange(client, {
      businessId: fixture.businessId,
      productId,
      delta: -4,
      movementType: "MANUAL_ADJUSTMENT",
      source: "MANUAL",
      userId: fixture.userId,
    })
  );
  await pool.query(
    `UPDATE business_settings
        SET stock_alerts_enabled = FALSE,
            low_stock_alerts_enabled = TRUE,
            out_of_stock_alerts_enabled = TRUE
      WHERE business_id = $1`,
    [fixture.businessId]
  );
  await withTransaction((client) =>
    applyStockChange(client, {
      businessId: fixture.businessId,
      productId,
      delta: 1,
      movementType: "MANUAL_ADJUSTMENT",
      source: "MANUAL",
      userId: fixture.userId,
    })
  );
  const activeAlerts = await pool.query(
    `SELECT COUNT(*)::integer AS count
       FROM inventory_alerts
      WHERE business_id = $1 AND product_id = $2 AND status = 'ACTIVE'`,
    [fixture.businessId, productId]
  );
  assert.equal(activeAlerts.rows[0].count, 0);
});

test("product creation writes opening stock, audit, alerts, and detects duplicate names", async () => {
  const created = await request(app)
    .post("/api/v1/products")
    .send({
      name: "  Fresh   Milk ",
      category: "Dairy",
      unit: "L",
      price: 60,
      costPrice: 45,
      quantity: 5,
      lowStockThreshold: 10,
    });

  assert.equal(created.status, 201);
  assert.equal(created.body.data.name, "Fresh Milk");
  assert.equal(created.body.data.quantity, 5);
  assert.equal(created.body.data.status, "low-stock");
  assert.equal(created.body.data.lastAdjustment, null);

  const { rows: movements } = await pool.query(
    `SELECT source, movement_type, quantity_change
       FROM stock_movements
      WHERE business_id = $1 AND product_id = $2`,
    [fixture.businessId, created.body.data.id]
  );
  assert.deepEqual(movements, [
    {
      source: "SYSTEM",
      movement_type: "MANUAL_ADJUSTMENT",
      quantity_change: "5.000",
    },
  ]);
  const { rows: audits } = await pool.query(
    `SELECT action_type, description
       FROM audit_logs
      WHERE business_id = $1 AND entity_id = $2`,
    [fixture.businessId, created.body.data.id]
  );
  assert.deepEqual(audits, [
    {
      action_type: "PRODUCT_CREATED",
      description: "Fresh Milk  •  ₹60",
    },
  ]);
  const alerts = await request(app).get("/api/v1/inventory/alerts");
  assert.equal(alerts.body.data.items.length, 1);
  assert.equal(alerts.body.data.items[0].type, "LOW_STOCK");
  assert.equal(alerts.body.data.items[0].productId, created.body.data.id);

  const duplicate = await request(app)
    .post("/api/v1/products")
    .send({
      name: "fresh milk",
      category: "Dairy",
      unit: "L",
      price: 60,
      quantity: 0,
      lowStockThreshold: 10,
    });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "DUPLICATE_PRODUCT");

  const secondProduct = await request(app)
    .post("/api/v1/products")
    .send({
      name: "Fresh Bread",
      category: "Bakery",
      unit: "piece",
      price: 30,
      quantity: 0,
      lowStockThreshold: 5,
    });
  const duplicatePatch = await request(app)
    .patch(`/api/v1/products/${secondProduct.body.data.id}`)
    .send({ name: "FRESH MILK" });
  assert.equal(duplicatePatch.status, 409);
  assert.equal(duplicatePatch.body.code, "DUPLICATE_PRODUCT");
  const unchanged = await request(app).get(
    `/api/v1/products/${secondProduct.body.data.id}`
  );
  assert.equal(unchanged.body.data.name, "Fresh Bread");
});

test("product quantity patches create manual movements and delete resolves alerts", async () => {
  const created = await request(app)
    .post("/api/v1/products")
    .send({
      name: "Patch Product",
      category: "Dairy",
      unit: "piece",
      price: 12,
      quantity: 2,
      lowStockThreshold: 5,
    });
  assert.equal(created.status, 201);

  const patched = await request(app)
    .patch(`/api/v1/products/${created.body.data.id}`)
    .send({ quantity: 4 });
  assert.equal(patched.status, 200);
  assert.deepEqual(patched.body.data.lastAdjustment, {
    type: "add",
    amount: 2,
    date: patched.body.data.lastAdjustment.date,
  });
  const manualMovements = await pool.query(
    `SELECT source, movement_type, quantity_change
       FROM stock_movements
      WHERE business_id = $1 AND product_id = $2 AND source = 'MANUAL'`,
    [fixture.businessId, created.body.data.id]
  );
  assert.deepEqual(manualMovements.rows, [
    {
      source: "MANUAL",
      movement_type: "MANUAL_ADJUSTMENT",
      quantity_change: "2.000",
    },
  ]);

  const deleted = await request(app).delete(
    `/api/v1/products/${created.body.data.id}`
  );
  assert.equal(deleted.status, 200);
  assert.equal(deleted.body.data, null);
  const detail = await request(app).get(
    `/api/v1/products/${created.body.data.id}`
  );
  assert.equal(detail.status, 404);
  assert.equal(detail.body.code, "NOT_FOUND");
  const list = await request(app).get("/api/v1/products");
  assert.equal(
    list.body.data.items.some((item) => item.id === created.body.data.id),
    false
  );
  const activeAlerts = await request(app).get("/api/v1/inventory/alerts");
  assert.equal(activeAlerts.body.data.items.length, 0);
  const resolvedAlerts = await pool.query(
    `SELECT status, resolved_at
       FROM inventory_alerts
      WHERE business_id = $1 AND product_id = $2`,
    [fixture.businessId, created.body.data.id]
  );
  assert.equal(resolvedAlerts.rows[0].status, "RESOLVED");
  assert.ok(resolvedAlerts.rows[0].resolved_at);
  const deleteAudit = await pool.query(
    `SELECT action_type
       FROM audit_logs
      WHERE business_id = $1 AND entity_id = $2
        AND action_type = 'PRODUCT_DELETED'`,
    [fixture.businessId, created.body.data.id]
  );
  assert.deepEqual(deleteAudit.rows, [{ action_type: "PRODUCT_DELETED" }]);
});

test("inventory adjustments support add, remove, exact counts, alerts, and history", async () => {
  const created = await request(app)
    .post("/api/v1/products")
    .send({
      name: "Adjust Product",
      category: "Snacks",
      unit: "packet",
      price: 8,
      quantity: 5,
      lowStockThreshold: 10,
    });
  assert.equal(created.status, 201);
  const productId = created.body.data.id;

  const added = await request(app)
    .patch(`/api/v1/inventory/${productId}`)
    .send({ type: "add", amount: 20 });
  assert.equal(added.status, 200);
  assert.equal(added.body.data.quantity, 25);
  assert.equal(added.body.data.lastAdjustment.type, "add");
  assert.equal(added.body.data.lastAdjustment.amount, 20);
  const activeAlerts = await request(app).get("/api/v1/inventory/alerts");
  assert.equal(activeAlerts.body.data.items.length, 0);

  await new Promise((resolve) => setTimeout(resolve, 10));
  const removed = await request(app)
    .patch(`/api/v1/inventory/${productId}`)
    .send({ type: "remove", amount: 3 });
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.quantity, 22);
  assert.equal(removed.body.data.lastAdjustment.type, "remove");
  assert.equal(removed.body.data.lastAdjustment.amount, 3);

  await new Promise((resolve) => setTimeout(resolve, 10));
  const corrected = await request(app)
    .patch(`/api/v1/inventory/${productId}`)
    .send({ quantity: 6, reason: "CORRECTION" });
  assert.equal(corrected.status, 200);
  assert.equal(corrected.body.data.quantity, 6);
  assert.equal(corrected.body.data.lastAdjustment.type, "remove");
  assert.equal(corrected.body.data.lastAdjustment.amount, 16);

  const { rows: beforeNoOp } = await pool.query(
    `SELECT COUNT(*)::integer AS count
       FROM stock_movements
      WHERE business_id = $1 AND product_id = $2`,
    [fixture.businessId, productId]
  );
  const noOp = await request(app)
    .patch(`/api/v1/inventory/${productId}`)
    .send({ quantity: 6 });
  assert.equal(noOp.status, 200);
  const { rows: afterNoOp } = await pool.query(
    `SELECT COUNT(*)::integer AS count
       FROM stock_movements
      WHERE business_id = $1 AND product_id = $2`,
    [fixture.businessId, productId]
  );
  assert.equal(afterNoOp[0].count, beforeNoOp[0].count);

  const overRemoval = await request(app)
    .patch(`/api/v1/inventory/${productId}`)
    .send({ type: "remove", amount: 100 });
  assert.equal(overRemoval.status, 409);
  assert.equal(overRemoval.body.code, "INSUFFICIENT_STOCK");
  const unchanged = await request(app).get(`/api/v1/products/${productId}`);
  assert.equal(unchanged.body.data.quantity, 6);
  const afterFailure = await pool.query(
    `SELECT COUNT(*)::integer AS count
       FROM stock_movements
      WHERE business_id = $1 AND product_id = $2`,
    [fixture.businessId, productId]
  );
  assert.equal(afterFailure.rows[0].count, beforeNoOp[0].count);

  const bothForms = await request(app)
    .patch(`/api/v1/inventory/${productId}`)
    .send({ type: "add", amount: 1, quantity: 7 });
  const neitherForm = await request(app)
    .patch(`/api/v1/inventory/${productId}`)
    .send({ reason: "CORRECTION" });
  assert.equal(bothForms.status, 400);
  assert.equal(neitherForm.status, 400);

  const history = await request(app)
    .get(`/api/v1/inventory/${productId}/history`)
    .query({ limit: 3 });
  assert.equal(history.status, 200);
  assert.deepEqual(
    history.body.data.items.map((item) => item.quantityChange),
    [-16, -3, 20]
  );
  assert.ok(
    new Date(history.body.data.items[0].createdAt) >=
      new Date(history.body.data.items[1].createdAt)
  );
});

test("all product and stock writes hide another tenant's product", async () => {
  const created = await request(app)
    .post("/api/v1/products")
    .send({
      name: "Tenant Product",
      category: "Snacks",
      unit: "piece",
      price: 10,
      quantity: 2,
      lowStockThreshold: 5,
    });
  const productId = created.body.data.id;

  env.devUserId = fixture.otherUserId;
  const patch = await request(app)
    .patch(`/api/v1/products/${productId}`)
    .send({ name: "Stolen Product" });
  const adjustment = await request(app)
    .patch(`/api/v1/inventory/${productId}`)
    .send({ type: "add", amount: 10 });
  const deletion = await request(app).delete(
    `/api/v1/products/${productId}`
  );
  assert.equal(patch.status, 404);
  assert.equal(patch.body.code, "NOT_FOUND");
  assert.equal(adjustment.status, 404);
  assert.equal(adjustment.body.code, "NOT_FOUND");
  assert.equal(deletion.status, 404);
  assert.equal(deletion.body.code, "NOT_FOUND");
  const tenantAlerts = await request(app).get("/api/v1/inventory/alerts");
  assert.equal(tenantAlerts.body.data.items.length, 0);

  env.devUserId = fixture.userId;
  const original = await request(app).get(`/api/v1/products/${productId}`);
  assert.equal(original.status, 200);
  assert.equal(original.body.data.name, "Tenant Product");
  assert.equal(original.body.data.quantity, 2);
});

test("product and inventory reads filter, sort, search, summarize, and isolate tenants", async () => {
  const lowPriced = await addProduct({
    name: "Parle-G 100%",
    price: 4,
    quantity: 3,
    threshold: 5,
  });
  await addProduct({
    name: "Pearl Sugar",
    price: 7,
    quantity: 0,
    threshold: 5,
  });
  await addProduct({
    name: "Paneer",
    category: "Dairy",
    price: 20,
    quantity: 12,
    threshold: 5,
  });
  await addProduct({
    name: "Parle-G Classic",
    price: 8,
    quantity: 4,
    threshold: 5,
  });

  const lowResponse = await request(app)
    .get("/api/v1/products")
    .query({ status: "low-stock", sort: "price_asc", limit: 500 });
  assert.equal(lowResponse.status, 200);
  assert.deepEqual(
    lowResponse.body.data.items.map((item) => item.name),
    ["Parle-G 100%", "Parle-G Classic"]
  );
  assert.equal(lowResponse.body.data.total, 2);

  const highPriceResponse = await request(app)
    .get("/api/v1/products")
    .query({ sort: "price_desc", limit: 500 });
  assert.deepEqual(
    highPriceResponse.body.data.items.map((item) => item.price),
    [20, 8, 7, 4]
  );
  const quantityResponse = await request(app)
    .get("/api/v1/products")
    .query({ sort: "quantity", limit: 500 });
  const quantities = quantityResponse.body.data.items.map(
    (item) => item.quantity
  );
  assert.deepEqual(quantities, [...quantities].sort((left, right) => left - right));

  const literalPercent = await request(app)
    .get("/api/v1/products")
    .query({ search: "%" });
  assert.deepEqual(
    literalPercent.body.data.items.map((item) => item.name),
    ["Parle-G 100%"]
  );
  const fuzzySearch = await request(app)
    .get("/api/v1/products/search")
    .query({ q: "parle g" });
  assert.equal(
    fuzzySearch.body.data.items.some((item) => item.name === "Parle-G 100%"),
    true
  );

  const categories = await request(app).get("/api/v1/products/categories");
  assert.equal(categories.body.data.items.includes("Snacks"), true);
  for (const category of ["Fruits", "Dairy", "Bakery", "Vegetables", "Meat", "Beverages"]) {
    assert.equal(categories.body.data.items.includes(category), true);
  }
  const categoryFilter = await request(app)
    .get("/api/v1/products")
    .query({ category: "Dairy", limit: 500 });
  assert.deepEqual(
    categoryFilter.body.data.items.map((item) => item.name),
    ["Paneer"]
  );

  const summary = await request(app).get("/api/v1/inventory/summary");
  const allProducts = await request(app)
    .get("/api/v1/inventory")
    .query({ limit: 500 });
  assert.equal(summary.body.data.total, allProducts.body.data.total);
  for (const [status, summaryField] of [
    ["in-stock", "inStock"],
    ["low-stock", "lowStock"],
    ["out-of-stock", "outOfStock"],
  ]) {
    const filtered = await request(app)
      .get("/api/v1/products")
      .query({ status, limit: 500 });
    assert.equal(summary.body.data[summaryField], filtered.body.data.total);
    assert.ok(filtered.body.data.items.every((item) => item.status === status));
  }

  const alerts = await request(app).get("/api/v1/inventory/alerts");
  assert.equal(alerts.body.data.items.length, 3);

  env.devUserId = fixture.otherUserId;
  const hiddenProduct = await request(app).get(`/api/v1/products/${lowPriced}`);
  assert.equal(hiddenProduct.status, 404);
  assert.equal(hiddenProduct.body.code, "NOT_FOUND");
});
}
