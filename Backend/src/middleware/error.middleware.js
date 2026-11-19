import ApiError from "../utils/ApiError.js";

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

function errorHandler(error, req, res, next) {
  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal server error.";
  let errors = error.errors || null;

  if (error.code === "23505") {
    statusCode = 409;
    message = "A record with this information already exists.";
  } else if (error.code === "23503") {
    statusCode = 400;
    message = "The request references a record that does not exist.";
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    statusCode,
    message: statusCode === 500 && process.env.NODE_ENV === "production"
      ? "Something went wrong."
      : message,
    errors
  });
}

export { notFound, errorHandler };
