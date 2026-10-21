import uuid
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field

Status = Literal["pending", "confirmed", "waiting"]


class Participant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ext_id: str = ""
    name: str
    email: str = ""
    registration: Status = "pending"
    gender: Literal["M", "F", ""] = ""
    age: Optional[int] = None
    ala: str = ""
    estaca: str = ""
    phone: str = ""
    shirt: str = ""
    emergency_name: str = ""
    emergency_phone: str = ""
    medical: str = ""
    dietary: str = ""
    notes: str = ""
    team: int = 1
    contacted: bool = False
    status: Status = "pending"
    leader_note: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ParticipantUpdate(BaseModel):
    contacted: Optional[bool] = None
    status: Optional[Status] = None
    leader_note: Optional[str] = None
    team: Optional[int] = Field(default=None, ge=1, le=6)


class ImportResult(BaseModel):
    created: int
    updated: int
    total: int
    columns: dict[str, str]
