from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from google.cloud import storage as gcs
import structlog
import uuid
import os

from services.gemini_service import GeminiService

logger = structlog.get_logger()
router = APIRouter(prefix="/api/vision", tags=["Vision & OCR"])

STORAGE_BUCKET = os.getenv("GCS_BUCKET", "ashaai-health-photos")


@router.post("/muac-grade")
async def grade_muac_photo(
    photo: UploadFile = File(...),
):
    """
    Camera malnutrition grading via Gemini Vision.
    
    1. ASHA photographs child's upper arm with MUAC tape
    2. Gemini Vision analyzes the image for color zone
    3. Returns grade + recommendation + NRC referral flag
    
    Photo is NOT stored — processed in memory only.
    """
    logger.info("muac_grade_start")

    try:
        image_bytes = await photo.read()

        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty photo")

        if len(image_bytes) > 5_000_000:  # 5MB limit
            raise HTTPException(status_code=413, detail="Photo too large (max 5MB)")

        mime_type = photo.content_type or "image/jpeg"
        result = GeminiService.grade_muac_photo(image_bytes, mime_type)

        logger.info("muac_grade_complete", grade=result.get("grade"))

        return {
            "status": "success",
            "grading": result,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("muac_grade_error", error=str(e))
        raise HTTPException(status_code=500, detail="MUAC grading failed")
    finally:
        image_bytes = None


from pydantic import BaseModel

class ExtractRequest(BaseModel):
    storage_path: str
    register_type: str = "family_survey"
    asha_id: str

@router.post("/register/extract")
async def extract_register_photo(req: ExtractRequest):
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

