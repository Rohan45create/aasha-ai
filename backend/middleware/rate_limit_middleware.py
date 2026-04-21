from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from collections import defaultdict
import time

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, calls_per_minute: int = 100):
        super().__init__(app)
        self.calls_per_minute = calls_per_minute
        self.requests = defaultdict(list)
    
    async def dispatch(self, request: Request, call_next):
        if request.url.path in ["/health", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        uid = request.headers.get("Authorization", request.client.host)[:20]
        now = time.time()
        self.requests[uid] = [t for t in self.requests[uid] if now - t < 60]
        
        limit = 10 if "/auth" in request.url.path else self.calls_per_minute
        if len(self.requests[uid]) >= limit:
            return JSONResponse(
                {"detail": "Rate limit exceeded. Max requests per minute reached."},
                status_code=429
            )
        self.requests[uid].append(now)
        return await call_next(request)
