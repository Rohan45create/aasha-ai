from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
import structlog

logger = structlog.get_logger()
security = HTTPBearer()

def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
        
        # Fallback for seeded users who don't have custom claims yet
        if not decoded_token.get("role"):
            from firebase_admin import firestore
            db = firestore.client()
            email = decoded_token.get("email")
            if email:
                head_docs = list(db.collection("asha_heads").where("email", "==", email).limit(1).stream())
                if head_docs:
                    decoded_token["role"] = "asha_head"
                else:
                    # Dev fallback: anyone with an email is considered an admin/head
                    decoded_token["role"] = "asha_head"
            else:
                # Check if they are an ASHA worker
                asha_docs = list(db.collection("ashas").where("phone", "==", decoded_token.get("phone_number")).limit(1).stream())
                if asha_docs:
                    decoded_token["role"] = "asha_worker"
        
        return decoded_token
    except Exception as e:
        logger.error("invalid_token_error", error=str(e))
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_role(*required_roles: str):
    """Role-based access control dependency."""
    async def check_role(user: dict = Depends(verify_firebase_token)) -> dict:
        user_role = user.get("role") or user.get("custom_claims", {}).get("role")
        
        # Admin override
        if user_role == "admin":
            return user
            
        if not user_role or user_role not in required_roles:
            # Fallback for demo admin
            if user.get("email") == "admin@asha.gov.in" and "asha_head" in required_roles:
                return user
            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {required_roles}",
            )
        return user
    return check_role
