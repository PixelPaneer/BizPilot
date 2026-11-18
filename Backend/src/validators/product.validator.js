import { body, param, query } from "express-validator";
import { STOCK_STATUS, UNITS } from "../constants/index.js";
import { validate } from "../middleware/validate.middleware.js";

const SORT_OPTIONS = ["newest", "name", "price_asc", "price_desc", "quantity"];
const PRODUCT_FIELDS = [
  "name",
  "category",
  "unit",
  "price",
  "costPrice",
  "quantity",
  "lowStockThreshold",
];

function isNonNegativeNumber(value, decimalPlaces) {
  const scaled = value * 10 ** decimalPlaces;
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    Math.abs(scaled - Math.round(scaled)) < 1e-8
  );
}

function isProductObject(value, requiredFields = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Body must be an object");
  }
  if (Object.keys(value).some((field) => !PRODUCT_FIELDS.includes(field))) {
    throw new Error("Unknown product field");
  }
  if (requiredFields.some((field) => !Object.hasOwn(value, field))) {
    throw new Error("Required product fields are missing");
  }
  return true;
}

export const validateCreateProduct = [
  body().custom((value) =>
    isProductObject(value, [
      "name",
      "category",
      "unit",
      "price",
      "quantity",
      "lowStockThreshold",
    ])
  ),
  body("name")
    .isString()
    .bail()
    .trim()
    .customSanitizer((value) => value.replace(/\s+/g, " "))
    .isLength({ min: 1, max: 150 }),
  body("category").isString().bail().trim().isLength({ min: 1, max: 100 }),
  body("unit").isString().bail().isIn(UNITS),
  body("price").custom((value) => isNonNegativeNumber(value, 2)),
  body("costPrice")
    .optional({ nullable: true })
    .custom((value) => isNonNegativeNumber(value, 2)),
  body("quantity").custom((value) => isNonNegativeNumber(value, 3)),
  body("lowStockThreshold").custom((value) =>
    isNonNegativeNumber(value, 3)
  ),
  validate,
];

export const validateUpdateProduct = [
  body().custom((value) => {
    isProductObject(value);
    if (Object.keys(value).length === 0) {
      throw new Error("At least one product field is required");
    }
    return true;
  }),
  body("name")
    .optional()
    .isString()
    .bail()
    .trim()
    .customSanitizer((value) => value.replace(/\s+/g, " "))
    .isLength({ min: 1, max: 150 }),
  body("category")
    .optional()
    .isString()
    .bail()
    .trim()
    .isLength({ min: 1, max: 100 }),
  body("unit").optional().isString().bail().isIn(UNITS),
  body("price")
    .optional()
    .custom((value) => isNonNegativeNumber(value, 2)),
  body("costPrice")
    .optional({ nullable: true })
    .custom((value) => isNonNegativeNumber(value, 2)),
  body("quantity")
    .optional()
    .custom((value) => isNonNegativeNumber(value, 3)),
  body("lowStockThreshold")
    .optional()
    .custom((value) => isNonNegativeNumber(value, 3)),
  validate,
];

export const validateProductListQuery = [
  query("status").optional().isIn(STOCK_STATUS),
  query("sort").optional().isIn(SORT_OPTIONS),
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 500 }).toInt(),
  query("search").optional().isString().trim().isLength({ max: 150 }),
  query("category").optional().isString().trim().isLength({ max: 100 }),
  validate,
];

export const validateProductSearchQuery = [
  query("q").isString().trim().notEmpty().isLength({ max: 150 }),
  query("limit").optional().isInt({ min: 1, max: 20 }).toInt(),
  validate,
];

export const validateProductId = [
  param("id").isUUID(),
  validate,
];
