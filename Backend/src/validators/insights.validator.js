import { ApiError } from "../utils/ApiError.js";

const ALLOWED_MODES = ["dashboard", "question"];

const ALLOWED_PERIODS = [
  "last7",
  "last30",
  "last90",
  "thisMonth",
];

export function validateInsightsRequest(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return next(new ApiError(400, "Invalid request body."));
  }

  const allowedKeys = new Set(["mode", "period", "question"]);

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) {
      return next(new ApiError(400, `Unexpected field: ${key}`));
    }
  }

  const { mode, period = "last30", question } = body;

  if (!ALLOWED_MODES.includes(mode)) {
    return next(
      new ApiError(400, "mode must be dashboard or question.")
    );
  }

  if (!ALLOWED_PERIODS.includes(period)) {
    return next(
      new ApiError(400, "Invalid analytics period.")
    );
  }

  if (mode === "question") {
    if (
      typeof question !== "string" ||
      question.trim().length === 0 ||
      question.trim().length > 500
    ) {
      return next(
        new ApiError(
          400,
          "A question between 1 and 500 characters is required."
        )
      );
    }
  }

  if (question !== undefined && typeof question !== "string") {
    return next(new ApiError(400, "question must be a string."));
  }

  if (mode === "dashboard" && question !== undefined) {
    return next(
      new ApiError(400, "question is not allowed in dashboard mode.")
    );
  }

  req.insightsRequest = {
    mode,
    period,
    ...(mode === "question" ? { question: question.trim() } : {}),
  };

  next();
}
