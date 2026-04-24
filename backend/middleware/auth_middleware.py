from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
import structlog

logger = structlog.get_logger()
security = HTTPBearer()

def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
        return decoded_token
    except Exception as e:
        logger.error("invalid_token_error", error=str(e))
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_role(required_role: str):
    """Role-based access control dependency."""
    async def check_role(user: dict = Depends(verify_firebase_token)) -> dict:
        user_role = user.get("role") or user.get("custom_claims", {}).get("role")
        if not user_role or user_role != required_role:
            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {required_role}",
            )
        return user
    return check_role
