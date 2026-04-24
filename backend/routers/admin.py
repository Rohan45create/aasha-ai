from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import csv
import io
from fastapi.responses import StreamingResponse
from google.cloud import firestore
import firebase_admin
from firebase_admin import auth
from middleware.auth_middleware import verify_firebase_token, require_role
import structlog

logger = structlog.get_logger()
router = APIRouter(prefix="/api/admin", tags=["admin"])


# ============================================================================
# TASK 1: WORKERS MANAGEMENT
# ============================================================================

@router.get("/supervisor/workers/{head_id}")
async def get_workers(head_id: str, user=Depends(verify_firebase_token)):
    """Get all ASHA workers under a supervisor."""
    try:
        db = firestore.Client()
        
        # Get head document
        head_doc = db.collection("asha_heads").document(head_id).get()
        if not head_doc.exists():
            # Fallback: get all ASHA workers in same district
            workers = db.collection("ashas")\
                .where("district", "==", user.get("district", "Beed"))\
                .stream()
            asha_ids = [w.id for w in workers]
        else:
            asha_ids = head_doc.to_dict().get("ashaIds", [])
        
        if not asha_ids:
            return []
        
        # Batch get all ASHA documents
        workers_data = []
        for asha_id in asha_ids:
            doc = db.collection("ashas").document(asha_id).get()
            if doc.exists:
                data = doc.to_dict()
                
                # Get last activity
                last_sub = list(db.collection("module_submissions")
                    .where("ashaId", "==", asha_id)
                    .order_by("submittedAt", direction=firestore.Query.DESCENDING)
                    .limit(1).stream())
                
                # Get this month's submission count
                month_start = datetime.now().replace(day=1, hour=0, minute=0, second=0)
                month_count = len(list(db.collection("module_submissions")
                    .where("ashaId", "==", asha_id)
                    .where("submittedAt", ">=", month_start)
                    .stream()))
                
                workers_data.append({
                    "id": doc.id,
                    "name": data.get("name", ""),
                    "village": data.get("village", ""),
                    "phone": data.get("phone", ""),
                    "district": data.get("district", ""),
                    "isActive": data.get("isActive", True),
                    "last_active": last_sub[0].to_dict().get("submittedAt") if last_sub else None,
                    "submissions_this_month": month_count,
                    "total_families": data.get("totalFamilies", 0),
                    "coverage_percent": data.get("coveragePercent", 0),
                    "fcmToken": data.get("fcmToken", "")
                })
        
        return workers_data
    except Exception as e:
        logger.error("get_workers_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error fetching workers")


@router.post("/supervisor/workers/add")
async def add_worker(
    name: str = Query(...),
    phone: str = Query(...),
    village: str = Query(...),
    district: str = Query(...),
    user=Depends(require_role("asha_head"))
):
    """Add a new ASHA worker under current supervisor."""
    try:
        # Create Firebase Auth user
        firebase_user = auth.create_user(phone_number=f"+91{phone}")
        
        # Set custom claims
        auth.set_custom_user_claims(firebase_user.uid, {
            "role": "asha_worker",
            "district": district,
            "asha_head_id": user["uid"]
        })
        
        # Create Firestore document
        db = firestore.Client()
        db.collection("ashas").document(firebase_user.uid).set({
            "name": name,
            "phone": phone,
            "village": village,
            "district": district,
            "supervisorId": user["uid"],
            "isActive": True,
            "createdAt": firestore.SERVER_TIMESTAMP
        })
        
        # Add to head's ashaIds list
        db.collection("asha_heads").document(user["uid"]).update({
            "ashaIds": firestore.ArrayUnion([firebase_user.uid])
        })
        
        logger.info("worker_created", worker_id=firebase_user.uid)
        return {"success": True, "worker_id": firebase_user.uid}
    except Exception as e:
        logger.error("add_worker_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error adding worker")


# ============================================================================
# TASK 3: PENDING REVIEWS
# ============================================================================

@router.post("/supervisor/review/{review_id}/approve")
async def approve_review(review_id: str, user=Depends(require_role("asha_head"))):
    """Approve a pending review."""
    try:
        db = firestore.Client()
        db.collection("pending_reviews").document(review_id).update({
            "reviewStatus": "approved",
            "reviewedBy": user["uid"],
            "reviewedAt": firestore.SERVER_TIMESTAMP
        })
        
        # Get the flagged document and update it too
        review = db.collection("pending_reviews").document(review_id).get().to_dict()
        if review and review.get("linkedCollection") and review.get("linkedDocId"):
            db.collection(review["linkedCollection"]).document(review["linkedDocId"]).update({
                "reviewStatus": "approved",
                "reviewedAt": firestore.SERVER_TIMESTAMP
            })
        
        logger.info("review_approved", review_id=review_id)
        return {"success": True}
    except Exception as e:
        logger.error("approve_review_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error approving review")


@router.post("/supervisor/review/{review_id}/reject")
async def reject_review(
    review_id: str,
    reason: str = Query(...),
    user=Depends(require_role("asha_head"))
):
    """Reject a pending review with reason."""
    try:
        db = firestore.Client()
        db.collection("pending_reviews").document(review_id).update({
            "reviewStatus": "rejected",
            "rejectionReason": reason,
            "reviewedBy": user["uid"],
            "reviewedAt": firestore.SERVER_TIMESTAMP
        })
        
        # Get review to find the ASHA worker
        review = db.collection("pending_reviews").document(review_id).get().to_dict()
        if review and review.get("ashaId"):
            # Write a notification
            db.collection("notifications").add({
                "userId": review["ashaId"],
                "title": "Module Review Rejected",
                "message": f"Your submission for {review.get('title', 'a module')} was rejected: {reason}",
                "type": "review_rejected",
                "isRead": False,
                "createdAt": firestore.SERVER_TIMESTAMP,
                "linkedDocId": review_id
            })
            
        logger.info("review_rejected", review_id=review_id, reason=reason)
        return {"success": True}
    except Exception as e:
        logger.error("reject_review_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error rejecting review")


# ============================================================================
# TASK 5: REFERRALS MANAGEMENT
# ============================================================================

@router.get("/supervisor/referrals/{head_id}")
async def get_referrals(head_id: str, user=Depends(verify_firebase_token)):
    """Get all referrals for workers under a supervisor."""
    try:
        db = firestore.Client()
        head = db.collection("asha_heads").document(head_id).get().to_dict()
        if not head:
            return []
        
        asha_ids = head.get("ashaIds", [])
        
        all_referrals = []
        for asha_id in asha_ids:
            docs = db.collection("referrals").where("ashaId", "==", asha_id).stream()
            for doc in docs:
                d = doc.to_dict()
                all_referrals.append({"id": doc.id, **d})
        
        all_referrals.sort(key=lambda x: x.get("referredDate", ""), reverse=True)
        return all_referrals
    except Exception as e:
        logger.error("get_referrals_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error fetching referrals")


@router.post("/supervisor/referrals/{referral_id}/status")
async def update_referral_status(
    referral_id: str,
    status: str = Query(...),
    user=Depends(require_role("asha_head"))
):
    """Update referral status."""
    try:
        db = firestore.Client()
        db.collection("referrals").document(referral_id).update({
            "status": status,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "updatedBy": user["uid"]
        })
        logger.info("referral_status_updated", referral_id=referral_id, status=status)
        return {"success": True}
    except Exception as e:
        logger.error("update_referral_status_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error updating referral status")


# ============================================================================
# TASK 4: SURVEY BUILDER - PUBLISH SURVEYS
# ============================================================================

@router.post("/supervisor/surveys/publish")
async def publish_survey(
    survey_data: Dict[str, Any],
    user=Depends(require_role("asha_head"))
):
    """Publish a survey to assigned workers."""
    try:
        db = firestore.Client()
        
        survey_doc = {
            "title": survey_data.get("title"),
            "fields": survey_data.get("fields", []),
            "assignedTo": survey_data.get("assignedTo", []),
            "createdBy": user["uid"],
            "publishedAt": firestore.SERVER_TIMESTAMP,
            "status": "active"
        }
        
        # Create survey template
        doc_ref = db.collection("survey_templates").document()
        doc_ref.set(survey_doc)
        
        logger.info("survey_published", survey_id=doc_ref.id, assigned_count=len(survey_data.get("assignedTo", [])))
        return {"success": True, "surveyId": doc_ref.id}
    except Exception as e:
        logger.error("publish_survey_error", error=str(e))
        raise HTTPException(status_code=500, detail="Error publishing survey")


# ============================================================================
# EXISTING DASHBOARD ENDPOINTS (KEEP)
# ============================================================================

@router.get("/dashboard-stats")
async def get_dashboard_stats():
    """Returns live dashboard statistics. In production: real Firestore aggregations."""
    return {
        "active_workers": 8,
        "total_workers": 12,
        "total_families": 2400,
        "coverage_percent": 67,
        "critical_cases": 7,
        "pending_review": 15,
        "pending_sync": 234,
        "total_children": 450,
        "total_pregnancies": 78,
        "sam_cases": 5,
        "mam_cases": 12,
        "high_risk_pregnancies": 8,
    }


@router.get("/coverage-map")
async def get_coverage_data():
    """Get village-level coverage data for the map."""
    return [
        {"village": "Pimpalgaon", "lat": 19.42, "lng": 75.85, "coverage": 89, "critical": 3, "families": 210, "status": "CRITICAL"},
        {"village": "Shirur", "lat": 19.40, "lng": 75.92, "coverage": 72, "critical": 1, "families": 185, "status": "HIGH"},
        {"village": "Beed City", "lat": 18.99, "lng": 75.76, "coverage": 54, "critical": 0, "families": 143, "status": "MEDIUM"},
        {"village": "Parli", "lat": 18.85, "lng": 76.53, "coverage": 67, "critical": 2, "families": 167, "status": "HIGH"},
        {"village": "Georai", "lat": 19.27, "lng": 75.73, "coverage": 61, "critical": 0, "families": 156, "status": "NORMAL"},
    ]


@router.get("/reports/monthly-summary")
async def get_monthly_summary(month: Optional[str] = None):
    """Generate monthly summary report data."""
    return {
        "period": month or datetime.now().strftime("%Y-%m"),
        "metrics": [
            {"name": "Families Surveyed", "current": 124, "previous": 98, "change": "+26.5%"},
            {"name": "ANC Registrations", "current": 18, "previous": 15, "change": "+20%"},
            {"name": "Children Measured", "current": 67, "previous": 45, "change": "+48.9%"},
            {"name": "Vaccinations Recorded", "current": 203, "previous": 178, "change": "+14%"},
            {"name": "Critical Cases", "current": 7, "previous": 4, "change": "+75%"},
            {"name": "NRC Referrals", "current": 3, "previous": 1, "change": "+200%"},
        ]
    }


@router.get("/reports/export-csv")
async def export_csv(report_type: str = "households"):
    """Export a report as a CSV file."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    try:
        db = firestore.Client()
        if report_type == "households":
            docs = db.collection("households").stream()
            writer.writerow(["ID", "Village", "RationCardType", "GPS_Lat", "GPS_Lng", "CriticalCase"])
            for doc in docs:
                d = doc.to_dict()
                writer.writerow([
                    doc.id, 
                    d.get("village", ""), 
                    d.get("rationCardType", ""), 
                    d.get("gpsLat", ""), 
                    d.get("gpsLng", ""),
                    "Yes" if d.get("hasCriticalCase") else "No"
                ])
        elif report_type == "modules":
            docs = db.collection("module_submissions").stream()
            writer.writerow(["DocID", "AshaID", "ModuleType", "SubmittedAt", "Notes"])
            for doc in docs:
                d = doc.to_dict()
                writer.writerow([
                    doc.id,
                    d.get("ashaId", ""),
                    d.get("moduleType", ""),
                    d.get("submittedAt", ""),
                    str(d.get("notes", ""))[:50]
                ])
        else:
            writer.writerow(["Report Type", report_type])
            writer.writerow(["Error", "Invalid report type requested"])
            
    except Exception as e:
        logger.error("export_csv_error", error=str(e))
        writer.writerow(["Error", f"Failed to export: {str(e)}"])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=ashaai_{report_type}.csv"}
    )
