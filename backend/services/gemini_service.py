import json
import re
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig
from google.cloud import speech
import structlog

logger = structlog.get_logger()

MODEL_NAME = "gemini-2.5-flash"
_gemini_model = GenerativeModel(MODEL_NAME)

VOICE_PROMPTS = {
    "family_survey": """Extract family member data from this Marathi/Hindi/English transcript.
Return ONLY valid JSON, no explanation, no markdown:
{"house_number":null,"member_name":null,"gender":"Male|Female|Other|null",
"date_of_birth":"YYYY-MM-DD|null","age":null,"relationship_to_head":null,
"marital_status":"Married|Unmarried|Widow|Separated|null","mobile_number":null}
Transcript: {transcript}""",

    "child_growth": """Extract child health data from transcript.
Return ONLY valid JSON:
{"child_name":null,"age_months":null,"weight_kg":null,"height_cm":null,
"muac_mm":null,"feeding_issues":null,"mother_name":null}
Transcript: {transcript}""",

    "anc": """Extract maternal health data from transcript.
Return ONLY valid JSON:
{"mother_name":null,"lmp_date":"YYYY-MM-DD|null","haemoglobin":null,
"blood_pressure_systolic":null,"blood_pressure_diastolic":null,
"weight_kg":null,"anc_visit_number":null}
Transcript: {transcript}""",

    "vaccination": """Extract vaccination data from transcript.
Return ONLY valid JSON:
{"child_name":null,"age_months":null,"vaccine_given":null,
"visit_date":"YYYY-MM-DD|null","adverse_reaction":null}
Transcript: {transcript}""",

    "birth_record": """Extract birth record data from transcript.
Return ONLY valid JSON:
{"child_name":null,"date_of_birth":"YYYY-MM-DD|null","time_of_birth":null,
"birth_weight_kg":null,"gender":"Male|Female|null","place_of_birth":null,
"mother_name":null,"father_name":null,"delivery_type":null}
Transcript: {transcript}""",

    "death_record": """Extract death record data from transcript.
Return ONLY valid JSON:
{"deceased_name":null,"date_of_death":"YYYY-MM-DD|null","cause_of_death":null,
"age_at_death":null,"place_of_death":null,"maternal_death":null}
Transcript: {transcript}""",

    "village_survey": """Extract village health survey data from transcript.
Return ONLY valid JSON:
{"house_number":null,"family_head_name":null,"total_members":null,
"has_toilet":null,"water_source":null,"any_pregnant":null}
Transcript: {transcript}"""
}

async def transcribe_marathi(audio_bytes: bytes) -> str:
    client = speech.SpeechClient()
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        sample_rate_hertz=48000,
        language_code="mr-IN",
        model="chirp_2",
        alternative_language_codes=["hi-IN"],
        enable_automatic_punctuation=True,
    )
    audio = speech.RecognitionAudio(content=audio_bytes)
    response = client.recognize(config=config, audio=audio)
    return " ".join([r.alternatives[0].transcript for r in response.results])

async def structure_for_module(transcript: str, module_type: str) -> dict:
    model = GenerativeModel("gemini-2.0-flash-001")
    prompt = VOICE_PROMPTS.get(module_type, VOICE_PROMPTS["family_survey"])
    response = model.generate_content(
        prompt.replace("{transcript}", transcript),
        generation_config=GenerationConfig(response_mime_type="application/json")
    )
    import json
    try:
        return json.loads(response.text)
    except:
        return {}


def _sanitise_for_gemini(user_input: str) -> str:
    """Remove prompt injection attempts from user input."""
    patterns = [
        r"ignore previous instructions",
        r"system:",
        r"assistant:",
        r"</system>",
        r"<system>",
    ]
    sanitised = user_input
    for pattern in patterns:
        sanitised = re.sub(pattern, "", sanitised, flags=re.IGNORECASE)
    return sanitised.strip()[:2000]


def _parse_json_response(text: str) -> dict:
    """Extract JSON from Gemini response, handling markdown fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("gemini_json_parse_failed", raw=cleaned[:200])
        return {}


class GeminiService:
    """Wrapper around Gemini 2.0 Flash for structured data extraction."""

    @staticmethod
    def structure_voice_transcript(transcript: str, module: str) -> dict:
        """
        Take a raw transcript from voice dictation and extract structured 
        fields for the given module (family_survey, anc, child_growth, etc.)
        
        Returns a dict matching the module's field schema.
        """
        sanitised = _sanitise_for_gemini(transcript)

        prompts_by_module = {
            "family_survey": """Extract family survey data from the following spoken text by an ASHA worker.
Return a JSON object with these exact fields (use null for missing values):
{
  "member_name": "string",
  "gender": "Male" | "Female" | "Other",
  "date_of_birth": "YYYY-MM-DD" or null,
  "age": number or null,
  "relationship_to_head": "string",
  "marital_status": "Married" | "Unmarried" | "Widow" | "Separated",
  "aadhaar_number": "string" or null,
  "mobile_number": "string" or null,
  "abha_id": "string" or null
}""",
            "anc": """Extract ANC (Antenatal Care) registration data from the following spoken text.
Return a JSON object with these exact fields:
{
  "mother_name": "string",
  "husband_name": "string",
  "age": number,
  "lmp_date": "YYYY-MM-DD" or null,
  "edd_date": "YYYY-MM-DD" or null,
  "gravida": number or null,
  "para": number or null,
  "blood_group": "string" or null,
  "weight_kg": number or null,
  "bp_systolic": number or null,
  "bp_diastolic": number or null,
  "hemoglobin": number or null,
  "high_risk_factors": ["string"] or [],
  "registration_date": "YYYY-MM-DD" or null
}""",
            "child_growth": """Extract child growth monitoring data from the following spoken text.
Return a JSON object with these exact fields:
{
  "child_name": "string",
  "age_months": number,
  "weight_kg": number or null,
  "height_cm": number or null,
  "muac_cm": number or null,
  "muac_color": "GREEN" | "YELLOW" | "RED" or null,
  "feeding_status": "string" or null,
  "immunization_up_to_date": true | false | null,
  "illness_signs": ["string"] or []
}""",
            "vaccination": """Extract vaccination record data from the following spoken text.
Return a JSON object with these exact fields:
{
  "child_name": "string",
  "age_months": number or null,
  "vaccine_name": "string",
  "dose_number": number or null,
  "date_given": "YYYY-MM-DD" or null,
  "batch_number": "string" or null,
  "next_due_date": "YYYY-MM-DD" or null,
  "side_effects": "string" or null
}""",
            "village_survey": """Extract village mapping data from the following spoken text.
Return a JSON object with these exact fields:
{
  "total_households": number or null,
  "population": number or null,
  "water_sources": ["string"] or [],
  "sanitation_facilities_count": number or null
}""",
            "birth_record": """Extract birth record data from the following spoken text.
Return a JSON object with these exact fields:
{
  "child_name": "string" or null,
  "mother_name": "string" or null,
  "father_name": "string" or null,
  "date_of_birth": "YYYY-MM-DD" or null,
  "gender": "Male" | "Female" | "Other" or null,
  "birth_weight_kg": number or null,
  "place_of_birth": "string" or null
}""",
            "death_record": """Extract death record data from the following spoken text.
Return a JSON object with these exact fields:
{
  "deceased_name": "string" or null,
  "age_at_death": number or null,
  "date_of_death": "YYYY-MM-DD" or null,
  "cause_of_death": "string" or null,
  "place_of_death": "string" or null
}""",
            "disease_surveillance": """Extract disease surveillance data from the following spoken text.
Return a JSON object with these exact fields:
{
  "patient_name": "string" or null,
  "symptoms": ["string"] or [],
  "duration_days": number or null,
  "suspected_disease": "string" or null,
  "referral_hospital": "string" or null
}""",
            "ncd_tracking": """Extract non-communicable disease tracking data from the following spoken text.
Return a JSON object with these exact fields:
{
  "patient_name": "string" or null,
  "blood_pressure_systolic": number or null,
  "blood_pressure_diastolic": number or null,
  "blood_sugar_fasting": number or null,
  "known_conditions": ["string"] or [],
  "medication_compliance": true | false | null
}"""
        }

        system_prompt = prompts_by_module.get(module, prompts_by_module["family_survey"])

        full_prompt = f"""{system_prompt}

ASHA worker's spoken text:
\"{sanitised}\"

Return ONLY valid JSON. No explanation."""

        try:
            response = _gemini_model.generate_content(
                full_prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            return _parse_json_response(response.text)
        except Exception as e:
            logger.error("gemini_voice_structuring_error", error=str(e), module=module)
            raise


    @staticmethod
    def grade_muac_photo(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
        """
        Use Gemini Vision to analyze a photo of a child for visible signs of malnutrition.
        Works with any child photo — does NOT require MUAC tape to be visible.

        Returns:
        {
          "grade": "NORMAL" | "YELLOW" | "RED",
          "severity_label": "Normal" | "Moderate Acute Malnutrition (MAM)" | "Severe Acute Malnutrition (SAM)",
          "confidence": 0-100,
          "explanation": str,
          "visible_signs": [str],
          "recommendation": str,
          "needs_nrc_referral": true | false
        }
        """
        prompt = """You are a trained pediatric nutrition expert AI helping ASHA health workers in rural India.
Analyze this photograph of a child and assess visible signs of malnutrition.

Look for the following visible clinical indicators:
- Visible wasting: prominent ribs, sunken cheeks, thin limbs, loss of muscle mass
- Bilateral pitting oedema (swelling of feet/legs — indicates Kwashiorkor / SAM)
- Hair changes: sparse, discoloured, easily pluckable hair
- Skin changes: flaky, cracked, peeling skin, or skin lesions
- Visible MUAC tape color if present (RED < 12.5cm, YELLOW 12.5-13.4cm, GREEN >= 13.5cm)
- Overall body proportions and visible fat tissue
- Signs of stunting (small for apparent age)
- Child's alertness, activity level, facial expression

Based on your visual analysis, classify the child's malnutrition status:
- NORMAL: No visible signs. Child appears healthy with adequate fat and muscle.
- YELLOW: Moderate Acute Malnutrition (MAM). Some concerning signs visible — mild wasting or borderline MUAC tape.
- RED: Severe Acute Malnutrition (SAM). Clearly visible severe wasting, oedema, or MUAC tape in red zone. Requires immediate NRC referral.

Return ONLY valid JSON (no explanation outside the JSON):
{
  "grade": "NORMAL" | "YELLOW" | "RED",
  "severity_label": "Normal" | "Moderate Acute Malnutrition (MAM)" | "Severe Acute Malnutrition (SAM)",
  "confidence": <integer 0-100>,
  "explanation": "<2-3 sentence plain-language explanation of what you observed>",
  "visible_signs": ["<sign 1>", "<sign 2>"],
  "recommendation": "<action the ASHA worker should take>",
  "needs_nrc_referral": true | false
}

If the image is too unclear, blurry, or does not show a child, return grade "NORMAL" with confidence 10 and explanation indicating the image quality issue."""

        try:
            image_part = Part.from_data(data=image_bytes, mime_type=mime_type)
            response = _gemini_model.generate_content(
                [prompt, image_part],
                generation_config={"response_mime_type": "application/json"},
            )
            result = _parse_json_response(response.text)
            # Ensure confidence is an integer percentage
            if "confidence" in result and isinstance(result["confidence"], float) and result["confidence"] <= 1.0:
                result["confidence"] = int(result["confidence"] * 100)
            logger.info("malnutrition_scan_complete", grade=result.get("grade"), confidence=result.get("confidence"))
            return result
        except Exception as e:
            logger.error("malnutrition_scan_error", error=str(e))
            raise



    @staticmethod
    def extract_register_ocr(image_bytes: bytes, register_type: str = "family_survey", mime_type: str = "image/jpeg") -> dict:
        """
        Use Gemini Vision to extract structured data from a photographed 
        ASHA register page (using user specified register type).
        
        Returns: {"register_type": str, "rows": [...], "total_rows": int}
        """
        prompt = f"""
       You are reading a photo of an official ASHA worker health register from Maharashtra, India.
       Register type: {register_type}
       
       Extract every visible row. Return ONLY valid JSON:
       {{
         "register_type": "{register_type}",
         "rows": [
           {{
             "row_number": 1,
             "fields": {{}}, // exact field mapping for {register_type}
             "confidence": {{}}, // e.g. {{"columnA": 0.9}}
             "needs_review": false, // true if any confidence < 0.8
             "unreadable_fields": []
           }}
         ],
         "total_rows": 1
       }}
       Mark confidence <0.8 as needs_review. Return null for unreadable fields. No guessing.
       """

        try:
            image_part = Part.from_data(data=image_bytes, mime_type=mime_type)
            response = _gemini_model.generate_content(
                [prompt, image_part],
                generation_config={"response_mime_type": "application/json"},
            )
            result = _parse_json_response(response.text)
            logger.info(
                "register_ocr_complete",
                rows_found=result.get("total_rows_found", 0),
                needs_review=len(result.get("needs_review_indices", [])),
            )
            return result
        except Exception as e:
            logger.error("register_ocr_error", error=str(e))
            raise


    @staticmethod
    def validate_cross_fields(data: dict, module: str) -> dict:
        """
        Use Gemini to perform cross-field validation on structured data.
        Catches logical inconsistencies an ASHA worker might miss.
        
        Returns: {"is_valid": bool, "warnings": [...], "corrections": [...]}
        """
        sanitised_data = json.dumps(data, default=str)

        prompt = f"""You are a medical data validator for ASHA health worker records in rural India.

Validate the following {module} record for logical consistency:

{sanitised_data}

Check for:
- Age vs date of birth mismatch
- Impossible values (e.g., hemoglobin > 20, weight of child > 30kg for infant)
- Missing critical fields that should have values
- Gender-specific validations (e.g., pregnancy data for male)
- Date sequence errors (e.g., next due date before current date)

Return ONLY valid JSON:
{{
  "is_valid": true | false,
  "warnings": [
    {{"field": "string", "message": "string", "severity": "INFO" | "WARNING" | "ERROR"}}
  ],
  "suggested_corrections": [
    {{"field": "string", "current_value": "any", "suggested_value": "any", "reason": "string"}}
  ]
}}"""

        try:
            response = _gemini_model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            return _parse_json_response(response.text)
        except Exception as e:
            logger.error("cross_field_validation_error", error=str(e), module=module)
            return {"is_valid": True, "warnings": [], "suggested_corrections": []}


    @staticmethod
    def process_ambient_text(text: str, current_form_state: dict, module: str) -> dict:
        """
        Process ambient AI captured text against current form state.
        Suggests field values from overheard conversation.
        
        Returns: {"suggestions": [{"field": str, "value": any, "chip_label": str}]}
        """
        sanitised = _sanitise_for_gemini(text)
        form_json = json.dumps(current_form_state, default=str)

        prompt = f"""You are an ambient AI assistant for an ASHA health worker in rural India.
The ASHA worker is filling a {module} form. The current form state is:
{form_json}

The following text was captured from the ambient conversation:
"{sanitised}"

Extract any information from the conversation that maps to empty/null fields in the form.
Do NOT suggest values for fields that are already filled.

Return ONLY valid JSON:
{{
  "suggestions": [
    {{
      "field": "field_name",
      "value": "extracted_value",
      "chip_label": "short human-readable label for the suggestion chip"
    }}
  ]
}}"""

        try:
            response = _gemini_model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"},
            )
            return _parse_json_response(response.text)
        except Exception as e:
            logger.error("ambient_processing_error", error=str(e))
            return {"suggestions": []}
