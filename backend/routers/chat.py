from fastapi import APIRouter, Depends, HTTPException, Query
import structlog
from vertexai.generative_models import GenerativeModel, GenerationConfig
from middleware.auth_middleware import verify_firebase_token

logger = structlog.get_logger()
router = APIRouter(tags=["Chat API"])

HEALTH_KNOWLEDGE = """
Key health protocols for ASHA workers in Maharashtra:

SAM (Severe Acute Malnutrition): MUAC <115mm or weight-for-height Z-score <-3. 
Immediate NRC referral required. Signs: severe wasting, bilateral pitting edema.

MAM (Moderate Acute Malnutrition): MUAC 115-125mm. Monthly follow-up. 
Supplementary feeding. Refer if no improvement in 2 months.

ANC Schedule: ANC1 before 12 weeks, ANC2 at 14-26 weeks, ANC3 at 28-34 weeks, ANC4 after 36 weeks.
High risk: age <18 or >35, Hb <8, BP >140/90, previous C-section.

NVHCP Vaccination: BCG+OPV0+HepB at birth. DPT1+OPV1+HepB2 at 6 weeks. 
Measles+JE at 9 months. MMR at 15 months. DPT booster at 16-24 months.

Aadhaar linkage for ABHA: help family members link Aadhaar at nearest CSC center.
JSY benefit: institutional delivery required, ₹1400 rural.
"""

@router.post("/api/chat")
async def chat(
    message: str,
    language: str = Query("en"),
    conversation_history: list = Query(default=[]),
    user=Depends(verify_firebase_token)
):
    try:
        model = GenerativeModel("gemini-2.0-flash-001")
        
        lang_name = {"mr": "Marathi", "hi": "Hindi", "en": "English"}.get(language, "English")
        
        system = f"""You are AshaAI, a helpful health assistant for ASHA frontline workers in Maharashtra, India.
    Answer in {lang_name}. Be brief and practical. Use simple language.
    Base answers on these protocols: {HEALTH_KNOWLEDGE}
    Always recommend PHC/ANM for clinical decisions. Never give medication dosages."""
        
        # We can construct explicit turn history if needed, but per the user prompt:
        messages = [{"role": "user", "parts": [system + "\n\nUser question: " + message]}]
        
        response = model.generate_content(messages)
        return {"response": response.text, "language": language}
    except Exception as e:
        logger.error("chat_error", error=str(e))
        raise HTTPException(status_code=500, detail="Chat API failed")
