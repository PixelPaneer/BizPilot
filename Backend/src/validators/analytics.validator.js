
import { ApiError } from "../utils/ApiError.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function validateAnalyticsQuery(req, res, next) {
  const { period = "last30", startDate, endDate, limit } = req.query;

  // 1. Reject duplicate or non-string query parameters.
  for (const [key, value] of Object.entries(req.query)) {
    if (Array.isArray(value) || typeof value !== "string") {
      return next(
        new ApiError(400, `Invalid query parameter: ${key}`)
      );
    }
  }

  // 2. Validate allowed periods.
  const allowedPeriods = [
    "last7",
    "last30",
    "last90",
    "thisMonth",
    "custom",
  ];

  if (!allowedPeriods.includes(period)) {
    return next(
      new ApiError(
        400,
        "period must be last7, last30, last90, thisMonth, or custom"
      )
    );
  }

  // 3. Validate top-products limit.
  if (limit !== undefined) {
    const parsedLimit = Number(limit);

    if (
      limit.trim() === "" ||
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 50
    ) {
      return next(
        new ApiError(400, "limit must be between 1 and 50")
      );
    }
  }

  // 4. Validate custom date range.
  if (period === "custom") {
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return next(
        new ApiError(
          400,
          "Valid startDate and endDate are required in YYYY-MM-DD format"
        )
      );
    }

    if (startDate > endDate) {
      return next(
        new ApiError(
          400,
          "startDate must be on or before endDate"
        )
      );
    }
  }

  // 5. Reject custom dates with non-custom periods.
  if (
    period !== "custom" &&
    (startDate !== undefined || endDate !== undefined)
  ) {
    return next(
      new ApiError(
        400,
        "startDate and endDate are only allowed with custom period"
      )
    );
  }

  // 6. Continue to analytics controller.
  next();
}
