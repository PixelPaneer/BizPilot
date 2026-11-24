import { query } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";

// q: the words to look for (a customer's wording of a product name); limit: how many matches.
export const validateCatalogSearch = [
  query("q")
    .isString()
    .withMessage("q is required.")
    .bail()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("q must be 2 to 100 characters."),
  query("limit").optional().isInt({ min: 1, max: 10 }).withMessage("limit must be 1 to 10.").toInt(),
  validate,
];
