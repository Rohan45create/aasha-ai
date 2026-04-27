from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
import structlog
import os

from middleware.auth_middleware import verify_firebase_token

logger = structlog.get_logger()
router = APIRouter(prefix="/api/translate", tags=["Translation"])

# ── Google Cloud Translation client (v3 REST via google-cloud-translate) ────────
try:
    from google.cloud import translate_v2 as translate
    _translate_client = translate.Client()
    _translation_available = True
except Exception as e:
    logger.warning("translation_client_unavailable", error=str(e))
    _translate_client = None
    _translation_available = False


class TranslateRequest(BaseModel):
    texts: List[str]          # array of strings to translate
    target_language: str      # "mr" | "hi" | "en"
    source_language: str = "en"


@router.post("/batch")
async def translate_batch(
    req: TranslateRequest,
    user=Depends(verify_firebase_token),
):
    """
    Translate an array of UI strings to the target language using
    Google Cloud Translation API v2.

    - source_language: always "en" (app is authored in English)
    - target_language: "mr" (Marathi) | "hi" (Hindi) | "en" (no-op)
    - Returns: { translations: [ { original, translated } ] }
    - NEVER writes to Firestore or any database.
    """
    # No-op if target is English
    if req.target_language == "en" or req.target_language == req.source_language:
        return {
            "translations": [
                {"original": t, "translated": t} for t in req.texts
            ]
        }

    if not _translation_available or _translate_client is None:
        raise HTTPException(
            status_code=503,
            detail="Translation service not available. Ensure Cloud Translation API is enabled."
        )

    # Filter out empty strings
    texts_to_translate = [t for t in req.texts if t and t.strip()]
    if not texts_to_translate:
        return {"translations": [{"original": t, "translated": t} for t in req.texts]}

    try:
        results = _translate_client.translate(
            texts_to_translate,
            source_language=req.source_language,
            target_language=req.target_language,
            format_="text",
        )

        # Build lookup from input → translated
        translation_map = {}
        for result in results:
            original = result["input"]
            translated = result["translatedText"]
            translation_map[original] = translated

        return {
            "translations": [
                {
                    "original": t,
                    "translated": translation_map.get(t, t),
                }
                for t in req.texts
            ]
        }

    except Exception as e:
        logger.error("translation_error", error=str(e), target=req.target_language)
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")
