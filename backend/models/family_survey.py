from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date

class FamilyMemberRecord(BaseModel):
    serial_number: int                              # अनु. क्र.
    house_number: str                               # घर क्रमांक
    member_name: str                                # कुटुंबातील सदस्याचे नाव
    gender: Literal["Male", "Female", "Other"]     # लिंग
    date_of_birth: Optional[date]                   # जन्म तारीख
    age: Optional[int]                              # वय (auto-calculated)
    relationship_to_head: str                       # कुटुंब प्रमुखाशी नाते
    marital_status: Literal[                        # विवाहित/अविवाहित/विधवा/विभक्त
        "Married", "Unmarried", "Widow", "Separated"]
    aadhaar_encrypted: Optional[str]                # आधार क्रमांक (encrypted)
    mobile_number: Optional[str]                    # मोबाईल क्रमांक
    abha_id_encrypted: Optional[str]                # आभा आय डी क्रमांक (encrypted)
    birth_register_serial: Optional[str]            # जन्मस्थ जोडण्या याटीतील क्रमांक
    reason_removed_from_register: Optional[str]     # वगळले असल्यास कारण
    asha_id: str                                    # Which ASHA submitted
    household_id: str                               # Parent household
    created_at: Optional[str]
    updated_at: Optional[str]
    source: Literal["manual", "voice", "ocr_import", "ambient"]
