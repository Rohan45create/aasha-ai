from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone

class EditHistoryEntry(BaseModel):
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    asha_id: str
    field_changed: str
    old_value: Optional[str]
    new_value: Optional[str]
    reason: Optional[str]

class AuditTrail(BaseModel):
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    created_by: str
    edit_history: List[EditHistoryEntry] = []

    def log_edit(self, asha_id: str, field_changed: str, old_value: str, new_value: str, reason: str = None):
        """Append-only immutable audit trail recording."""
        self.edit_history.append(EditHistoryEntry(
            asha_id=asha_id,
            field_changed=field_changed,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        ))
