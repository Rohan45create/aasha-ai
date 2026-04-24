from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
import structlog
import time

logger = structlog.get_logger()

class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Do not log query params or body which might contain PHI
        logger.info(
            "request_started",
            method=request.method,
            path=request.url.path,
        )
        
        try:
            response = await call_next(request)
            process_time = time.time() - start_time
            logger.info(
                "request_completed",
                method=request.method,
                path=request.url.path,
                status_code=response.status_code,
                process_time=process_time
            )
            return response
        except Exception as e:
            process_time = time.time() - start_time
            logger.error(
                "request_failed",
                method=request.method,
                path=request.url.path,
                error=str(e),
                process_time=process_time
            )
            raise e
