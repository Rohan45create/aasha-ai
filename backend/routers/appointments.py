from fastapi import APIRouter, Depends, Body, HTTPException
from typing import Optional
from datetime import datetime
from google.cloud import firestore
import structlog
from middleware.auth_middleware import verify_firebase_token

logger = structlog.get_logger()
router = APIRouter(prefix="/api/appointments", tags=["appointments"])

@router.post("/schedule")
async def schedule_appointment(
    payload: dict = Body(...),
    user=Depends(verify_firebase_token)
):
    try:
        db = firestore.Client()
        
        appointment_data = {
            "ashaId": payload.get("ashaId"),
            "targetType": payload.get("targetType"),
            "targetId": payload.get("targetId"),
            "targetName": payload.get("targetName"),
            "scheduledDate": payload.get("scheduledDate"),
            "scheduledTime": payload.get("scheduledTime"),
            "purpose": payload.get("purpose", ""),
            "notes": payload.get("notes", ""),
            "status": "scheduled",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "completedAt": None,
            "reminderSent": False
        }
        
        doc_ref = db.collection("appointments").document()
        doc_ref.set(appointment_data)
        
        # Optionally schedule FCM notification here or have a scheduled Cloud Function do it daily
        logger.info("appointment_scheduled", appointment_id=doc_ref.id, asha_id=payload.get("ashaId"))
        
        return {"appointmentId": doc_ref.id}
    except Exception as e:
        logger.error("schedule_appointment_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error scheduling appointment")

@router.get("/upcoming/{asha_id}")
async def get_upcoming_appointments(asha_id: str, user=Depends(verify_firebase_token)):
    try:
        db = firestore.Client()
        today = datetime.now().strftime("%Y-%m-%d")
        
        docs = db.collection("appointments") \
            .where("ashaId", "==", asha_id) \
            .stream()
            
        appointments = []
        for doc in docs:
            d = doc.to_dict()
            if d.get("scheduledDate", "") >= today and d.get("status") == "scheduled":
                appointments.append({"id": doc.id, **d})
                
        # Sort by scheduledDate ASC in memory
        appointments.sort(key=lambda x: x.get("scheduledDate", ""))
        
        # Limit to 20
        appointments = appointments[:20]
            
        return appointments
    except Exception as e:
        logger.error("get_upcoming_appointments_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error fetching upcoming appointments")

@router.patch("/{appointment_id}/complete")
async def complete_appointment(
    appointment_id: str,
    payload: dict = Body(...),
    user=Depends(verify_firebase_token)
):
    try:
        db = firestore.Client()
        db.collection("appointments").document(appointment_id).update({
            "status": "completed",
            "notes": payload.get("notes", ""),
            "completedAt": firestore.SERVER_TIMESTAMP
        })
        
        logger.info("appointment_completed", appointment_id=appointment_id)
        return {"success": True}
    except Exception as e:
        logger.error("complete_appointment_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error completing appointment")
