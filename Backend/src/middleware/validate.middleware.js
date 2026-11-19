import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

function validateRequest(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const errors = result.array().map(({ path, msg }) => ({ field: path, message: msg }));
    return next(new ApiError(400, "Please check the submitted information.", errors));
  }
  next();
}

export { validateRequest };
