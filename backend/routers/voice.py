from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import structlog
from services.gemini_service import transcribe_marathi, structure_for_module
from middleware.auth_middleware import verify_firebase_token

logger = structlog.get_logger()
router = APIRouter(prefix="/api/voice", tags=["Voice Transcription"])

@router.post("/transcribe")
async def transcribe_voice(
    audio: UploadFile = File(...),
    module_type: str = Form(...),
    user=Depends(verify_firebase_token)
):
    audio_bytes = await audio.read()
    transcript = await transcribe_marathi(audio_bytes)
    structured = await structure_for_module(transcript, module_type)
    # CRITICAL: audio_bytes goes out of scope here — never stored anywhere
    return {"transcript": transcript, "fields": structured, "module_type": module_type}

