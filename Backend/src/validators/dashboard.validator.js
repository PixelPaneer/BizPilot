import { query } from "express-validator";
import { validate } from "../middleware/validate.middleware.js";

export const validateSummaryQuery = [
  query("period").optional().isIn(["this_week", "this_month", "this_year"]),
  validate,
];

export const validateActivityQuery = [
  query("limit").optional().isInt({ min: 1, max: 20 }).toInt(),
  validate,
];
