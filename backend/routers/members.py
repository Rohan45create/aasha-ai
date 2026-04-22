from fastapi import APIRouter, Depends, HTTPException, Query
import structlog
from middleware.auth_middleware import verify_firebase_token
from firebase_admin import firestore

logger = structlog.get_logger()
router = APIRouter(prefix="/api/members", tags=["Members API"])

@router.get("/check-duplicate")
async def check_duplicate(
    aadhaar_hash: str = Query(None),
    name: str = Query(None),
    dob: str = Query(None),
    village: str = Query(None),
    user=Depends(verify_firebase_token)
):
    try:
        db = firestore.client()
        
        # Check by aadhaar_hash directly
        if aadhaar_hash:
            docs = db.collection("household_members")\
                .where("aadhaarHash", "==", aadhaar_hash)\
                .limit(1).stream()
        # Fallback to name + dob if provided
        elif name and dob:
            docs = db.collection("household_members")\
                .where("member_name", "==", name)\
                .where("date_of_birth", "==", dob)\
                .limit(1).stream()
        else:
            return {"found": False}
            
        results = [{"id": d.id, **d.to_dict()} for d in docs]
        
        if results:
            return {"found": True, "record": results[0]}
            
        return {"found": False}
    except Exception as e:
        logger.error("check_duplicate_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to check duplicate")

@router.get("/find-birth-record")
async def find_birth_record(id: str = Query(...), user=Depends(verify_firebase_token)):
    try:
        db = firestore.client()
        
        # Determine if it's aadhaar hash or a temporary ID
        id_type = "tmp" if str(id).startswith("TMP-") else "aadhaar"
        
        if id_type == "aadhaar":
            docs = db.collection("birth_records").where("aadhaarHash", "==", id).limit(1).stream()
        else:
            docs = db.collection("birth_records").where("temporaryId", "==", id).limit(1).stream()
            
        results = [{"id": d.id, **d.to_dict()} for d in docs]
        
        if results:
            return {"found": True, "record": results[0]}
            
        return {"found": False}
    except Exception as e:
        logger.error("find_birth_record_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to find birth record")

