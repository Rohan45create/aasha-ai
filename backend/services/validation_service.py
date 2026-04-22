"""
Smart Validation Engine.

Two-layer validation:
1. Pydantic validators — immediate, deterministic checks
2. Gemini cross-field validation — AI-powered logical consistency checks
"""
from datetime import date, datetime
from typing import Any
import structlog

from services.gemini_service import GeminiService

logger = structlog.get_logger()


class ValidationResult:
    def __init__(self):
        self.errors: list[dict] = []
        self.warnings: list[dict] = []

    def add_error(self, field: str, message: str):
        self.errors.append({"field": field, "message": message, "severity": "ERROR"})

    def add_warning(self, field: str, message: str):
        self.warnings.append({"field": field, "message": message, "severity": "WARNING"})

    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0

    def to_dict(self) -> dict:
        return {
            "is_valid": self.is_valid,
            "errors": self.errors,
            "warnings": self.warnings,
        }


def validate_family_survey(data: dict) -> ValidationResult:
    """Pydantic-level deterministic validation for Family Survey fields."""
    result = ValidationResult()

    # Name is required
    name = data.get("member_name", "")
    if not name or len(name.strip()) < 2:
        result.add_error("member_name", "Name must be at least 2 characters")

    # Gender validation
    gender = data.get("gender")
    if gender and gender not in ("Male", "Female", "Other"):
        result.add_error("gender", "Gender must be Male, Female, or Other")

    # Age vs DOB cross-check
    age = data.get("age")
    dob = data.get("date_of_birth")
    if age is not None and dob:
        try:
            if isinstance(dob, str):
                dob_date = datetime.strptime(dob, "%Y-%m-%d").date()
            else:
                dob_date = dob
            calculated_age = (date.today() - dob_date).days // 365
            if abs(calculated_age - age) > 1:
                result.add_warning(
                    "age",
                    f"Age ({age}) doesn't match DOB (calculated: {calculated_age})",
                )
        except (ValueError, TypeError):
            pass

    # Age range check
    if age is not None:
        if age < 0 or age > 120:
            result.add_error("age", "Age must be between 0 and 120")

    # Aadhaar format validation (before encryption)
    aadhaar = data.get("aadhaar_number")
    if aadhaar and not aadhaar.replace(" ", "").replace("-", "").isdigit():
        result.add_error("aadhaar_number", "Aadhaar must contain only digits")
    if aadhaar and len(aadhaar.replace(" ", "").replace("-", "")) != 12:
        result.add_error("aadhaar_number", "Aadhaar must be exactly 12 digits")

    # Mobile number validation
    mobile = data.get("mobile_number")
    if mobile:
        clean_mobile = mobile.replace(" ", "").replace("-", "").replace("+91", "")
        if not clean_mobile.isdigit() or len(clean_mobile) != 10:
            result.add_error("mobile_number", "Mobile number must be 10 digits")

    # Marital status validation
    marital = data.get("marital_status")
    if marital and marital not in ("Married", "Unmarried", "Widow", "Separated"):
        result.add_error("marital_status", "Invalid marital status")

    return result


def validate_anc(data: dict) -> ValidationResult:
    """ANC-specific validation rules."""
    result = ValidationResult()

    age = data.get("age")
    if age is not None:
        if age < 14 or age > 55:
            result.add_warning("age", f"Unusual maternal age: {age}")
        if age < 18:
            result.add_warning("age", "High-risk: teenage pregnancy")

    # Hemoglobin check
    hb = data.get("hemoglobin")
    if hb is not None:
        if hb < 0 or hb > 20:
            result.add_error("hemoglobin", f"Impossible hemoglobin value: {hb}")
        elif hb < 7:
            result.add_warning("hemoglobin", "CRITICAL: Severe anemia — immediate referral")
        elif hb < 11:
            result.add_warning("hemoglobin", "Anemia detected — iron supplementation needed")

    # Blood pressure
    bp_sys = data.get("bp_systolic")
    bp_dia = data.get("bp_diastolic")
    if bp_sys is not None and bp_dia is not None:
        if bp_sys > 140 or bp_dia > 90:
            result.add_warning("bp_systolic", "High BP — possible pre-eclampsia risk")
        if bp_sys < 90:
            result.add_warning("bp_systolic", "Low BP — monitor closely")

    # Weight check
    weight = data.get("weight_kg")
    if weight is not None and (weight < 30 or weight > 150):
        result.add_error("weight_kg", f"Unusual weight value: {weight} kg")

    # LMP/EDD cross-check
    lmp = data.get("lmp_date")
    edd = data.get("edd_date")
    if lmp and edd:
        try:
            lmp_d = datetime.strptime(lmp, "%Y-%m-%d").date() if isinstance(lmp, str) else lmp
            edd_d = datetime.strptime(edd, "%Y-%m-%d").date() if isinstance(edd, str) else edd
            diff = (edd_d - lmp_d).days
            if diff < 250 or diff > 300:
                result.add_warning("edd_date", f"EDD-LMP gap is {diff} days (expected ~280)")
        except (ValueError, TypeError):
            pass

    return result


def validate_child_growth(data: dict) -> ValidationResult:
    """Child growth-specific validation."""
    result = ValidationResult()

    age_months = data.get("age_months")
    if age_months is not None and (age_months < 0 or age_months > 72):
        result.add_error("age_months", "Age must be 0-72 months for growth monitoring")

    weight = data.get("weight_kg")
    if weight is not None:
        if weight < 1 or weight > 30:
            result.add_error("weight_kg", f"Unusual child weight: {weight} kg")
        if age_months is not None and age_months < 6 and weight > 12:
            result.add_warning("weight_kg", f"Weight {weight}kg seems high for {age_months} months")

    muac = data.get("muac_cm")
    if muac is not None:
        if muac < 8 or muac > 20:
            result.add_error("muac_cm", f"Impossible MUAC value: {muac} cm")
        elif muac < 11.5:
            result.add_warning("muac_cm", "CRITICAL: SAM — immediate NRC referral needed")
        elif muac < 12.5:
            result.add_warning("muac_cm", "MAM — supplementary feeding program")

    height = data.get("height_cm")
    if height is not None and (height < 30 or height > 130):
        result.add_error("height_cm", f"Unusual child height: {height} cm")

    return result


VALIDATORS = {
    "family_survey": validate_family_survey,
    "anc": validate_anc,
    "child_growth": validate_child_growth,
}


async def validate_record(data: dict, module: str, use_ai: bool = True) -> dict:
    """
    Run both deterministic validators and optional Gemini AI cross-field check.
    
    Args:
        data: The record data to validate
        module: Module name (family_survey, anc, child_growth, etc.)
        use_ai: Whether to also run Gemini cross-field validation
        
    Returns:
        Combined validation result dict
    """
    # Layer 1: Deterministic Pydantic-level checks
    validator = VALIDATORS.get(module)
    if validator:
        pydantic_result = validator(data)
    else:
        pydantic_result = ValidationResult()

    combined = pydantic_result.to_dict()

    # Layer 2: AI cross-field validation (optional)
    if use_ai:
        try:
            ai_result = GeminiService.validate_cross_fields(data, module)
            ai_warnings = ai_result.get("warnings", [])
            ai_corrections = ai_result.get("suggested_corrections", [])

            combined["warnings"].extend(ai_warnings)
            combined["ai_corrections"] = ai_corrections

            # If AI says invalid and we have no errors, add a warning
            if not ai_result.get("is_valid", True) and combined["is_valid"]:
                combined["warnings"].append({
                    "field": "_ai_check",
                    "message": "AI validation flagged potential issues",
                    "severity": "WARNING",
                })

        except Exception as e:
            logger.warning("ai_validation_skipped", error=str(e))
            combined["ai_validation_skipped"] = True

    return combined
