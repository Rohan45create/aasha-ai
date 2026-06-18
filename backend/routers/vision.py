from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from google.cloud import storage as gcs
import structlog
import uuid
import os

from services.gemini_service import GeminiService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/vision", tags=["Vision & OCR"])

STORAGE_BUCKET = os.getenv("GCS_BUCKET", "ashaai-backend-photos")


from middleware.auth_middleware import verify_firebase_token

@router.post("/muac-grade")
async def grade_muac_photo(
    photo: UploadFile = File(...),
    user=Depends(verify_firebase_token)
):
    """
    AI Malnutrition Visual Assessment via Gemini Vision.

    ASHA uploads any photo of the child (no MUAC tape required).
    Gemini analyzes visible wasting signs, oedema, hair/skin changes.

    Returns:
      {
        "status": "success",
        "grading": {
          "grade": "NORMAL" | "YELLOW" | "RED",
          "severity_label": str,
          "confidence": int (0-100),
          "explanation": str,
          "visible_signs": [str],
          "recommendation": str,
          "needs_nrc_referral": bool
        }
      }

    Photo is processed in memory only — not stored.
    """
    logger.info("malnutrition_scan_start", filename=photo.filename)

    try:
        image_bytes = await photo.read()

        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty photo uploaded")

        if len(image_bytes) > 10_000_000:  # 10MB limit
            raise HTTPException(status_code=413, detail="Photo too large (max 10MB)")

        mime_type = photo.content_type or "image/jpeg"
        result = GeminiService.grade_muac_photo(image_bytes, mime_type)

        logger.info("malnutrition_scan_complete", grade=result.get("grade"), confidence=result.get("confidence"))

        return {
            "status": "success",
            "grading": result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("malnutrition_scan_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Malnutrition scan failed: {str(e)}")
    finally:
        image_bytes = None



from pydantic import BaseModel

class ExtractRequest(BaseModel):
    storage_path: str
    register_type: str = "family_survey"
    asha_id: str

@router.post("/register/extract")
async def extract_register_photo(req: ExtractRequest, user=Depends(verify_firebase_token)):
    """
    Register OCR pipeline:
    1. ASHA uploads photo direct to Firebase Storage
    2. Sends the storage_path to this endpoint
    3. Backend downloads image and extracts rows via Gemini Vision
    4. Returns structured rows + flags rows needing human review
    """
    logger.info("register_extract_start", path=req.storage_path)

    try:
        storage_client = gcs.Client()
        bucket = storage_client.bucket(STORAGE_BUCKET)
        blob = bucket.blob(req.storage_path)
        
        if not blob.exists():
            raise HTTPException(status_code=404, detail="Image not found in storage")
            
        image_bytes = blob.download_as_bytes()
        mime_type = blob.content_type or "image/jpeg"

        # Gemini Vision extraction
        result = GeminiService.extract_register_ocr(image_bytes, req.register_type, mime_type)

        logger.info(
            "register_extract_complete",
            rows_found=result.get("total_rows", 0),
        )

        return {
            "status": "success",
            "extraction": result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("register_extract_error", error=str(e))
        raise HTTPException(status_code=500, detail="Register OCR failed")

