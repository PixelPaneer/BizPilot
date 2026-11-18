import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { pool, withTransaction } from "../src/config/db.js";
import { DEFAULT_CATEGORIES } from "../src/constants/index.js";
import { applyStockChange } from "../src/services/stock.service.js";
import { syncAlerts } from "../src/services/alert.service.js";

const products = [
  { name: "Apple", category: "Fruits", unit: "kg", price: 180, cost: 140 },
  { name: "Banana", category: "Fruits", unit: "dozen", price: 60, cost: 45 },
  { name: "Orange", category: "Fruits", unit: "kg", price: 100, cost: 75 },
  { name: "Mango", category: "Fruits", unit: "kg", price: 160, cost: 120 },
  { name: "Grapes", category: "Fruits", unit: "kg", price: 120, cost: 90 },
  { name: "Milk", category: "Dairy", unit: "L", price: 65, cost: 54 },
  { name: "Curd", category: "Dairy", unit: "piece", price: 35, cost: 27 },
  { name: "Butter", category: "Dairy", unit: "piece", price: 58, cost: 46 },
  { name: "Paneer", category: "Dairy", unit: "kg", price: 360, cost: 300 },
  { name: "Cheese Slices", category: "Dairy", unit: "packet", price: 125, cost: 98 },
  { name: "Bread", category: "Bakery", unit: "piece", price: 40, cost: 30 },
  { name: "Burger Buns", category: "Bakery", unit: "packet", price: 45, cost: 34 },
  { name: "Rusk", category: "Bakery", unit: "packet", price: 55, cost: 42 },
  { name: "Pav", category: "Bakery", unit: "packet", price: 30, cost: 22 },
  { name: "Cake", category: "Bakery", unit: "piece", price: 80, cost: 60 },
  { name: "Potato", category: "Vegetables", unit: "kg", price: 35, cost: 25 },
  { name: "Onion", category: "Vegetables", unit: "kg", price: 40, cost: 29 },
  { name: "Tomato", category: "Vegetables", unit: "kg", price: 50, cost: 36 },
  { name: "Spinach", category: "Vegetables", unit: "packet", price: 25, cost: 18 },
  { name: "Cauliflower", category: "Vegetables", unit: "piece", price: 45, cost: 32 },
  { name: "Chicken", category: "Meat", unit: "kg", price: 280, cost: 230 },
  { name: "Eggs", category: "Meat", unit: "dozen", price: 90, cost: 72 },
  { name: "Fish", category: "Meat", unit: "kg", price: 320, cost: 265 },
  { name: "Sausages", category: "Meat", unit: "packet", price: 150, cost: 118 },
  { name: "Mineral Water", category: "Beverages", unit: "L", price: 20, cost: 12 },
  { name: "Orange Juice", category: "Beverages", unit: "L", price: 110, cost: 82 },
  { name: "Tea", category: "Beverages", unit: "packet", price: 140, cost: 110 },
  { name: "Coffee", category: "Beverages", unit: "packet", price: 220, cost: 175 },
  { name: "Parle-G", category: "Snacks", unit: "packet", price: 10, cost: 8 },
  { name: "Potato Chips", category: "Snacks", unit: "packet", price: 20, cost: 14 },
].map((product, index) => ({
  ...product,
  quantity: index % 3 === 0 ? 0 : index % 3 === 1 ? 3 : 24,
  threshold: 5,
}));

async function seedDev() {
  const passwordHash = await bcrypt.hash(
    randomBytes(32).toString("hex"),
    10
  );

  const userId = await withTransaction(async (client) => {
    let userResult = await client.query(
      `INSERT INTO app_users
         (first_name, last_name, email, password_hash, whatsapp_number)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (LOWER(email)) DO NOTHING
       RETURNING user_id`,
      ["Demo", "User", "demo@bizpilot.local", passwordHash, "9999999999"]
    );

    if (userResult.rows.length === 0) {
      userResult = await client.query(
        `SELECT user_id
           FROM app_users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1`,
        ["demo@bizpilot.local"]
      );
    }

    if (userResult.rows.length === 0) {
      throw new Error("Unable to find or create the development user.");
    }

    const ownerUserId = userResult.rows[0].user_id;

    let businessResult = await client.query(
      `SELECT business_id
         FROM businesses
        WHERE owner_user_id = $1 AND business_name = $2
        ORDER BY created_at
        LIMIT 1`,
      [ownerUserId, "Demo Kirana Store"]
    );

    if (businessResult.rows.length === 0) {
      businessResult = await client.query(
        `INSERT INTO businesses
           (owner_user_id, business_name, business_type, owner_name,
            contact_number, business_email, business_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING business_id`,
        [
          ownerUserId,
          "Demo Kirana Store",
          "Retail",
          "Demo User",
          "9999999999",
          "demo@bizpilot.local",
          "Demo address",
        ]
      );
    }

    const businessId = businessResult.rows[0].business_id;

    for (const category of [...DEFAULT_CATEGORIES, "Snacks"]) {
      if (!products.some((product) => product.category === category)) {
        throw new Error(`Seed products are missing category: ${category}`);
      }
    }

    for (const product of products) {
      const productResult = await client.query(
        `INSERT INTO products
           (business_id, product_name, category, unit, selling_price, cost_price)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (business_id, LOWER(product_name)) WHERE is_active
         DO UPDATE SET category = EXCLUDED.category,
                       unit = EXCLUDED.unit,
                       selling_price = EXCLUDED.selling_price,
                       cost_price = EXCLUDED.cost_price,
                       updated_at = CURRENT_TIMESTAMP
         RETURNING product_id`,
        [
          businessId,
          product.name,
          product.category,
          product.unit,
          product.price,
          product.cost,
        ]
      );

      await client.query(
        `INSERT INTO inventory
           (business_id, product_id, available_quantity, reorder_threshold)
         VALUES ($1, $2, 0, $3)
         ON CONFLICT (business_id, product_id)
         DO UPDATE SET reorder_threshold = EXCLUDED.reorder_threshold`,
        [
          businessId,
          productResult.rows[0].product_id,
          product.threshold,
        ]
      );
      const currentInventory = await client.query(
        `SELECT available_quantity
           FROM inventory
          WHERE business_id = $1 AND product_id = $2`,
        [businessId, productResult.rows[0].product_id]
      );
      const currentQuantity = Number(
        currentInventory.rows[0].available_quantity
      );
      const delta = product.quantity - currentQuantity;
      if (delta !== 0) {
        await applyStockChange(client, {
          businessId,
          productId: productResult.rows[0].product_id,
          delta,
          movementType: "MANUAL_ADJUSTMENT",
          source: "SYSTEM",
          userId: null,
          skipAudit: true,
        });
      } else {
        await syncAlerts(
          client,
          businessId,
          productResult.rows[0].product_id
        );
      }
    }

    return ownerUserId;
  });

  console.log(`Development user id: ${userId}`);
}

try {
  await seedDev();
} catch (error) {
  console.error("Development seed failed:", error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
