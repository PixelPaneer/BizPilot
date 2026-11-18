import { validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

export function validate(req, res, next) {
  const result = validationResult(req);

  if (!result.isEmpty()) {
    const errors = result.array().map((error) => ({
      field: error.path ?? error.param,
      message: error.msg,
    }));

    return next(
      new ApiError(400, "Validation failed", errors, "VALIDATION_ERROR")
    );
  }

  return next();
}
