from fastapi import APIRouter, Depends, HTTPException
import structlog
import os
from google.cloud import storage
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig
from middleware.auth_middleware import verify_firebase_token

logger = structlog.get_logger()
router = APIRouter(prefix="/api/register", tags=["Register OCR"])

GCS_BUCKET = os.getenv("GCS_BUCKET", "ashaai-health-photos")

@router.post("/extract")
async def extract_register(
    storage_path: str,
    register_type: str,
    user=Depends(verify_firebase_token)
):
    try:
        # Download from GCS
        storage_client = storage.Client()
        blob = storage_client.bucket(GCS_BUCKET).blob(storage_path)
        image_bytes = blob.download_as_bytes()
        
        model = GenerativeModel("gemini-2.0-flash-001")
        image_part = Part.from_data(image_bytes, mime_type="image/jpeg")
        
        prompt = f"""You are reading a photo of an official ASHA worker health register from Maharashtra, India.
Register type: {register_type}

Extract every visible row. Return ONLY valid JSON (no markdown, no explanation):
{{
  "register_type": "{register_type}",
  "rows": [
    {{
      "row_number": 1,
      "fields": {{"serial_number": null, "house_number": null, "member_name": null, 
                  "gender": null, "date_of_birth": null, "age": null,
                  "relationship_to_head": null, "marital_status": null,
                  "mobile_number": null}},
      "confidence": {{"member_name": 0.95, "gender": 0.90}},
      "needs_review": false,
      "unreadable_fields": []
    }}
  ],
  "total_rows_found": 0
}}
Mark confidence < 0.8 as needs_review: true. Return null for unreadable. Never guess."""
        
        response = model.generate_content(
            [image_part, prompt],
            generation_config=GenerationConfig(response_mime_type="application/json")
        )
        import json
        return json.loads(response.text)
    except Exception as e:
        logger.error("register_extract_error", error=str(e))
        raise HTTPException(status_code=500, detail="OCR Extract failed")
