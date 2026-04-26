from fastapi import APIRouter, Depends, HTTPException, Body
from google.cloud import storage as gcs
from vertexai.generative_models import GenerativeModel, GenerationConfig, Part
from middleware.auth_middleware import verify_firebase_token
import json, os, vertexai

router = APIRouter()
vertexai.init(project=os.getenv("GCP_PROJECT_ID","ashaai-prod"), location="asia-south1")
GCS_BUCKET = os.getenv("GCS_BUCKET","ashaai-health-photos")

@router.post("/api/register/extract")
async def extract_register(
    storage_path: str = Body(...),
    register_type: str = Body("family_survey"),
    user=Depends(verify_firebase_token)
):
    try:
        storage_client = gcs.Client()
        blob = storage_client.bucket(GCS_BUCKET).blob(storage_path)
        image_bytes = blob.download_as_bytes()
    except Exception as e:
        raise HTTPException(400, f"Could not read uploaded image: {str(e)}")
    
    model = GenerativeModel("gemini-2.0-flash-001")
    image_part = Part.from_data(image_bytes, mime_type="image/jpeg")
    
    FIELD_SCHEMAS = {
        "family_survey": '{"serial_number":null,"house_number":null,"member_name":null,"gender":"M|F","date_of_birth":null,"age":null,"relationship_to_head":null,"marital_status":null,"mobile_number":null}',
        "village_survey": '{"house_number":null,"family_head_name":null,"total_members":null,"has_toilet":null,"water_source":null}',
        "vaccination": '{"child_name":null,"date_of_birth":null,"bcg":null,"opv1":null,"dpt1":null,"measles":null}',
    }
    
    schema = FIELD_SCHEMAS.get(register_type, FIELD_SCHEMAS["family_survey"])
    
    prompt = f"""You are reading a photo of an official Indian government ASHA worker health register.
The register is printed with Marathi headers and has handwritten entries.
Register type: {register_type}

Extract EVERY visible row of data. Return ONLY valid JSON (no markdown, no explanation):
{{
  "register_type": "{register_type}",
  "rows": [
    {{
      "row_number": 1,
      "fields": {schema},
      "confidence": {{}},
      "needs_review": false,
      "unreadable_fields": []
    }}
  ],
  "total_rows_found": 0,
  "auto_detected_type": "{register_type}"
}}

Rules:
- Mark confidence < 0.8 as needs_review: true
- Return null for fields you cannot read with confidence — NEVER guess
- Convert Marathi numbers to Arabic (१→1, २→2 etc.)
- Standardize gender: M→Male, F→Female, पु→Male, स्त्री→Female"""

    try:
        response = model.generate_content(
            [image_part, prompt],
            generation_config=GenerationConfig(response_mime_type="application/json")
        )
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        result = json.loads(text.strip())
        return result
    except Exception as e:
        raise HTTPException(500, f"OCR processing failed: {str(e)}")

