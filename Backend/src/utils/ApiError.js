
export class ApiError extends Error {
  constructor(statusCode, message = "Something went wrong", errors = [], code) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.success = false;
    this.errors = errors;
    if (code !== undefined) {
      this.code = code;
    }
    this.isOperational = true;

    Error.captureStackTrace?.(this, this.constructor);
  }
}
