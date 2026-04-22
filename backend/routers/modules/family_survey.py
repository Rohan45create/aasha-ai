from fastapi import APIRouter, Depends, HTTPException
from models.family_survey import FamilyMemberRecord
from middleware.auth_middleware import verify_firebase_token
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/family-survey", tags=["Family Survey"])

@router.post("/")
async def create_or_update_family_member(record: FamilyMemberRecord, decoded_token: dict = Depends(verify_firebase_token)):
    # To be implemented with Firestore Service
    logger.info("received_family_member_record", asha_id=record.asha_id, household_id=record.household_id)
    return {"status": "success", "message": "Record saved successfully."}

@router.get("/{household_id}")
async def get_family_members(household_id: str, decoded_token: dict = Depends(verify_firebase_token)):
    # To be implemented with Firestore Service
    return {"status": "success", "data": []}
