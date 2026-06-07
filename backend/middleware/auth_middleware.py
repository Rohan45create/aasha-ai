from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth
import structlog
from services import redis_service

logger = structlog.get_logger()
security = HTTPBearer()

_identity_cache = {}

async def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        decoded_token = auth.verify_id_token(credentials.credentials, clock_skew_seconds=60)
        uid = decoded_token["uid"]

        # Layer 1: in-memory cache
        cached = _identity_cache.get(uid)
        if cached:
            decoded_token["doc_id"] = cached["doc_id"]
            decoded_token["role"] = cached["role"]
            return decoded_token

        # Layer 2: Redis cache
        redis_cached = await redis_service.get_identity(uid)
        if redis_cached:
            _identity_cache[uid] = redis_cached  # warm local cache
            decoded_token["doc_id"] = redis_cached["doc_id"]
            decoded_token["role"] = redis_cached["role"]
            return decoded_token

        from firebase_admin import firestore
        db = firestore.client()

        # Direct UID lookups first
        doc = db.collection("ashas").document(uid).get()
        if doc.exists:
            _identity_cache[uid] = {"doc_id": uid, "role": doc.to_dict().get("role", "asha_worker")}
        else:
            doc = db.collection("asha_heads").document(uid).get()
            if doc.exists:
                _identity_cache[uid] = {"doc_id": uid, "role": doc.to_dict().get("role", "asha_head")}
            else:
                doc = db.collection("medical_officers").document(uid).get()
                if doc.exists:
                    _identity_cache[uid] = {"doc_id": uid, "role": doc.to_dict().get("role", "medical_officer")}

        # If direct lookup failed, try email and phone
        if uid not in _identity_cache:
            resolved = False
            phone = decoded_token.get("phone_number")
            email = decoded_token.get("email")

            if phone:
                from google.cloud.firestore_v1.base_query import FieldFilter
                ashas = db.collection("ashas").where(filter=FieldFilter("phone", "==", phone)).limit(1).get()
                if ashas:
                    _identity_cache[uid] = {"doc_id": ashas[0].id, "role": ashas[0].to_dict().get("role", "asha_worker")}
                    resolved = True
                else:
                    short_phone = phone.replace("+91", "")
                    ashas = db.collection("ashas").where(filter=FieldFilter("phone", "==", short_phone)).limit(1).get()
                    if ashas:
                        _identity_cache[uid] = {"doc_id": ashas[0].id, "role": ashas[0].to_dict().get("role", "asha_worker")}
                        resolved = True
            
            if not resolved and email:
                heads = db.collection("asha_heads").where(filter=FieldFilter("email", "==", email)).limit(1).get()
                if heads:
                    _identity_cache[uid] = {"doc_id": heads[0].id, "role": heads[0].to_dict().get("role", "asha_head")}
                    resolved = True
            
            # Demo fallbacks
            if not resolved:
                if email:
                    heads = db.collection("asha_heads").limit(1).get()
                    if heads:
                        _identity_cache[uid] = {"doc_id": heads[0].id, "role": heads[0].to_dict().get("role", "asha_head")}
                        resolved = True
                elif phone:
                    ashas = db.collection("ashas").limit(1).get()
                    if ashas:
                        _identity_cache[uid] = {"doc_id": ashas[0].id, "role": ashas[0].to_dict().get("role", "asha_worker")}
                        resolved = True
            
            if uid not in _identity_cache:
                return decoded_token

        identity = _identity_cache[uid]
        doc_id = identity["doc_id"]
        role = identity["role"]
        
        # After Firestore hit — write to both caches:
        _identity_cache[uid] = {"doc_id": doc_id, "role": role}
        await redis_service.set_identity(uid, doc_id, role)  # fire and forget
        
        decoded_token["doc_id"] = doc_id
        decoded_token["role"] = role
        
        return decoded_token
    except HTTPException:
        raise
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
            raise HTTPException(
                status_code=403,
                detail=f"Requires role: {required_roles}",
            )
        return user
    return check_role
