from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import date

class VillageHealthRecord(BaseModel):
    # Village level totals
    village_name: str
    area: Optional[str]
    total_households: Optional[int]
    total_population: Optional[int]
    male_population: Optional[int]
    female_population: Optional[int]
    under_5_population: Optional[int]
    adolescent_population: Optional[int]
    
    # Household-level details
    serial_number: Optional[int]
    house_number: Optional[str]
    family_head: Optional[str]
    bpl_apl_status: Literal["BPL", "APL", "Unknown"]
    
    # Sanitation
    toilet_availability: bool
    water_source: Optional[str]
    
    # Health status
    pregnant_women_count: Optional[int] = 0
    immunisation_status: Optional[str]
    
    # Disease surveillance this month
    tb_suspects: Optional[int] = 0
    malaria_cases: Optional[int] = 0
    dengue_cases_this_month: Optional[int] = 0

    asha_id: str
    created_at: Optional[str]
    updated_at: Optional[str]
    source: Literal["manual", "voice", "ocr_import", "ambient"]
