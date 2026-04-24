from firebase_admin import firestore

async def find_child_in_birth_records(identifier: str, id_type: str = "aadhaar") -> dict | None:
    """Search birth_records for a child by Aadhaar hash or temporaryId"""
    db = firestore.client()
    if id_type == "aadhaar":
        docs = db.collection("birth_records").where("aadhaarHash", "==", identifier).limit(1).stream()
    else:
        docs = db.collection("birth_records").where("temporaryId", "==", identifier).limit(1).stream()
    
    results = [d.to_dict() | {"id": d.id} for d in docs]
    return results[0] if results else None

async def find_member_in_family_survey(identifier: str, id_type: str = "aadhaar") -> dict | None:
    """Search household_members for a person"""
    db = firestore.client()
    if id_type == "aadhaar":
        docs = db.collection("household_members").where("aadhaarHash", "==", identifier).limit(1).stream()
    else:
        docs = db.collection("household_members").where("temporaryId", "==", identifier).limit(1).stream()
    results = [d.to_dict() | {"id": d.id} for d in docs]
    return results[0] if results else None

async def process_cross_module_linkages(submission_data: dict, module_type: str) -> None:
    """Analyze new submissions and trigger automatic cross-module linkages"""
    import structlog
    logger = structlog.get_logger()
    db = firestore.client()
    
    try:
        # Example 1: If pregnant women identified in family survey -> create draft ANC record
        if module_type == "family_survey":
            members = submission_data.get("members", [])
            for member in members:
                if member.get("gender") == "Female" and member.get("is_pregnant"):
                    # Create placeholder ANC record
                    db.collection("anc").add({
                        "mother_name": member.get("member_name", ""),
                        "age": member.get("age"),
                        "householdId": submission_data.get("householdId"),
                        "ashaId": submission_data.get("ashaId"),
                        "status": "draft",
                        "createdAt": firestore.SERVER_TIMESTAMP,
                        "notes": "Auto-created from family survey. Update required."
                    })
                    logger.info("anc_draft_created", name=member.get("member_name"))
                    
        # Example 2: If Disease Surveillance finds severe symptoms -> auto referral
        elif module_type == "disease_surveillance":
            symptoms = submission_data.get("symptoms", "")
            duration = submission_data.get("durationDays", 0)
            if duration > 7 or "severe" in str(submission_data.get("additionalNotes", "")).lower():
                db.collection("referrals").add({
                    "patientName": submission_data.get("patientName", ""),
                    "reason": f"Prolonged/Severe symptoms: {symptoms}",
                    "ashaId": submission_data.get("ashaId"),
                    "status": "pending",
                    "referredDate": firestore.SERVER_TIMESTAMP
                })
                logger.info("auto_referral_created", patient=submission_data.get("patientName"))
    except Exception as e:
        logger.error("cross_linkage_error", error=str(e))
