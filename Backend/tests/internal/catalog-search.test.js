import assert from "node:assert/strict";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import test, { after, beforeEach } from "node:test";
import request from "supertest";

dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  test("catalog search integration tests require TEST_DATABASE_URL", { skip: true }, () => {});
} else {
  if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must not point to DATABASE_URL.");
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

  const [{ default: app }, { env }, { pool, withTransaction }, { applyStockChange }, catalog] =
    await Promise.all([
      import("../../src/app.js"),
      import("../../src/config/env.js"),
      import("../../src/config/db.js"),
      import("../../src/services/stock.service.js"),
      import("../../src/services/catalog.service.js"),
    ]);

  const SECRET = "test-service-secret-test-service-secret-1";
  let fixture;

  // A token as the AI service would make it, for one shop.
  function aiToken(businessId) {
    const issuedAt = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iss: "bizpilot-ai", aud: "bizpilot-node", business_id: businessId, iat: issuedAt, exp: issuedAt + 60 },
      SECRET,
      { algorithm: "HS256" }
    );
  }

  const search = (queryString, businessId = fixture.businessId) =>
    request(app)
      .get(`/internal/catalog/search?${queryString}`)
      .set("Authorization", `Bearer ${aiToken(businessId)}`);

  const names = (response) => response.body.data.items.map((item) => item.name);

  async function addProduct({
    businessId = fixture.businessId,
    name,
    category = "Snacks",
    price = 10,
    cost = 7,
    quantity = 20,
    threshold = 5,
    active = true,
  }) {
    return withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products
           (business_id, product_name, category, unit, selling_price, cost_price, is_active)
         VALUES ($1, $2, $3, 'packet', $4, $5, TRUE)
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
      // Switched off last: stock cannot be changed on an inactive product.
      if (!active) {
        await client.query("UPDATE products SET is_active = FALSE WHERE product_id = $1", [productId]);
      }
      return productId;
    });
  }

  async function createFixture() {
    const { rows: users } = await pool.query(
      `INSERT INTO app_users
         (first_name, last_name, email, password_hash, whatsapp_number)
       VALUES ('Catalog', 'Tester', 'catalog-test@bizpilot.local', 'test-hash', '9000000051'),
              ('Other', 'Tenant', 'other-catalog@bizpilot.local', 'test-hash', '9000000052')
       RETURNING user_id`
    );
    const { rows: businesses } = await pool.query(
      `INSERT INTO businesses
         (owner_user_id, business_name, business_type, owner_name,
          contact_number, business_email, business_address)
       VALUES ($1, 'Catalog Test Business', 'Retail', 'Catalog Tester',
               '9000000051', 'catalog-test@bizpilot.local', 'Test address'),
              ($2, 'Other Catalog Business', 'Retail', 'Other Tenant',
               '9000000052', 'other-catalog@bizpilot.local', 'Test address')
       RETURNING business_id`,
      users.map((row) => row.user_id)
    );
    return {
      businessId: businesses[0].business_id,
      otherBusinessId: businesses[1].business_id,
    };
  }

  beforeEach(async () => {
    await pool.query(
      `TRUNCATE TABLE inventory_alerts, stock_movements, audit_logs, sale_items, sales,
         purchase_batches, inventory, products, business_settings, businesses, app_users
       CASCADE`
    );
    fixture = await createFixture();
    env.serviceJwtSecret = SECRET;
  });

  after(async () => {
    await pool.end();
  });

  // ---- finding products ---------------------------------------------------------------------------

  test("a customer's wording finds the matching products and nothing else", async () => {
    await addProduct({ name: "Parle-G 50g", price: 5 });
    await addProduct({ name: "Parle-G 100g", price: 10 });
    await addProduct({ name: "Maggi Noodles", price: 14 });
    await addProduct({ name: "Amul Butter", price: 55 });

    const response = await search("q=parle%20g");
    assert.equal(response.status, 200);
    assert.deepEqual(names(response).sort(), ["Parle-G 100g", "Parle-G 50g"]);
  });

  test("punctuation, spacing and letter case do not matter", async () => {
    await addProduct({ name: "Parle-G 50g" });
    for (const q of ["parle-g", "PARLE G", "parle_g", "  parle   g  ", "Parle.G"]) {
      const response = await search(`q=${encodeURIComponent(q)}`);
      assert.deepEqual(names(response), ["Parle-G 50g"], `q = ${JSON.stringify(q)}`);
    }
  });

  test("a small spelling mistake still finds the product", async () => {
    await addProduct({ name: "Maggi" });
    await addProduct({ name: "Amul Butter" });
    assert.deepEqual(names(await search("q=magi")), ["Maggi"]);
    assert.deepEqual(names(await search("q=amul%20buter")), ["Amul Butter"]);
  });

  test("the best match comes first, and a name that contains the words beats a loose match", async () => {
    await addProduct({ name: "Parle-G Gold 200g" });
    await addProduct({ name: "Parle-G" });
    await addProduct({ name: "Parle Monaco" });

    const response = await search("q=parle%20g");
    const items = response.body.data.items;
    assert.equal(items[0].name, "Parle-G", "the exact name scores highest");
    assert.ok(items[0].similarity >= items[1].similarity);
    assert.ok(items.every((item) => item.similarity > 0.25 && item.similarity <= 1));
    assert.ok(!names(response).includes("Parle Monaco") || items.at(-1).name === "Parle Monaco");
  });

  test("names in other scripts are found when the words appear in them", async () => {
    await addProduct({ name: "पारले जी" });
    await addProduct({ name: "Maggi" });
    assert.deepEqual(names(await search(`q=${encodeURIComponent("पारले")}`)), ["पारले जी"]);
  });

  test("nothing similar gives an empty list, not an error", async () => {
    await addProduct({ name: "Maggi" });
    const response = await search("q=zzzzqq");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.items, []);
  });

  test("the wildcard characters in a customer's text are taken literally", async () => {
    await addProduct({ name: "Maggi" });
    await addProduct({ name: "Parle-G" });
    for (const q of ["%%", "\\\\", "%a%"]) {
      const response = await search(`q=${encodeURIComponent(q)}`);
      assert.equal(response.status, 200, q);
      assert.deepEqual(response.body.data.items, [], `q = ${q} must not match everything`);
    }
    // text that is only separators has nothing to search for
    assert.equal((await search("q=__")).status, 400);
  });

  // ---- what a customer may be told ----------------------------------------------------------------

  test("the answer holds only name, category, unit, price, status and similarity", async () => {
    await addProduct({ name: "Parle-G", category: "Biscuits", price: 10, cost: 7.77, quantity: 42 });

    const [item] = (await search("q=parle")).body.data.items;
    assert.deepEqual(Object.keys(item).sort(), [
      "category",
      "name",
      "price",
      "productId",
      "similarity",
      "status",
      "unit",
    ]);
    assert.equal(item.category, "Biscuits");
    assert.equal(item.unit, "packet");
    assert.equal(item.price, 10);
    assert.equal(typeof item.price, "number");

    // the cost price and the quantity are not in the answer under any name
    const values = Object.values(item);
    assert.equal(values.includes(7.77), false, "no cost price");
    assert.equal(values.includes(42), false, "no quantity");
  });

  test("the status is available, limited (at or below the minimum) or out", async () => {
    await addProduct({ name: "Stocked item", quantity: 20, threshold: 5 });
    await addProduct({ name: "Stocked item low", quantity: 5, threshold: 5 }); // at the minimum
    await addProduct({ name: "Stocked item few", quantity: 3, threshold: 5 });
    await addProduct({ name: "Stocked item gone", quantity: 0, threshold: 5 });

    const items = (await search("q=stocked%20item&limit=10")).body.data.items;
    const status = Object.fromEntries(items.map((item) => [item.name, item.status]));
    assert.deepEqual(status, {
      "Stocked item": "available",
      "Stocked item low": "limited",
      "Stocked item few": "limited",
      "Stocked item gone": "out",
    });
  });

  test("products that were switched off are not offered", async () => {
    await addProduct({ name: "Parle-G Old", active: false });
    await addProduct({ name: "Parle-G New" });
    assert.deepEqual(names(await search("q=parle")), ["Parle-G New"]);
  });

  // ---- one shop only ------------------------------------------------------------------------------

  test("each shop sees only its own products", async () => {
    await addProduct({ name: "Parle-G Mine" });
    await addProduct({ businessId: fixture.otherBusinessId, name: "Parle-G Theirs" });

    assert.deepEqual(names(await search("q=parle")), ["Parle-G Mine"]);
    assert.deepEqual(names(await search("q=parle", fixture.otherBusinessId)), ["Parle-G Theirs"]);
  });

  test("a shop id in the query or the headers cannot widen the search", async () => {
    await addProduct({ name: "Parle-G Mine" });
    await addProduct({ businessId: fixture.otherBusinessId, name: "Parle-G Theirs" });

    const response = await request(app)
      .get(`/internal/catalog/search?q=parle&businessId=${fixture.otherBusinessId}&business_id=${fixture.otherBusinessId}`)
      .set("Authorization", `Bearer ${aiToken(fixture.businessId)}`)
      .set("X-Business-Id", fixture.otherBusinessId);
    assert.deepEqual(names(response), ["Parle-G Mine"]);
  });

  test("the search needs a service token", async () => {
    const response = await request(app).get("/internal/catalog/search?q=parle");
    assert.equal(response.status, 401);
  });

  // ---- bad input ----------------------------------------------------------------------------------

  test("bad search text or limits are refused with a 400", async () => {
    const cases = [
      "",
      "q=",
      "q=a",
      "q=%20%20",
      "q=--",
      `q=${"x".repeat(101)}`,
      "q=parle&q=maggi", // two values
      "q=parle&limit=0",
      "q=parle&limit=11",
      "q=parle&limit=abc",
    ];
    for (const queryString of cases) {
      const response = await search(queryString);
      assert.equal(response.status, 400, queryString);
      assert.equal(response.body.success, false);
    }
  });

  test("the number of matches is limited (default 5, at most 10)", async () => {
    for (let i = 1; i <= 12; i += 1) await addProduct({ name: `Parle item ${String(i).padStart(2, "0")}` });

    assert.equal((await search("q=parle")).body.data.items.length, 5);
    assert.equal((await search("q=parle&limit=2")).body.data.items.length, 2);
    assert.equal((await search("q=parle&limit=10")).body.data.items.length, 10);
  });

  test("the text helpers", () => {
    assert.equal(catalog.flatten("  Parle-G_50.g  "), "parle g 50 g");
    assert.equal(catalog.escapeLike("50%_off\\"), "50\\%\\_off\\\\");
  });
}
