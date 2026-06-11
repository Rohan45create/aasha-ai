from pydantic import BaseModel
from typing import Optional

class ChildRecord(BaseModel):
    # Added per instructions for orphan flags
    is_orphan: Optional[bool] = False
    has_parents: Optional[bool] = True
    family_linkage_skipped: Optional[bool] = False
