import { body, param } from "express-validator";
import { BILL_SOURCES } from "../constants/index.js";
import { validate } from "../middleware/validate.middleware.js";

function decimalsOk(value, places) {
  const scaled = value * 10 ** places;
  return Math.abs(scaled - Math.round(scaled)) < 1e-8;
}

function isPositiveQuantity(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && decimalsOk(value, 3);
}

function isPrice(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && decimalsOk(value, 2);
}

// Checks the shape of a sale / purchase body: only known fields, 1 to 100 lines, known line
// fields, and no product listed twice.
function checkBillBody(allowedFields) {
  return (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Body must be an object");
    }
    if (Object.keys(value).some((field) => !allowedFields.includes(field))) {
      throw new Error("Unknown field in request");
    }
    if (!Array.isArray(value.lines) || value.lines.length < 1 || value.lines.length > 100) {
      throw new Error("lines must contain 1 to 100 items");
    }
    const seen = new Set();
    for (const line of value.lines) {
      if (!line || typeof line !== "object" || Array.isArray(line)) {
        throw new Error("Each line must be an object");
      }
      if (Object.keys(line).some((field) => !["productId", "quantity", "unitPrice"].includes(field))) {
        throw new Error("Unknown field in a line");
      }
      if (seen.has(line.productId)) {
        throw new Error("A product can only appear once per entry");
      }
      seen.add(line.productId);
    }
    return true;
  };
}

const lineRules = [
  body("lines.*.productId").isUUID(),
  body("lines.*.quantity").custom(isPositiveQuantity),
  body("lines.*.unitPrice").custom(isPrice),
];

const commonRules = [
  body("idempotencyKey").isString().bail().trim().isLength({ min: 8, max: 150 }),
  body("source").optional().isIn(BILL_SOURCES),
];

export const validateRecordSale = [
  body().custom(checkBillBody(["idempotencyKey", "source", "allowOversell", "lines"])),
  ...commonRules,
  body("allowOversell")
    .optional()
    .custom((value) => typeof value === "boolean"),
  ...lineRules,
  validate,
];

export const validateRecordPurchase = [
  body().custom(checkBillBody(["idempotencyKey", "source", "lines"])),
  ...commonRules,
  ...lineRules,
  validate,
];

export const validateVoidSale = [
  param("id").isUUID(),
  body().custom((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Body must be an object");
    }
    if (Object.keys(value).some((field) => field !== "reason")) {
      throw new Error("Unknown field in request");
    }
    return true;
  }),
  body("reason").isString().bail().trim().isLength({ min: 3, max: 200 }),
  validate,
];
