"""One error type for the whole service, shaped like the Node backend's errors:
{ "success": false, "message": ..., "errors": [], "code": ... }."""


class ApiError(Exception):
    def __init__(self, status_code: int, message: str, code: str, errors: list | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.message = message
        self.code = code
        self.errors = errors or []
