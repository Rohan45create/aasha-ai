from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from vertexai.generative_models import GenerativeModel, GenerationConfig, Part
from middleware.auth_middleware import verify_firebase_token
import json, os, vertexai

router = APIRouter()
vertexai.init(project=os.getenv("GCP_PROJECT_ID", "ashaai-prod"), location="asia-south1")

# ─── Field schemas per register type ─────────────────────────────────────────
FIELD_SCHEMAS = {
    "family_survey": {
        "serial_number": None, "house_number": None, "member_name": None,
        "gender": "Male|Female|Other", "date_of_birth": "YYYY-MM-DD",
        "age": None, "relationship_to_head": None,
        "marital_status": "Married|Unmarried|Widow|Separated",
        "mobile_number": None, "aadhaar_number": None
    },
    "village_survey": {
        "house_number": None, "family_head_name": None,
        "total_members": None, "has_toilet": "Yes|No",
        "water_source": None, "any_pregnant": "Yes|No"
    },
    "vaccination": {
        "child_name": None, "mother_name": None,
        "date_of_birth": "YYYY-MM-DD", "age_months": None,
        "bcg": "Done|Due|null", "opv0": "Done|Due|null",
        "opv1": "Done|Due|null", "dpt1": "Done|Due|null",
        "measles": "Done|Due|null", "vitamin_a": "Done|Due|null",
        "next_due_date": "YYYY-MM-DD"
    },
    "anc": {
        "mother_name": None, "husband_name": None, "age": None,
        "lmp_date": "YYYY-MM-DD", "edd_date": "YYYY-MM-DD",
        "gravida": None, "para": None, "blood_group": None,
        "weight_kg": None, "bp_systolic": None, "bp_diastolic": None,
        "hemoglobin": None, "high_risk": "Yes|No"
    },
    "child_growth": {
        "child_name": None, "mother_name": None, "age_months": None,
        "weight_kg": None, "height_cm": None, "muac_mm": None,
        "muac_color": "GREEN|YELLOW|RED", "grade": "Normal|MAM|SAM",
        "visit_date": "YYYY-MM-DD"
    },
    "birth_record": {
        "child_name": None, "date_of_birth": "YYYY-MM-DD",
        "time_of_birth": None, "gender": "Male|Female",
        "birth_weight_kg": None, "mother_name": None,
        "father_name": None, "place_of_birth": None,
        "delivery_type": "Institutional|Home"
    },
    "death_record": {
        "deceased_name": None, "date_of_death": "YYYY-MM-DD",
        "age_at_death": None, "gender": "Male|Female",
        "cause_of_death": None, "place_of_death": "Home|Hospital",
        "maternal_death": "Yes|No"
    },
}

# ─── Firestore collection per register type ───────────────────────────────────
COLLECTION_MAP = {
    "family_survey":  "household_members",
    "village_survey": "village_surveys",
    "vaccination":    "vaccinations",
    "anc":            "anc",
    "child_growth":   "children",
    "birth_record":   "birth_records",
    "death_record":   "death_records",
}


@router.post("/api/register/extract")
async def extract_register(
    image: UploadFile = File(...),
    register_type: str = Form("family_survey"),
    user=Depends(verify_firebase_token)
):
    """
    Register OCR pipeline — image sent directly to backend (no Firebase Storage needed):
    1. ASHA photographs the register page
    2. Frontend sends image bytes directly via multipart form
    3. Backend passes image to Gemini Vision for OCR + structured extraction
    4. Returns rows[] with fields matching the register_type schema
    """
    # Read image bytes
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(400, "No image received")
    if len(image_bytes) > 8_000_000:
        raise HTTPException(413, "Image too large (max 8MB). Please use a lower resolution.")

    mime_type = image.content_type or "image/jpeg"
    schema = FIELD_SCHEMAS.get(register_type, FIELD_SCHEMAS["family_survey"])
    schema_str = json.dumps(schema, ensure_ascii=False)
    collection = COLLECTION_MAP.get(register_type, "household_members")

    prompt = f"""You are reading a photograph of an official Indian government ASHA worker health register from Maharashtra.
The register has printed Marathi/Hindi column headers and handwritten entries in Marathi, Hindi, or English.
Register type: {register_type}

TASK: Extract EVERY visible row of data. For each row, produce a JSON object with exactly these fields:
{schema_str}

Return ONLY valid JSON in this exact structure (no markdown, no explanation):
{{
  "register_type": "{register_type}",
  "target_collection": "{collection}",
  "rows": [
    {{
      "row_number": 1,
      "fields": {schema_str},
      "confidence": {{}},
      "needs_review": false,
      "unreadable_fields": []
    }}
  ],
  "total_rows_found": 0
}}

STRICT RULES:
- Include ALL rows visible in the register — do not skip any
- Set needs_review: true if ANY field confidence is below 0.8
- Return null for fields you cannot read confidently — NEVER guess
- Convert Marathi/Hindi numerals to Arabic (१→1, २→2, ३→3, etc.)
- Standardize gender: M/पु/मुलगा → "Male", F/स्त्री/मुलगी → "Female"
- Dates: convert any format to YYYY-MM-DD if readable
- Mobile/Aadhaar: strip spaces and dashes"""

    try:
        model = GenerativeModel("gemini-2.5-flash")
        image_part = Part.from_data(data=image_bytes, mime_type=mime_type)
        response = model.generate_content(
            [image_part, prompt],
            generation_config=GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,
            )
        )
        text = response.text.strip()
        # Strip markdown fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text.strip())

        # Ensure rows key exists and normalise
        rows = result.get("rows", [])
        for r in rows:
            if "fields" not in r:
                r["fields"] = {}
            if "needs_review" not in r:
                r["needs_review"] = False

        return {
            "register_type": register_type,
            "target_collection": collection,
            "rows": rows,
            "total_rows_found": result.get("total_rows_found", len(rows)),
        }

    except json.JSONDecodeError as e:
        raise HTTPException(500, f"AI returned invalid JSON: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"OCR processing failed: {str(e)}")
