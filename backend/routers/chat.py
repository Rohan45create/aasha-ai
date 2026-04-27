from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
import structlog
from vertexai.generative_models import GenerativeModel, GenerationConfig, Content, Part
from middleware.auth_middleware import verify_firebase_token

logger = structlog.get_logger()
router = APIRouter(tags=["Chat API"])

# ── Request schema ──────────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str          # "user" | "ai"
    content: str

class ChatRequest(BaseModel):
    message: str
    language: Optional[str] = "en"
    conversation_history: Optional[List[ChatMessage]] = []

# ── Health knowledge base ───────────────────────────────────────────────────────
HEALTH_KNOWLEDGE = """
Key health protocols for ASHA workers in Maharashtra, India:

MALNUTRITION:
- SAM (Severe Acute Malnutrition): MUAC < 115mm OR weight-for-height Z-score < -3.
  Signs: severe wasting, bilateral pitting edema, sunken eyes.
  Action: IMMEDIATE NRC referral. Do not wait. Notify PHC / Medical Officer same day.
- MAM (Moderate Acute Malnutrition): MUAC 115–125mm.
  Action: Monthly follow-up, supplementary feeding (RUTF/Poshan). Refer if no improvement in 2 months.
- Normal: MUAC ≥ 125mm.

ANC (Antenatal Care):
- ANC1: Before 12 weeks — blood tests, BP, weight, counselling.
- ANC2: 14–26 weeks — scan, TT injection.
- ANC3: 28–34 weeks — Hb check, iron/folic acid.
- ANC4: After 36 weeks — birth planning.
- High risk signs: age < 18 or > 35, Hb < 8 g/dL, BP > 140/90, previous C-section, twins, abnormal presentation.
- JSY benefit: ₹1400 for institutional delivery (rural). Register early.

VACCINATION (NVHCP Schedule):
- Birth: BCG, OPV0, HepB
- 6 weeks: DPT1, OPV1, HepB2, PCV1
- 10 weeks: DPT2, OPV2, PCV2
- 14 weeks: DPT3, OPV3, PCV3, IPV
- 9 months: Measles, Vit A1, JE (endemic areas)
- 15 months: MMR, PCV booster, Vit A2
- 16–24 months: DPT booster, OPV booster

DANGER SIGNS (Refer Immediately):
- Child: high fever + stiff neck, convulsions, unconscious, severe dehydration, difficulty breathing.
- Pregnant woman: heavy bleeding, severe headache + blurred vision, reduced fetal movement, fits.
- Newborn: not feeding, yellow skin (jaundice), cold limbs, blue lips.

COMMON DISEASES:
- Diarrhoea: ORS + zinc for 14 days. Refer if blood in stool or child becomes lethargic.
- Malaria: RDT test. Refer positive cases to PHC for treatment.
- TB: refer cough > 2 weeks + weight loss + night sweats to DOTS centre.
- Hypertension: BP > 140/90 on 2 readings → refer to PHC. Low salt diet counselling.
- Diabetes: fasting sugar > 126 mg/dL → refer to PHC. Diet + exercise counselling.

SCHEMES / BENEFITS:
- JSY: ₹1400 rural, ₹1000 urban for institutional delivery.
- PMMVY: ₹5000 for first child after conditions met.
- ABHA / Aadhaar linkage: help family at nearest CSC or Aarogya Setu app.
- POSHAN Abhiyaan: monthly growth monitoring for children < 5 years.
"""

# ── Chat endpoint ───────────────────────────────────────────────────────────────
@router.post("/api/chat")
async def chat(
    req: ChatRequest,
    language: str = Query("en"),
    user=Depends(verify_firebase_token)
):
    """
    AI chat with Gemini for ASHA workers.
    Accepts JSON body: { message, language?, conversation_history? }
    Maintains multi-turn conversation context.
    """
    try:
        # Language preference: body takes precedence over query param
        lang = req.language or language
        lang_name = {"mr": "Marathi", "hi": "Hindi", "en": "English"}.get(lang, "English")

        model = GenerativeModel(
            "gemini-2.5-flash",
            system_instruction=(
                f"You are AshaAI, a friendly and knowledgeable health assistant for ASHA frontline workers in Maharashtra, India.\n"
                f"Always respond in {lang_name}. Keep answers brief, practical, and easy to understand for a field worker.\n"
                f"Use simple language. Avoid medical jargon unless necessary.\n"
                f"Base all answers on these official protocols:\n{HEALTH_KNOWLEDGE}\n\n"
                f"IMPORTANT RULES:\n"
                f"- Always recommend PHC/ANM for clinical decisions.\n"
                f"- Never prescribe medication dosages yourself.\n"
                f"- For emergencies (SAM, pregnancy danger signs, unconscious child), always say to go to PHC/hospital immediately.\n"
                f"- You can use bullet points, but keep responses concise (3-6 lines max unless more detail is clearly needed).\n"
                f"- If you don't know something, say so honestly and suggest consulting PHC/ANM."
            )
        )

        # Build multi-turn history from conversation_history
        history = []
        for msg in (req.conversation_history or []):
            role = "user" if msg.role == "user" else "model"
            history.append(Content(role=role, parts=[Part.from_text(msg.content)]))

        # Start a chat session with history
        chat_session = model.start_chat(history=history)

        response = chat_session.send_message(req.message)

        logger.info("chat_response_sent", lang=lang, user=user.get("uid", "?"))
        return {"response": response.text, "language": lang}

    except Exception as e:
        logger.error("chat_error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Chat API failed: {str(e)}")
