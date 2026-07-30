import logging
from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette import status

logger = logging.getLogger(__name__)

def register_exception_handlers(app):
    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        # Log every deliberate error response (400, 403, 404, 422, etc.) too,
        # not just unhandled 500s - so the log file has a complete picture
        # of what failed and why, not just crashes.
        logger.warning(
            "HTTP %s on %s %s: %s",
            exc.status_code, request.method, request.url.path, exc.detail,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers=getattr(exc, "headers", None),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        logger.error(f"Validation error on {request.method} {request.url.path}: {exc.errors()}")
        body = exc.body
        if isinstance(body, bytes):
            body = body.decode("utf-8", errors="replace")
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "detail": f"Validation Error: {exc.errors()}",
                "body": body
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "message": "Internal Server Error",
                "path": request.url.path,
            },
        )
