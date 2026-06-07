from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from collections import defaultdict
import time
from services import redis_service

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, calls_per_minute: int = 100):
        super().__init__(app)
        self.calls_per_minute = calls_per_minute
        self.requests = defaultdict(list)
    
    async def dispatch(self, request: Request, call_next):
        if request.url.path in ["/health", "/docs", "/openapi.json"] or request.url.path.startswith("/api/auth/") or request.url.path.startswith("/api/admin/auth/"):
            return await call_next(request)
        
        uid = request.headers.get("Authorization", request.client.host if request.client else "unknown")[:30]

        limit = 10 if "/auth" in request.url.path else self.calls_per_minute

        # Try Redis first (shared across all Cloud Run instances)
        try:
            redis_allowed = await redis_service.check_rate_limit(uid, limit=limit)
            if not redis_allowed:
                return JSONResponse(
                    {"detail": "Rate limit exceeded. Please wait before retrying.",
                     "code": "RATE_LIMITED"},
                    status_code=429
                )
        except Exception:
            # Redis unavailable — fall back to in-memory
            now = time.time()
            self.requests[uid] = [t for t in self.requests[uid] if now - t < 60]
            if len(self.requests[uid]) >= limit:
                return JSONResponse(
                    {"detail": "Rate limit exceeded. Please wait before retrying.",
                     "code": "RATE_LIMITED"},
                    status_code=429
                )
            self.requests[uid].append(now)
        return await call_next(request)
