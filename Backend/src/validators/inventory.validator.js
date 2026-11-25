import { body, param, query } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";
import { validateProductListQuery } from "./product.validator.js";

export const validateInventoryListQuery = validateProductListQuery;

export const validateInventoryExport = [
  param("format").isIn(["csv", "pdf"]),
  ...validateInventoryListQuery,
];

// days: how many days of sales the pace is judged on; limit: how many suggestions to return.
export const validateReorderQuery = [
  query("days").optional().isInt({ min: 7, max: 90 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 50 }).toInt(),
  validate,
];

export const validateAlertQuery = [
  query("status").optional().isIn(["ACTIVE", "RESOLVED"]),
  validate,
];

function isQuantity(value, allowZero) {
  const scaled = value * 1000;
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    (allowZero ? value >= 0 : value > 0) &&
    Math.abs(scaled - Math.round(scaled)) < 1e-8
  );
}

export const validateInventoryAdjustment = [
  body().custom((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Body must be an object");
    }

    const hasQuantity = Object.hasOwn(value, "quantity");
    const hasType = Object.hasOwn(value, "type");
    const hasAmount = Object.hasOwn(value, "amount");
    if (hasQuantity === (hasType || hasAmount) || hasType !== hasAmount) {
      throw new Error("Provide either an adjustment or an exact quantity");
    }
    if (Object.keys(value).some(
      (field) => !["type", "amount", "quantity", "reason"].includes(field)
    )) {
      throw new Error("Unknown inventory adjustment field");
    }
    if (hasQuantity && value.reason !== undefined && value.reason !== "CORRECTION") {
      throw new Error("Exact quantity adjustments must use CORRECTION");
    }
    if (value.reason === "DAMAGE" && value.type !== "remove") {
      throw new Error("DAMAGE is only valid for a removal");
    }
    return true;
  }),
  body("type").optional().isIn(["add", "remove"]),
  body("amount")
    .optional()
    .custom((value) => isQuantity(value, false)),
  body("quantity")
    .optional()
    .custom((value) => isQuantity(value, true)),
  body("reason")
    .optional()
    .isIn(["MANUAL_ADJUSTMENT", "DAMAGE", "CORRECTION"]),
  validate,
];

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export const validateInventoryHistoryQuery = [
  query("from").optional().custom(isValidDate),
  query("to")
    .optional()
    .custom(isValidDate)
    .bail()
    .custom((to, { req }) => !req.query.from || req.query.from <= to),
  query("limit").optional().isInt({ min: 1, max: 200 }).toInt(),
  validate,
];
