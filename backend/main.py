import os
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin

# Import middleware and configs
from middleware.logging_middleware import LoggingMiddleware
from middleware.auth_middleware import verify_firebase_token
from config.firebase_config import initialize_firebase
from config.gemini_config import configure_gemini

# Import routers
from routers.modules import family_survey
from routers import risk, voice, admin, vision, ambient, security, register, members, chat, translate

# Initialize External Services
initialize_firebase()
configure_gemini()

app = FastAPI(
    title="AshaAI Backend",
    version="1.0.0",
    description="Backend API for the AshaAI Digital Companion"
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Apply Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT"],  # No DELETE — data is permanent
    allow_headers=["Authorization", "Content-Type"],
)
app.add_middleware(LoggingMiddleware)

# Include Routers — all require Firebase token
app.include_router(family_survey.router, dependencies=[Depends(verify_firebase_token)])
app.include_router(risk.router, dependencies=[Depends(verify_firebase_token)])
app.include_router(voice.router, dependencies=[Depends(verify_firebase_token)])
app.include_router(vision.router, dependencies=[Depends(verify_firebase_token)])
app.include_router(admin.router, dependencies=[Depends(verify_firebase_token)])
app.include_router(register.router, dependencies=[Depends(verify_firebase_token)])
app.include_router(members.router, dependencies=[Depends(verify_firebase_token)])
app.include_router(chat.router, dependencies=[Depends(verify_firebase_token)])
app.include_router(translate.router, dependencies=[Depends(verify_firebase_token)])


# Ambient AI WebSocket — authenticates internally via query param
app.include_router(ambient.router)
app.include_router(security.router)

# Public endpoint
@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}

from middleware.rate_limit_middleware import RateLimitMiddleware
app.add_middleware(RateLimitMiddleware, calls_per_minute=100)

import structlog
from starlette.responses import JSONResponse
log = structlog.get_logger()

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    log.error("unhandled_exception",
        path=str(request.url.path),
        method=request.method,
        error_type=type(exc).__name__
    )
    return JSONResponse(status_code=500,
        content={"detail": "Internal server error. Please try again."})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
