from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from firebase_admin import firestore, messaging
from middleware.auth_middleware import verify_firebase_token
import os
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/ngo", tags=["NGO Integration"])
public_router = APIRouter(prefix="/api/ngo", tags=["NGO Integration Public"])

@router.get("/list/{asha_id}")
async def list_ngos(asha_id: str, decoded_token: dict = Depends(verify_firebase_token)):
    """List all NGOs (or filtered by asha_id if we want mapping)"""
    try:
        db = firestore.client()
        # For simplicity, returning all NGOs right now as an ASHA might visit any nearby
        docs = db.collection("ngos").stream()
        results = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        return {"ngos": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/appointment/schedule")
async def schedule_ngo_appointment(data: dict, decoded_token: dict = Depends(verify_firebase_token)):
    """Schedule a bulk NGO appointment for an ASHA"""
    try:
        db = firestore.client()
        asha_id = data.get("ashaId")
        ngo_id = data.get("ngoId")
        scheduled_date_str = data.get("scheduledDate")
        
        if not all([asha_id, ngo_id, scheduled_date_str]):
            raise HTTPException(status_code=400, detail="Missing required fields")
            
        scheduled_date = datetime.fromisoformat(scheduled_date_str.replace("Z", "+00:00"))
        
        # Get NGO details
        ngo_ref = db.collection("ngos").document(ngo_id).get()
        if not ngo_ref.exists:
            raise HTTPException(status_code=404, detail="NGO not found")
        ngo_data = ngo_ref.to_dict()
        
        appointment_doc = {
            "ashaId": asha_id,
            "ngoId": ngo_id,
            "ngoName": ngo_data.get("name", "Unknown NGO"),
            "ngoAddress": ngo_data.get("address", ""),
            "scheduledDate": scheduled_date,
            "status": "upcoming",
            "type": "bulk_orphan_visit",
            "createdAt": firestore.SERVER_TIMESTAMP
        }
        
        _, doc_ref = db.collection("ngo_appointments").add(appointment_doc)
        
        # Create notification for ASHA
        db.collection("notifications").add({
            "userId": asha_id,
            "title": "New NGO Visit Scheduled",
            "message": f"You have a scheduled visit to {ngo_data.get('name')} on {scheduled_date.strftime('%Y-%m-%d')}.",
            "type": "ngo_appointment",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "read": False
        })
        
        return {"id": doc_ref.id, "message": "Appointment scheduled"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/appointment/{appointment_id}/complete")
async def complete_ngo_appointment(appointment_id: str, data: dict, decoded_token: dict = Depends(verify_firebase_token)):
    """Mark NGO appointment as completed and record children"""
    try:
        db = firestore.client()
        ref = db.collection("ngo_appointments").document(appointment_id)
        if not ref.get().exists:
            raise HTTPException(status_code=404, detail="Appointment not found")
            
        ref.update({
            "status": "completed",
            "completedAt": firestore.SERVER_TIMESTAMP,
            "notes": data.get("notes", "")
        })
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/children/{ngo_id}")
async def get_ngo_children(ngo_id: str, decoded_token: dict = Depends(verify_firebase_token)):
    """Get all orphan children assigned to an NGO"""
    try:
        db = firestore.client()
        docs = db.collection("children").where("ngoId", "==", ngo_id).stream()
        results = [{"id": doc.id, **doc.to_dict()} for doc in docs]
        return {"children": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# PART A: PUBLIC NGO ENDPOINTS
# ==========================================

class FormSubmissionPayload(BaseModel):
    form_type: str
    ngo_email: str
    ngo_name: Optional[str] = None
    contact_person: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    village: Optional[str] = None
    district: Optional[str] = None
    children_count: Optional[int] = None
    ngo_type: Optional[str] = None
    message: Optional[str] = None
    request_type: Optional[str] = None
    preferred_date_1: Optional[str] = None
    preferred_date_2: Optional[str] = None
    google_form_secret: str

@public_router.post("/form-submission")
async def form_submission(payload: FormSubmissionPayload):
    """Receive NGO registration from Google Form webhook"""
    GOOGLE_FORM_SECRET = os.getenv("GOOGLE_FORM_SECRET")
    
    if payload.google_form_secret != GOOGLE_FORM_SECRET:
        raise HTTPException(403, "Invalid secret")
        
    db = firestore.client()
    
    if payload.form_type == "new_ngo":
        # Check if NGO with this email already exists
        existing = db.collection("ngos").where("email", "==", payload.ngo_email).limit(1).stream()
        if list(existing):
            return {"status": "duplicate", "message": "NGO already registered"}

        # Create pending review for admin
        db.collection("pending_reviews").add({
            "type": "ngo_registration",
            "source": "ngo",
            "ngoEmail": payload.ngo_email,
            "ngoName": payload.ngo_name,
            "contactPerson": payload.contact_person,
            "contactPhone": payload.contact_phone,
            "address": payload.address,
            "village": payload.village,
            "district": payload.district,
            "childrenCount": payload.children_count,
            "ngoType": payload.ngo_type,
            "message": payload.message,
            "reviewStatus": "pending",
            "title": f"New NGO Registration: {payload.ngo_name}",
            "severity": "MEDIUM",
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        return {"status": "submitted", "message": "Registration request received"}

    elif payload.form_type == "existing_ngo_request":
        # Verify NGO exists
        ngo_docs = list(db.collection("ngos").where("email", "==", payload.ngo_email).limit(1).stream())
        if not ngo_docs:
            return {"status": "not_found", "message": "NGO not registered"}

        ngo = ngo_docs[0].to_dict()
        db.collection("pending_reviews").add({
            "type": f"ngo_{payload.request_type}",
            "source": "ngo",
            "ngoId": ngo_docs[0].id,
            "ngoEmail": payload.ngo_email,
            "ngoName": ngo.get("name"),
            "requestType": payload.request_type,
            "message": payload.message,
            "preferredDate1": payload.preferred_date_1,
            "preferredDate2": payload.preferred_date_2,
            "reviewStatus": "pending",
            "title": f"NGO Request: {ngo.get('name')} - {payload.request_type}",
            "severity": "HIGH" if payload.request_type == "appointment" else "LOW",
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        return {"status": "submitted"}

    elif payload.form_type == "appointment_change":
        # Find existing appointment for this NGO
        appt_docs = list(db.collection("ngo_appointments")
            .where("ngoEmail", "==", payload.ngo_email)
            .where("status", "==", "scheduled")
            .order_by("scheduledDate", direction=firestore.Query.DESCENDING)
            .limit(1).stream())

        db.collection("pending_reviews").add({
            "type": "ngo_appointment_change",
            "source": "ngo",
            "ngoEmail": payload.ngo_email,
            "currentAppointmentId": appt_docs[0].id if appt_docs else None,
            "preferredDate1": payload.preferred_date_1,
            "preferredDate2": payload.preferred_date_2,
            "message": payload.message,
            "reviewStatus": "pending",
            "title": f"Appointment Change Request: {payload.ngo_email}",
            "severity": "MEDIUM",
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        return {"status": "submitted"}
        
    return {"status": "ignored", "message": "Unknown form_type"}


# ==========================================
# PART B & C: AUTHENTICATED NGO ENDPOINTS
# ==========================================

@router.post("/approve-registration/{review_id}")
async def approve_registration(review_id: str, decoded_token: dict = Depends(verify_firebase_token)):
    """Admin approves NGO registration"""
    db = firestore.client()
    
    # Get pending review
    review_ref = db.collection("pending_reviews").document(review_id)
    review_doc = review_ref.get()
    if not review_doc.exists:
        raise HTTPException(status_code=404, detail="Review not found")
        
    review = review_doc.to_dict()

    # Create NGO document
    _, new_ngo_ref = db.collection("ngos").add({
        "name": review.get("ngoName"),
        "email": review.get("ngoEmail"),
        "contactPerson": review.get("contactPerson"),
        "contactPhone": review.get("contactPhone"),
        "address": review.get("address"),
        "village": review.get("village"),
        "district": review.get("district"),
        "childrenCount": review.get("childrenCount"),
        "type": review.get("ngoType"),
        "isActive": True,
        "createdAt": firestore.SERVER_TIMESTAMP
    })

    # Update review status
    review_ref.update({
        "reviewStatus": "approved",
        "approvedNgoId": new_ngo_ref.id,
        "reviewedAt": firestore.SERVER_TIMESTAMP
    })

    return {"success": True, "ngo_id": new_ngo_ref.id}


class BookAppointmentPayload(BaseModel):
    ngo_id: str
    ngo_email: str
    ngo_name: str
    scheduled_date: str
    scheduled_time: str
    purpose: str
    assigned_asha_ids: List[str]
    head_id: str

@router.post("/book-appointment")
async def book_appointment(payload: BookAppointmentPayload, decoded_token: dict = Depends(verify_firebase_token)):
    """Admin books appointment with NGO + sends email"""
    db = firestore.client()
    
    asha_ids = payload.assigned_asha_ids
    if asha_ids == ["all"]:
        asha_docs = db.collection("ashas").where("supervisorId", "==", payload.head_id).stream()
        asha_ids = [d.id for d in asha_docs]

    # Create ngo_appointments document
    appt_doc = {
        "ngoId": payload.ngo_id,
        "ngoEmail": payload.ngo_email,
        "ngoName": payload.ngo_name,
        "scheduledDate": payload.scheduled_date,
        "scheduledTime": payload.scheduled_time,
        "purpose": payload.purpose,
        "assignedAshaIds": asha_ids,
        "status": "scheduled",
        "createdAt": firestore.SERVER_TIMESTAMP
    }
    
    _, doc_ref = db.collection("ngo_appointments").add(appt_doc)
    appt_id = doc_ref.id
    
    NGO_RESCHEDULE_FORM_URL = os.getenv("NGO_RESCHEDULE_FORM_URL")
    NGO_RESCHEDULE_FORM_EMAIL_ENTRY = os.getenv("NGO_RESCHEDULE_FORM_EMAIL_ENTRY")
    NGO_RESCHEDULE_FORM_DATE_ENTRY = os.getenv("NGO_RESCHEDULE_FORM_DATE_ENTRY")

    change_url = (
        f"{NGO_RESCHEDULE_FORM_URL}"
        f"?{NGO_RESCHEDULE_FORM_EMAIL_ENTRY}={payload.ngo_email}"
        f"&{NGO_RESCHEDULE_FORM_DATE_ENTRY}={appt_id}"
    )
    db.collection("ngo_appointments").document(appt_id).update({
        "changeFormUrl": change_url
    })
    
    # TODO: integrate Gmail API or SendGrid
    
    # For FCM to ASHA workers
    for asha_id in asha_ids:
        asha_doc = db.collection("ashas").document(asha_id).get()
        if asha_doc.exists:
            asha = asha_doc.to_dict()
            if asha.get("fcmToken"):
                try:
                    messaging.send(messaging.Message(
                        notification=messaging.Notification(
                            title="NGO Visit Scheduled",
                            body=f"Visit to {payload.ngo_name} on {payload.scheduled_date} at {payload.scheduled_time}"
                        ),
                        token=asha["fcmToken"]
                    ))
                except Exception as e:
                    print(f"Error sending FCM: {e}")
                    pass
                    
    return {"success": True, "appointment_id": appt_id}

class UpdateDatePayload(BaseModel):
    new_date: str
    new_time: str
    review_id: str
    admin_note: str

@router.post("/appointment/{appointment_id}/update-date")
async def update_appointment_date(appointment_id: str, payload: UpdateDatePayload, decoded_token: dict = Depends(verify_firebase_token)):
    db = firestore.client()
    
    # Update the appointment
    db.collection("ngo_appointments").document(appointment_id).update({
        "scheduledDate": payload.new_date,
        "scheduledTime": payload.new_time,
        "rescheduledAt": firestore.SERVER_TIMESTAMP,
        "rescheduledBy": "admin",
        "status": "scheduled"  # reconfirm
    })
    
    # Resolve the pending review
    db.collection("pending_reviews").document(payload.review_id).update({
        "reviewStatus": "approved",
        "adminNote": payload.admin_note,
        "reviewedAt": firestore.SERVER_TIMESTAMP
    })
    
    # Get the appointment to find assigned ASHA workers
    appt = db.collection("ngo_appointments").document(appointment_id).get().to_dict()
    if not appt:
        raise HTTPException(404, "Appointment not found")
        
    ngo = db.collection("ngos").document(appt["ngoId"]).get().to_dict()
    
    # Notify all assigned ASHA workers via FCM
    for asha_id in appt.get("assignedAshaIds", []):
        asha = db.collection("ashas").document(asha_id).get().to_dict()
        if asha and asha.get("fcmToken"):
            try:
                messaging.send(messaging.Message(
                    notification=messaging.Notification(
                        title="NGO Visit Date Updated",
                        body=f"Visit to {ngo.get('name')} rescheduled to {payload.new_date} at {payload.new_time}"
                    ),
                    token=asha["fcmToken"]
                ))
            except Exception as e:
                print(f"Error sending FCM: {e}")
                pass
                
    # Create a notification doc for in-app display too (FCM might not reach all devices)
    for asha_id in appt.get("assignedAshaIds", []):
        db.collection("notifications").add({
            "userId": asha_id,
            "title": "NGO Visit Rescheduled",
            "message": f"{ngo.get('name')} visit moved to {payload.new_date} {payload.new_time}",
            "type": "ngo_reschedule",
            "isRead": False,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "linkedAppointmentId": appointment_id
        })
        
    return {"success": True}

@router.get("/{ngo_id}/appointments")
async def get_ngo_appointments(ngo_id: str, decoded_token: dict = Depends(verify_firebase_token)):
    """Fetch appointments for an NGO and resolve ASHA worker names."""
    db = firestore.client()
    try:
        appts_query = db.collection("ngo_appointments") \
            .where("ngoId", "==", ngo_id) \
            .order_by("scheduledDate", direction=firestore.Query.DESCENDING) \
            .stream()
            
        appts = [{"id": a.id, **a.to_dict()} for a in appts_query]
        
        asha_cache = {}
        for appt in appts:
            assigned_names = []
            assigned_ids = appt.get("assignedAshaIds", [])
            for asha_id in assigned_ids:
                if asha_id == "all":
                    continue
                if asha_id not in asha_cache:
                    asha_doc = db.collection("ashas").document(asha_id).get()
                    if asha_doc.exists:
                        asha_cache[asha_id] = asha_doc.to_dict().get("name", asha_id)
                    else:
                        asha_cache[asha_id] = asha_id
                assigned_names.append(asha_cache[asha_id])
                
            if "all" in assigned_ids:
                appt["assignedAshaNames"] = "All workers"
            else:
                appt["assignedAshaNames"] = ", ".join(assigned_names)
                
        return {"appointments": appts}
    except Exception as e:
        print("Error fetching ngo appointments:", e)
        raise HTTPException(500, detail=str(e))
