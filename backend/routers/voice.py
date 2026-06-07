from fastapi import APIRouter, UploadFile, Depends, HTTPException, Form
from google.cloud import speech
from vertexai.generative_models import GenerativeModel, GenerationConfig
from middleware.auth_middleware import verify_firebase_token
import json, vertexai
from typing import Optional

router = APIRouter()
vertexai.init(project="ashaai-prod", location="asia-south1")

# ─── Fallback static prompts (used when form_fields not provided) ─────────────
VOICE_PROMPTS = {
    "family_survey": """{\"house_number\":null,\"member_name\":null,\"gender\":\"Male|Female|Other|null\",\"date_of_birth\":\"YYYY-MM-DD|null\",\"age\":null,\"relationship_to_head\":\"Self|Spouse|Son|Daughter|Parent|Sibling|null\",\"marital_status\":\"Married|Unmarried|Widow|Separated|null\",\"mobile_number\":null,\"total_family_members\":null}""",
    "child_growth":  """{\"child_name\":null,\"age_months\":null,\"weight_kg\":null,\"height_cm\":null,\"muac_mm\":null,\"mother_name\":null,\"feeding_issues\":null,\"last_visit_days_ago\":null}""",
    "anc":           """{\"mother_name\":null,\"husband_name\":null,\"age\":null,\"lmp_date\":\"YYYY-MM-DD|null\",\"edd_date\":\"YYYY-MM-DD|null\",\"gravida\":null,\"para\":null,\"blood_group\":null,\"weight_kg\":null,\"bp_systolic\":null,\"bp_diastolic\":null,\"hemoglobin\":null,\"high_risk_factors\":null}""",
    "vaccination":   """{\"child_name\":null,\"age_months\":null,\"vaccine_name\":null,\"date_given\":\"YYYY-MM-DD|null\",\"next_due_date\":\"YYYY-MM-DD|null\",\"adverse_reaction\":null}""",
    "birth_record":  """{\"child_name\":null,\"date_of_birth\":\"YYYY-MM-DD|null\",\"birth_weight_kg\":null,\"gender\":\"Male|Female|null\",\"place_of_birth\":null,\"mother_name\":null,\"father_name\":null,\"delivery_type\":\"Institutional|Home|null\"}""",
    "death_record":  """{\"deceased_name\":null,\"date_of_death\":\"YYYY-MM-DD|null\",\"cause_of_death\":null,\"age_at_death\":null,\"gender\":null,\"place_of_death\":\"Home|Hospital|null\"}""",
    "village_survey":"""{\"house_number\":null,\"family_head_name\":null,\"total_members\":null,\"has_toilet\":null,\"water_source\":null}""",
    "disease_surveillance": """{\"disease\":\"TB|Malaria|Dengue|Diarrhoea|Pneumonia|null\",\"patient_name\":null,\"age\":null,\"onset_date\":\"YYYY-MM-DD|null\",\"referred_to_phc\":null}""",
    "ncd_tracking":  """{\"patient_name\":null,\"condition\":\"Diabetes|Hypertension|null\",\"fasting_blood_sugar\":null,\"blood_pressure_systolic\":null,\"medication_compliance\":\"Good|Fair|Poor|null\"}""",
    "chat":          """{\"question\":\"the user's question in English\"}""",
}


def build_dynamic_prompt(form_fields: list[dict]) -> str:
    """Build a Gemini extraction prompt from the actual form field definitions.
    
    This guarantees the output JSON keys exactly match the form's field IDs,
    regardless of what the form is about.
    """
    # Build the JSON schema with helpful hints per field type
    schema_parts = []
    for f in form_fields:
        fid   = f.get("id", "")
        label = f.get("label", fid)
        ftype = f.get("type", "text")

        if ftype == "date":
            schema_parts.append(f'"{fid}": null  // {label} — format: YYYY-MM-DD if mentioned')
        elif ftype == "number":
            schema_parts.append(f'"{fid}": null  // {label} — numeric value only')
        elif ftype == "checkbox":
            schema_parts.append(f'"{fid}": null  // {label} — true or false')
        elif ftype == "select":
            schema_parts.append(f'"{fid}": null  // {label} — pick the closest matching option')
        elif ftype == "textarea":
            schema_parts.append(f'"{fid}": null  // {label} — free text summary')
        else:
            schema_parts.append(f'"{fid}": null  // {label}')

    schema_str = "{\n  " + ",\n  ".join(schema_parts) + "\n}"

    prompt = f"""You are a healthcare data entry assistant for ASHA (Accredited Social Health Activist) workers in India.
A field worker spoke in Marathi, Hindi, or English. Extract information from their speech and fill in the form fields below.

RULES:
- Return ONLY valid JSON with no markdown fences, no explanation, nothing else.
- Use EXACTLY the field IDs listed (keys must match exactly).
- Set a field to null if it was NOT mentioned in the speech — do not guess or invent values.
- For date fields, convert spoken dates to YYYY-MM-DD format.
- For number fields, extract only the numeric value.
- For boolean/checkbox fields, use true or false.
- Dates like "aaj" (today), "kal" (yesterday/tomorrow) should be interpreted relative to today.

FORM FIELDS (field_id: description):
{schema_str}

SPEECH TRANSCRIPT:
"""
    return prompt


from vertexai.generative_models import Part

async def process_audio_with_gemini(audio_bytes: bytes, module_type: str, form_fields: Optional[list] = None) -> dict:
    model = GenerativeModel("gemini-2.5-flash") # Use 1.5-flash for multimodal audio support
    
    audio_part = Part.from_data(data=audio_bytes, mime_type="audio/webm")

    if form_fields and len(form_fields) > 0:
        schema_parts = []
        for f in form_fields:
            fid   = f.get("id", "")
            label = f.get("label", fid)
            ftype = f.get("type", "text")

            if ftype == "date":
                schema_parts.append(f'"{fid}": null  // {label} — format: YYYY-MM-DD if mentioned')
            elif ftype == "number":
                schema_parts.append(f'"{fid}": null  // {label} — numeric value only')
            elif ftype == "checkbox":
                schema_parts.append(f'"{fid}": null  // {label} — true or false')
            elif ftype == "select":
                schema_parts.append(f'"{fid}": null  // {label} — pick the closest matching option')
            elif ftype == "textarea":
                schema_parts.append(f'"{fid}": null  // {label} — free text summary')
            else:
                schema_parts.append(f'"{fid}": null  // {label}')

        schema_str = "{\n      " + ",\n      ".join(schema_parts) + "\n    }"

        prompt = f"""You are a healthcare data entry assistant for ASHA workers in India.
Listen to the attached audio (which may be in Marathi, Hindi, or English) and extract the information.

Return ONLY valid JSON with exactly two root keys:
1. "transcript": A string containing the speech transcript in the original language.
2. "fields": An object containing the extracted data.

RULES for "fields":
- Use EXACTLY the field IDs listed below (keys must match exactly).
- Set a field to null if it was NOT mentioned in the speech — do not guess or invent values.
- For date fields, convert spoken dates to YYYY-MM-DD format.
- For number fields, extract only the numeric value.
- For boolean/checkbox fields, use true or false.

FIELDS SCHEMA:
{schema_str}
"""
    else:
        static_schema = VOICE_PROMPTS.get(module_type, VOICE_PROMPTS["family_survey"])
        prompt = f"""Listen to the attached audio (Marathi/Hindi/English) and extract structured data.
Return ONLY valid JSON with two root keys:
1. "transcript": The speech transcript.
2. "fields": An object matching exactly this schema (null for any not mentioned):
{static_schema}
"""

    try:
        response = model.generate_content(
            [audio_part, prompt],
            generation_config=GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,
            )
        )
        result = json.loads(response.text)
        transcript = result.get("transcript", "")
        fields_raw = result.get("fields", {})
        
        # Remove null values
        cleaned = {k: v for k, v in fields_raw.items() if v is not None and v != "" and v != "null"}
        return {"transcript": transcript, "fields": cleaned}
    except Exception as e:
        print(f"[Voice] Gemini extraction error: {e}")
        return {"transcript": "", "fields": {}, "error": str(e)}


@router.post("/api/voice/transcribe")
async def transcribe_voice(
    audio: UploadFile,
    module_type: str = Form("family_survey"),
    form_fields: Optional[str] = Form(None),
    user=Depends(verify_firebase_token)
):
    if not audio.filename:
        raise HTTPException(400, "No audio file provided")

    audio_bytes = await audio.read()

    if len(audio_bytes) < 1000:
        raise HTTPException(400, "Audio too short. Please speak for at least 2 seconds.")

    parsed_fields = None
    if form_fields:
        try:
            parsed_fields = json.loads(form_fields)
        except Exception:
            parsed_fields = None

    result = await process_audio_with_gemini(audio_bytes, module_type, parsed_fields)
    
    # clear buffer immediately
    audio_bytes = None

    transcript = result.get("transcript", "")
    fields_clean = result.get("fields", {})

    if "error" in result:
        return {
            "transcript": "",
            "fields": {},
            "module_type": module_type,
            "error": f"API Error: {result['error']}"
        }

    if not transcript and not fields_clean:
        return {
            "transcript": "",
            "fields": {},
            "module_type": module_type,
            "error": "Could not understand audio. Please try again."
        }

    # Remove internal error key before returning
    fields_clean = {k: v for k, v in fields_clean.items() if not k.startswith("_")}

    return {
        "transcript": transcript,
        "fields": fields_clean,
        "module_type": module_type,
        "fields_detected": len(fields_clean),
        "used_dynamic_prompt": parsed_fields is not None,
    }
