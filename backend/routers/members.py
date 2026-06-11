from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
import structlog
from middleware.auth_middleware import verify_firebase_token
from firebase_admin import firestore

class CheckLinkageRequest(BaseModel):
    aadhaar_last4: str
    module_type: str

class ConfirmLinkageRequest(BaseModel):
    record_collection: str
    record_id: str
    household_id: str
    member_id: str

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

@router.post("/check-linkage")
async def check_linkage(
    payload: CheckLinkageRequest,
    user=Depends(verify_firebase_token)
):
    from services.linkage_service import check_aadhaar_linkage
    try:
        asha_id = user.get("doc_id") or user.get("uid")
        if not asha_id:
            raise HTTPException(status_code=403, detail="No ASHA ID found in token")
        
        result = await check_aadhaar_linkage(payload.aadhaar_last4, asha_id, payload.module_type)
        return result
    except Exception as e:
        logger.error("check_linkage_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to check linkage")

@router.post("/confirm-linkage")
async def confirm_linkage(
    payload: ConfirmLinkageRequest,
    user=Depends(verify_firebase_token)
):
    from services.linkage_service import link_record_to_family
    try:
        asha_id = user.get("doc_id") or user.get("uid")
        if not asha_id:
            raise HTTPException(status_code=403, detail="No ASHA ID found in token")
            
        success = await link_record_to_family(
            record_collection=payload.record_collection,
            record_id=payload.record_id,
            household_id=payload.household_id,
            member_id=payload.member_id,
            linked_by_asha=asha_id
        )
        if success:
            return {"success": True}
        return {"success": False, "error": "Internal database update failed"}
    except Exception as e:
        logger.error("confirm_linkage_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to confirm linkage")

