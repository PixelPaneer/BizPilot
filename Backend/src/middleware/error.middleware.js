import ApiError from "../utils/ApiError.js";

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal server error.";
  let errors = error.errors || [];

  if (error.code === "23505") {
    statusCode = 409;
    message = "A record with this information already exists.";
  } else if (error.code === "23503") {
    statusCode = 400;
    message = "The request references a record that does not exist.";
  }

  if (statusCode >= 500 || process.env.NODE_ENV !== "production") console.error(error);

  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Internal server error"
      : message,
    errors,
  });
}

export { notFound, errorHandler };
