import os

def get_allowed_origins() -> list[str]:
    """Retrieve allowed CORS origins from environment."""
    origins_str = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,https://ashaai-app.web.app")
    return [origin.strip() for origin in origins_str.split(",")]

ALLOWED_ORIGINS = get_allowed_origins()

# Rate limiting bounds (e.g. 100 requests per minute per UID)
RATE_LIMIT_REQUESTS = 100
RATE_LIMIT_WINDOW_SECONDS = 60
