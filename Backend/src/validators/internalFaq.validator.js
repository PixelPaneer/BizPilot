
import { query } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";

export const validateFaqSearch = [
  query("q")
    .isString()
    .withMessage("q is required.")
    .bail()
    .trim()
    .isLength({ min: 2, max: 300 })
    .withMessage("q must be between 2 and 300 characters."),

  query("language")
    .optional()
    .isString()
    .bail()
    .trim()
    .matches(/^[a-z]{2,10}(-[a-z0-9]{2,8})?$/i)
    .withMessage("Invalid language format.")
    .toLowerCase(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("limit must be between 1 and 5.")
    .toInt(),

  validate,
];
