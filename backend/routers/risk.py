from fastapi import APIRouter, Depends, HTTPException
import structlog
import json
from datetime import datetime, timedelta
from firebase_admin import firestore
from vertexai.generative_models import GenerativeModel, GenerationConfig
from middleware.auth_middleware import verify_firebase_token
from services import redis_service

logger = structlog.get_logger()
router = APIRouter()

async def _invalidate_asha_cache(asha_id: str):
    """Call this whenever a survey is submitted or risk is recalculated."""
    await redis_service.invalidate_priority(asha_id)

@router.get("/api/risk/debug/{asha_id}")
async def debug_risk(asha_id: str, user=Depends(verify_firebase_token)):
    db = firestore.client()
    children_docs = db.collection("children").where("ashaId","==",asha_id).stream()
    children = [c for c in children_docs]
    
    pregnancies_docs = db.collection("pregnancies").where("ashaId","==",asha_id).stream()
    pregnancies = [p for p in pregnancies_docs]
    
    children_with_scores = [c for c in children if c.to_dict().get("riskScore")]
    
    return {
        "total_children": len(children),
        "children_with_risk_scores": len(children_with_scores),
        "total_pregnancies": len(pregnancies),
        "data_exists": len(children) > 0
    }

@router.post("/api/risk/calculate-now/{asha_id}")
async def calculate_risk_now(asha_id: str, user=Depends(verify_firebase_token)):
    """Run risk engine immediately for one ASHA worker (dev/demo use)"""
    db = firestore.client()
    model = GenerativeModel("gemini-2.5-flash")
    
    children = list(db.collection("children").where("ashaId","==",asha_id).stream())
    updated = 0
    
    for child_doc in children:
        child = child_doc.to_dict()
        
        # Calculate days since last visit
        last_visit = child.get("lastVisitDate")
        if last_visit and hasattr(last_visit, "timestamp"):
            # Depending on if it's a DatetimeWithNanoseconds or python datetime
            lv_dt = datetime.fromtimestamp(last_visit.timestamp())
        else:
            # Fallback if parsing fails or absent
            lv_dt = datetime.now() - timedelta(days=30)

        days_since = (datetime.now() - lv_dt).days
        
        signals = {
            "days_since_last_visit": days_since,
            "sibling_malnutrition": child.get("siblingMalnutritionHistory", False),
            "mother_hb": child.get("motherHaemoglobin", 11.0),
            "breastfeeding_cessation_months": child.get("breastfeedingCessationMonths", 12),
            "vaccination_gap_days": child.get("vaccinationGapDays", 0),
            "malnutrition_grade": child.get("malnutritionGrade", "Normal"),
            "age_months": child.get("ageMonths", 12)
        }
        
        prompt = f"""Calculate health risk score for this child. Return ONLY valid JSON:
{{"risk_score": 0-100, "risk_level": "LOW|MEDIUM|HIGH|CRITICAL", 
  "primary_driver": "one sentence reason", "recommended_action": "specific action", 
  "urgency_days": 1-30}}
Signals: {json.dumps(signals)}
Rules: CRITICAL=76-100, HIGH=51-75, MEDIUM=26-50, LOW=0-25
SAM malnutrition = automatic CRITICAL. Days since visit >21 = HIGH minimum."""
        
        try:
            response = model.generate_content(prompt,
                generation_config=GenerationConfig(response_mime_type="application/json"))
            result = json.loads(response.text)
            
            db.collection("children").document(child_doc.id).update({
                "riskScore": result["risk_score"],
                "riskLevel": result["risk_level"],
                "riskPrimaryDriver": result["primary_driver"],
                "riskRecommendedAction": result["recommended_action"],
                "riskUpdatedAt": firestore.SERVER_TIMESTAMP
            })
            updated += 1
        except Exception as e:
            logger.error("risk_calc_error", error=str(e), doc_id=child_doc.id)
    
    await _invalidate_asha_cache(asha_id)
    return {"updated": updated, "asha_id": asha_id}

@router.get("/api/risk/priority/{asha_id}")
async def get_priority_list(asha_id: str, user=Depends(verify_firebase_token)):
    logger.info("priority_list_query", asha_id=asha_id, doc_id_source="from_request")
    # 1. Check Redis
    cached_results = await redis_service.get_priority_list(asha_id)
    if cached_results is not None:
        logger.info("cache_hit", asha_id=asha_id)
        return cached_results

    db = firestore.client()
    
    # Children by risk
    # Note: Requires composite index if deployed. Otherwise might fail in dev without index.
    # The user's query uses where("ashaId") + order_by("riskScore").
    # We will fetch all and sort in mem to avoid immediate requirement of Firebase composite index 
    # during dev if we can't be sure it exists. But I'll follow user's code for order_by.
    try:
        children = db.collection("children")\
            .where("ashaId", "==", asha_id)\
            .order_by("riskScore", direction=firestore.Query.DESCENDING)\
            .limit(20).stream()
    except Exception as e:
        # Fallback to in-mem sorting if index is missing
        logger.warning(f"Index might be missing: {e}. Falling back to standard check.")
        docs = db.collection("children").where("ashaId", "==", asha_id).stream()
        children_list = [d for d in docs]
        children_list.sort(key=lambda x: x.to_dict().get("riskScore", 0), reverse=True)
        children = children_list[:20]
    
    results = []
    for doc in children:
        d = doc.to_dict()
        if hasattr(d.get("lastVisitDate"), "isoformat"):
            lv = d.get("lastVisitDate").isoformat()
        else:
            lv = d.get("lastVisitDate")

        results.append({
            "id": doc.id,
            "type": "child",
            "name": d.get("name",""),
            "age_months": d.get("ageMonths"),
            "risk_score": d.get("riskScore", 0),
            "risk_level": d.get("riskLevel", "LOW"),
            "primary_driver": d.get("riskPrimaryDriver",""),
            "recommended_action": d.get("riskRecommendedAction",""),
            "last_visit": lv
        })
    
    # Overdue ANC
    overdue_threshold = datetime.now() - timedelta(days=28)
    pregnancies = db.collection("pregnancies")\
        .where("ashaId","==",asha_id)\
        .stream()
    
    for doc in pregnancies:
        d = doc.to_dict()
        anc_date = d.get("lastANCDate")
        if anc_date and hasattr(anc_date, "timestamp"):
            anc_dt = datetime.fromtimestamp(anc_date.timestamp())
            if anc_dt < overdue_threshold:
                results.append({
                    "id": doc.id,
                    "type": "pregnancy",
                    "name": d.get("motherName",""),
                    "risk_level": "HIGH" if d.get("highRiskFlag") else "MEDIUM",
                    "risk_score": 70 if d.get("highRiskFlag") else 50,
                    "primary_driver": "ANC visit overdue",
                    "recommended_action": "Schedule ANC visit immediately",
                    "last_visit": anc_dt.isoformat()
                })
    
    results.sort(key=lambda x: x["risk_score"], reverse=True)
    
    # 3. Write to Redis
    await redis_service.set_priority_list(asha_id, results)
    logger.info("cache_miss_warmed", asha_id=asha_id)
    
    return results
