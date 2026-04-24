"""
Nightly Risk Engine — Cloud Function
Triggered by Cloud Scheduler at 11pm IST daily.

Scans all children and pregnancy records, calculates risk scores
using Gemini, and writes results to the risk_scores collection.
Only the Cloud Function service account can write to risk_scores
(Firestore rules block all other writers).
"""
import functions_framework
import firebase_admin
from firebase_admin import firestore
from datetime import datetime, date
import json
import os

# Initialize Firebase Admin SDK
if not firebase_admin._apps:
    firebase_admin.initialize_app()

db = firestore.client()


def calculate_child_risk(child: dict) -> dict:
    """
    Calculate risk score for a child based on growth data.
    Score: 0-100. Higher = more critical.
    """
    score = 0
    signals = []

    # MUAC-based risk
    muac = child.get("muac_cm") or child.get("last_muac_cm")
    if muac is not None:
        if muac < 11.5:
            score += 40
            signals.append({
                "category": "malnutrition",
                "description": "SAM — Severe Acute Malnutrition (MUAC < 11.5cm)",
                "severity": "CRITICAL",
            })
        elif muac < 12.5:
            score += 25
            signals.append({
                "category": "malnutrition",
                "description": "MAM — Moderate Acute Malnutrition (MUAC 11.5-12.5cm)",
                "severity": "HIGH",
            })

    # Weight for age
    weight = child.get("weight_kg")
    age_months = child.get("age_months")
    if weight and age_months:
        # Simplified WHO z-score approximation
        expected_weight = 3.5 + (age_months * 0.5) if age_months <= 12 else 9 + ((age_months - 12) * 0.2)
        if weight < expected_weight * 0.6:
            score += 30
            signals.append({
                "category": "underweight",
                "description": f"Severely underweight: {weight}kg vs expected ~{expected_weight:.1f}kg",
                "severity": "CRITICAL",
            })
        elif weight < expected_weight * 0.75:
            score += 15
            signals.append({
                "category": "underweight",
                "description": f"Underweight: {weight}kg vs expected ~{expected_weight:.1f}kg",
                "severity": "HIGH",
            })

    # Vaccination status
    if child.get("immunization_up_to_date") is False:
        score += 10
        signals.append({
            "category": "vaccination",
            "description": "Immunization not up to date",
            "severity": "MEDIUM",
        })

    # Illness signs
    illness = child.get("illness_signs", [])
    if illness:
        score += min(len(illness) * 5, 20)
        signals.append({
            "category": "illness",
            "description": f"Active illness signs: {', '.join(illness[:3])}",
            "severity": "HIGH" if len(illness) > 2 else "MEDIUM",
        })

    # Feeding issues
    feeding = child.get("feeding_status", "")
    if feeding and any(kw in feeding.lower() for kw in ["poor", "refused", "stopped", "no breastfeeding"]):
        score += 15
        signals.append({
            "category": "feeding",
            "description": f"Feeding concern: {feeding}",
            "severity": "HIGH",
        })

    level = "LOW"
    if score >= 70:
        level = "CRITICAL"
    elif score >= 50:
        level = "HIGH"
    elif score >= 25:
        level = "MEDIUM"

    recommendation = None
    if level == "CRITICAL":
        recommendation = "Immediate visit required. Consider NRC referral."
    elif level == "HIGH":
        recommendation = "Visit within 24 hours. Monitor closely."

    return {
        "score": min(score, 100),
        "level": level,
        "signals": signals,
        "recommendation": recommendation,
    }


def calculate_pregnancy_risk(pregnancy: dict) -> dict:
    """Calculate risk score for a pregnancy record."""
    score = 0
    signals = []

    # Age-based risk
    age = pregnancy.get("age")
    if age is not None:
        if age < 18:
            score += 20
            signals.append({
                "category": "maternal_age",
                "description": f"Teenage pregnancy (age {age})",
                "severity": "HIGH",
            })
        elif age > 35:
            score += 15
            signals.append({
                "category": "maternal_age",
                "description": f"Advanced maternal age ({age})",
                "severity": "MEDIUM",
            })

    # Hemoglobin
    hb = pregnancy.get("hemoglobin")
    if hb is not None:
        if hb < 7:
            score += 30
            signals.append({
                "category": "anemia",
                "description": f"Severe anemia (Hb: {hb})",
                "severity": "CRITICAL",
            })
        elif hb < 11:
            score += 15
            signals.append({
                "category": "anemia",
                "description": f"Anemia (Hb: {hb})",
                "severity": "HIGH",
            })

    # Blood pressure
    bp_sys = pregnancy.get("bp_systolic")
    if bp_sys is not None and bp_sys > 140:
        score += 25
        signals.append({
            "category": "hypertension",
            "description": f"Hypertension (BP: {bp_sys}/{pregnancy.get('bp_diastolic', '?')})",
            "severity": "CRITICAL",
        })

    # High risk factors
    risk_factors = pregnancy.get("high_risk_factors", [])
    if risk_factors:
        score += min(len(risk_factors) * 10, 30)
        signals.append({
            "category": "risk_factors",
            "description": f"Risk factors: {', '.join(risk_factors[:3])}",
            "severity": "HIGH",
        })

    # Overdue ANC visits
    edd = pregnancy.get("edd_date")
    if edd:
        try:
            edd_date = datetime.strptime(edd, "%Y-%m-%d").date() if isinstance(edd, str) else edd
            days_to_edd = (edd_date - date.today()).days
            if days_to_edd < 0:
                score += 20
                signals.append({
                    "category": "overdue",
                    "description": f"Past EDD by {abs(days_to_edd)} days",
                    "severity": "CRITICAL",
                })
            elif days_to_edd < 14:
                score += 10
                signals.append({
                    "category": "due_soon",
                    "description": f"Delivery expected in {days_to_edd} days",
                    "severity": "HIGH",
                })
        except (ValueError, TypeError):
            pass

    level = "LOW"
    if score >= 70:
        level = "CRITICAL"
    elif score >= 50:
        level = "HIGH"
    elif score >= 25:
        level = "MEDIUM"

    recommendation = None
    if level == "CRITICAL":
        recommendation = "Immediate PHC referral. Arrange transport."
    elif level == "HIGH":
        recommendation = "Schedule ANC visit within 48 hours."

    return {
        "score": min(score, 100),
        "level": level,
        "signals": signals,
        "recommendation": recommendation,
    }


@functions_framework.http
def nightly_risk_engine(request):
    """
    Cloud Function triggered by Cloud Scheduler at 11pm IST daily.
    
    Workflow:
    1. Query all children documents
    2. Query all active pregnancy documents
    3. Calculate risk scores for each
    4. Write/update risk_scores collection
    5. Return summary
    """
    processed = 0
    critical_count = 0
    errors = 0

    try:
        # Process children
        children_ref = db.collection("children").stream()
        for doc in children_ref:
            try:
                child_data = doc.to_dict()
                risk = calculate_child_risk(child_data)

                # Write to risk_scores collection
                db.collection("risk_scores").document(doc.id).set({
                    "entityId": doc.id,
                    "entityType": "child",
                    "ashaId": child_data.get("asha_id", ""),
                    "score": risk["score"],
                    "level": risk["level"],
                    "signals": risk["signals"],
                    "recommendation": risk["recommendation"],
                    "calculatedAt": firestore.SERVER_TIMESTAMP,
                    "entityName": child_data.get("child_name", "Unknown"),
                })

                processed += 1
                if risk["level"] == "CRITICAL":
                    critical_count += 1

            except Exception as e:
                errors += 1

        # Process pregnancies
        pregnancies_ref = db.collection("pregnancies").stream()
        for doc in pregnancies_ref:
            try:
                preg_data = doc.to_dict()
                risk = calculate_pregnancy_risk(preg_data)

                db.collection("risk_scores").document(f"preg_{doc.id}").set({
                    "entityId": doc.id,
                    "entityType": "pregnancy",
                    "ashaId": preg_data.get("asha_id", ""),
                    "score": risk["score"],
                    "level": risk["level"],
                    "signals": risk["signals"],
                    "recommendation": risk["recommendation"],
                    "calculatedAt": firestore.SERVER_TIMESTAMP,
                    "entityName": preg_data.get("mother_name", "Unknown"),
                })

                processed += 1
                if risk["level"] == "CRITICAL":
                    critical_count += 1

            except Exception as e:
                errors += 1

    except Exception as e:
        return {"status": "error", "error": str(e)}, 500

    return {
        "status": "success",
        "processed_records": processed,
        "critical_cases": critical_count,
        "errors": errors,
        "timestamp": datetime.utcnow().isoformat(),
    }
