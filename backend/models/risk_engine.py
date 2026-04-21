from pydantic import BaseModel
from typing import List, Literal, Optional

class RiskSignal(BaseModel):
    category: str
    description: str
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]

class RiskResult(BaseModel):
    score: int
    level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    signals: List[RiskSignal]
    recommendation: Optional[str]
