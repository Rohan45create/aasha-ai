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

async def find_family_member_by_aadhaar_masked(aadhaar_last4: str, asha_id: str) -> dict | None:
    """
    Search household_members for a person by last 4 digits of Aadhaar.
    Only searches within the calling ASHA's households for privacy.
    Returns the member dict + their household info, or None if not found.
    """
    db = firestore.client()
    docs = db.collection("household_members")\
        .where("aadhaarLast4", "==", aadhaar_last4)\
        .where("ashaId", "==", asha_id)\
        .limit(1).stream()
    
    results = [d for d in docs]
    if not results:
        return None
    
    doc = results[0]
    member_data = doc.to_dict()
    household_id = member_data.get("householdId")
    
    family_head_name = None
    if household_id:
        hh_doc = db.collection("households").document(household_id).get()
        if hh_doc.exists:
            family_head_name = hh_doc.to_dict().get("familyHeadName")
            
    return {
        "member_id": doc.id,
        "member_name": member_data.get("member_name"),
        "household_id": household_id,
        "family_head_name": family_head_name,
        "asha_id": member_data.get("ashaId"),
        "relationship": member_data.get("relationship_to_head"),
        "age": member_data.get("age")
    }

async def link_record_to_family(
    record_collection: str,
    record_id: str,
    household_id: str,
    member_id: str,
    linked_by_asha: str,
    link_reason: str = "aadhaar_match"
) -> bool:
    """
    Link any health record to a family household.
    Updates the record document with householdId and memberId fields.
    Also updates the household document's linked records array.
    Writes an edit_history entry for the linkage.
    Returns True on success, False on failure.
    """
    import structlog
    logger = structlog.get_logger()
    db = firestore.client()
    
    try:
        # Step 1: update the record doc
        db.collection(record_collection).document(record_id).update({
            "householdId": household_id,
            "linkedMemberId": member_id,
            "linkedAt": firestore.SERVER_TIMESTAMP,
            "linkedBy": linked_by_asha,
            "linkReason": link_reason
        })
        
        # Step 2: update household doc
        db.collection("households").document(household_id).update({
            "linkedRecords": firestore.ArrayUnion([{"collection": record_collection, "docId": record_id}])
        })
        
        # Step 3: write edit_history entry
        db.collection("edit_history").add({
            "collection": record_collection,
            "document_id": record_id,
            "changes": {"householdId": {"old": None, "new": household_id}},
            "edited_by": linked_by_asha,
            "edited_at": firestore.SERVER_TIMESTAMP,
            "reason": f"Aadhaar linkage: {link_reason}"
        })
        return True
    except Exception as e:
        logger.error("link_record_to_family_error", error=str(e))
        return False

async def check_aadhaar_linkage(
    aadhaar_last4: str,
    asha_id: str,
    module_type: str
) -> dict:
    """
    Master function called by frontend before showing linkage popup.
    Returns everything frontend needs to show the confirmation popup.
    """
    member = await find_family_member_by_aadhaar_masked(aadhaar_last4, asha_id)
    if not member:
        return {"match_found": False}
        
    member_name = member.get("member_name")
    family_head_name = member.get("family_head_name") or "Unknown"
    
    return {
        "match_found": True,
        "member_name": member_name,
        "family_head_name": family_head_name,
        "household_id": member.get("household_id"),
        "member_id": member.get("member_id"),
        "popup_message": f"This person matches {member_name} in {family_head_name}'s family. Link this {module_type} record to their family?"
    }
