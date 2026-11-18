import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { errorMiddleware } from "../../src/middleware/error.middleware.js";
import {
  validateCreateProduct,
  validateUpdateProduct,
} from "../../src/validators/product.validator.js";
import {
  validateInventoryAdjustment,
} from "../../src/validators/inventory.validator.js";

function validationApp(method, path, validators) {
  const app = express();
  app.use(express.json());
  app[method](path, validators, (req, res) =>
    res.json({ success: true, data: req.body })
  );
  app.use(errorMiddleware);
  return app;
}

test("product write validators normalize names and allow nullable cost price", async () => {
  const app = validationApp("post", "/", validateCreateProduct);
  const response = await request(app).post("/").send({
    name: "  Fresh   Milk ",
    category: " Dairy ",
    unit: "L",
    price: 10.25,
    costPrice: null,
    quantity: 0.125,
    lowStockThreshold: 1,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.data.name, "Fresh Milk");
  assert.equal(response.body.data.category, "Dairy");
  assert.equal(response.body.data.costPrice, null);
});

test("product write validators reject invalid precision and empty patches", async () => {
  const createApp = validationApp("post", "/", validateCreateProduct);
  const invalidQuantity = await request(createApp).post("/").send({
    name: "Milk",
    category: "Dairy",
    unit: "L",
    price: 10,
    quantity: 0.1234,
    lowStockThreshold: 1,
  });
  assert.equal(invalidQuantity.status, 400);
  assert.equal(invalidQuantity.body.code, "VALIDATION_ERROR");

  const patchApp = validationApp("patch", "/", validateUpdateProduct);
  const emptyPatch = await request(patchApp).patch("/").send({});
  assert.equal(emptyPatch.status, 400);
});

test("inventory adjustment validator accepts one form and rejects invalid combinations", async () => {
  const app = validationApp("patch", "/", validateInventoryAdjustment);
  const valid = await request(app)
    .patch("/")
    .send({ type: "remove", amount: 1.25, reason: "DAMAGE" });
  assert.equal(valid.status, 200);

  const bothForms = await request(app)
    .patch("/")
    .send({ type: "add", amount: 2, quantity: 10 });
  const neitherForm = await request(app).patch("/").send({});
  const invalidDamage = await request(app)
    .patch("/")
    .send({ type: "add", amount: 2, reason: "DAMAGE" });
  assert.equal(bothForms.status, 400);
  assert.equal(neitherForm.status, 400);
  assert.equal(invalidDamage.status, 400);
});
