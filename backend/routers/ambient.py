from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from firebase_admin import auth as firebase_auth
import structlog
import json

from services.gemini_service import GeminiService

logger = structlog.get_logger()
router = APIRouter(tags=["Ambient AI"])


async def verify_ws_token(websocket: WebSocket) -> dict | None:
    """Verify Firebase token from WebSocket query params."""
    token = websocket.query_params.get("token")
    if not token:
        return None
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception:
        return None


@router.websocket("/ws/ambient")
async def ambient_ai_websocket(websocket: WebSocket):
    """
    Ambient AI WebSocket endpoint.
    
    Protocol:
    1. Client connects with ?token=<firebase_id_token>&module=<module_name>
    2. Client sends JSON: {"text": "...", "form_state": {...}}
    3. Server processes with Gemini and returns suggestions
    4. Client can accept/reject suggestion chips
    
    Audio is NEVER transmitted — only processed text from client-side STT.
    """
    # Authenticate
    user = await verify_ws_token(websocket)
    if not user:
        await websocket.close(code=4001, reason="Authentication required")
        return

    module = websocket.query_params.get("module", "family_survey")
    await websocket.accept()

    logger.info("ambient_session_start", module=module)

    try:
        while True:
            # Receive message from client
            raw = await websocket.receive_text()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON",
                })
                continue

            text = data.get("text", "").strip()
            form_state = data.get("form_state", {})

            if not text:
                continue

            # Process through Gemini
            try:
                result = GeminiService.process_ambient_text(text, form_state, module)
                suggestions = result.get("suggestions", [])

                if suggestions:
                    await websocket.send_json({
                        "type": "suggestions",
                        "suggestions": suggestions,
                    })
                else:
                    await websocket.send_json({
                        "type": "no_match",
                        "message": "No relevant data found in conversation",
                    })

            except Exception as e:
                logger.error("ambient_processing_error", error=str(e))
                await websocket.send_json({
                    "type": "error",
                    "message": "Processing failed, try again",
                })

    except WebSocketDisconnect:
        logger.info("ambient_session_end", module=module)
    except Exception as e:
        logger.error("ambient_ws_error", error=str(e))
        try:
            await websocket.close(code=1011, reason="Internal error")
        except Exception:
            pass


from pydantic import BaseModel
class AskRequest(BaseModel):
    query: str
    language: str = "en"

from middleware.auth_middleware import verify_firebase_token

@router.post("/api/ambient/ask")
async def ask_asha_ai(request: AskRequest, user=Depends(verify_firebase_token)):
    """
    Handle generic queries from AskAshaAI chat interface.
    """
    try:
        # We can implement a quick text response via Gemini
        prompt = f"""You are AshaAI, a helpful, encouraging, and knowledgeable digital assistant for ASHA workers in rural India.
The standard language is {request.language}, try to respond mostly in {request.language}.
Keep your answer brief, actionable, and supportive. Use simple text.

User Query: "{request.query}"
"""
        from services.gemini_service import MODEL_NAME, _parse_json_response, _gemini_model
        
        response = _gemini_model.generate_content(prompt)
        text_resp = response.text
        
        return {
            "status": "success",
            "reply": text_resp
        }
    except Exception as e:
        logger.error("ask_asha_ai_error", error=str(e))
        return {
            "status": "error",
            "message": "AI could not process the request"
        }
