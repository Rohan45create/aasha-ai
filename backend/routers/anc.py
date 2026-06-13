from fastapi import APIRouter, Depends, HTTPException
import structlog
import json
from firebase_admin import firestore
from middleware.auth_middleware import verify_firebase_token
from vertexai.generative_models import GenerativeModel, GenerationConfig

logger = structlog.get_logger()
router = APIRouter(prefix="/api/anc", tags=["ANC & Genetics"])

@router.post("/genetic-prediction")
async def get_genetic_prediction(data: dict, decoded_token: dict = Depends(verify_firebase_token)):
    """Analyze family genetic history to predict maternal risks using Gemini"""
    try:
        db = firestore.client()
        household_id = data.get("householdId")
        mother_data = data.get("motherData", {})
        
        family_conditions = []
        if household_id:
            # Fetch family members to check for genetic conditions
            members = db.collection("household_members").where("householdId", "==", household_id).stream()
            for m in members:
                m_data = m.to_dict()
                if m_data.get("has_genetic_condition"):
                    cond = m_data.get("genetic_conditions", [])
                    notes = m_data.get("genetic_condition_notes", "")
                    family_conditions.append({
                        "relation": m_data.get("relationshipToHead", "Family Member"),
                        "conditions": cond,
                        "notes": notes
                    })
        
        # We generate a prediction even if there's no known family condition, 
        # as Gemini can analyze mother's age and health factors.
        model = GenerativeModel("gemini-2.5-flash")
        
        prompt = f"""
        You are an expert maternal-fetal medicine AI assistant.
        Analyze the following data for a pregnant woman to predict genetic and developmental risks.
        
        Mother's Data:
        - Age: {mother_data.get("age", "Unknown")}
        - Gravida: {mother_data.get("gravida", "Unknown")}
        - High Risk Factors: {mother_data.get("high_risk_factors", "None")}
        - Hemoglobin: {mother_data.get("hemoglobin", "Unknown")}
        
        Family Genetic History:
        {json.dumps(family_conditions)}
        
        Provide a JSON response ONLY with:
        {{
            "riskLevel": "LOW|MODERATE|HIGH",
            "predictionSummary": "A 2-3 sentence explanation of the risk.",
            "recommendedTests": ["List of recommended prenatal tests"],
            "precautions": ["List of precautions for the ASHA worker to advise"]
        }}
        """
        
        response = model.generate_content(
            prompt,
            generation_config=GenerationConfig(response_mime_type="application/json")
        )
        
        prediction = json.loads(response.text)
        return prediction
        
    except Exception as e:
        logger.error("genetic_prediction_failed", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to generate prediction")
