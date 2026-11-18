
export function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  const response = {
    success: false,
    message:
      statusCode === 500
        ? "Internal server error"
        : err.message,
    errors: err.errors || [],
  };

  if (err.code !== undefined) {
    response.code = err.code;
  }

  res.status(statusCode).json(response);
}
