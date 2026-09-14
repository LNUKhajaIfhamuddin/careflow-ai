import datetime as dt
import re
from enum import Enum
from typing import Optional, List

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, ConfigDict
from datetime import timezone

from .models import UserRole, AppointmentStatus, Urgency


class PublicRole(str, Enum):
    """Roles selectable through the public registration endpoint.

    Deliberately excludes 'admin' — administrator accounts must be created
    out-of-band (e.g. via the seed script or by an existing admin), never
    through a self-service form. This closes a privilege-escalation
    vulnerability where anyone could register as an admin.
    """
    patient = "patient"
    provider = "provider"


def _validate_password_strength(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters long.")
    if len(password) > 72:
        # bcrypt silently ignores bytes beyond 72; reject instead of truncating.
        raise ValueError("Password must be 72 characters or fewer.")
    if not re.search(r"[A-Za-z]", password):
        raise ValueError("Password must include at least one letter.")
    if not re.search(r"[0-9]", password):
        raise ValueError("Password must include at least one number.")
    return password


# ---------- Auth / Users ----------
class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str
    role: PublicRole = PublicRole.patient
    specialty: Optional[str] = Field(default=None, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=30)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()

    @field_validator("full_name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Full name must be at least 2 characters.")
        return v

    @field_validator("specialty")
    @classmethod
    def strip_specialty(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else v

    @model_validator(mode="after")
    def require_specialty_for_providers(self):
        # Defense in depth: the frontend already requires this, but the API
        # must not trust the client — enforce it server-side too.
        if self.role == PublicRole.provider and not self.specialty:
            raise ValueError("Specialty is required when registering as a provider.")
        return self


class UserLogin(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    specialty: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True
    created_at: dt.datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------- AI Symptom Intake ----------
class SymptomIntakeRequest(BaseModel):
    # max_length caps request size to protect against abuse/cost blowup on
    # the OpenAI API; min effective length is enforced after stripping
    # whitespace so " " no longer passes as valid input.
    symptom_text: str = Field(min_length=1, max_length=2000)

    @field_validator("symptom_text")
    @classmethod
    def not_blank(cls, v: str) -> str:
        stripped = v.strip()
        if len(stripped) < 3:
            raise ValueError("Please describe your symptoms in at least 3 characters.")
        return stripped


class SymptomIntakeResponse(BaseModel):
    recommended_specialty: str
    urgency: Urgency
    summary: str
    suggested_reason: str
    source: str  # "openai" or "mock"


# ---------- Appointments ----------

def _validate_slot_boundary(v: Optional[dt.datetime]) -> Optional[dt.datetime]:
    """Ensure *scheduled_time* falls exactly on a 30-minute boundary.

    The minute component must be 0 or 30, and seconds / microseconds must
    both be 0.  This keeps the calendar grid clean and prevents
    nonsensical timestamps like 14:07:43.
    """
    if v is None:
        return v
    # Normalise timezone-aware datetimes to UTC then strip tzinfo so the
    # rest of the pipeline (DB column is naive-UTC) works consistently.
    if v.tzinfo is not None:
        v = v.astimezone(timezone.utc).replace(tzinfo=None)
    if v.minute not in (0, 30) or v.second != 0 or v.microsecond != 0:
        lower_min = 0 if v.minute < 30 else 30
        lower_dt = v.replace(minute=lower_min, second=0, microsecond=0)
        upper_dt = v.replace(minute=0, second=0, microsecond=0) + dt.timedelta(minutes=30 if v.minute < 30 else 60)
        diff_lower = abs((v - lower_dt).total_seconds())
        diff_upper = abs((upper_dt - v).total_seconds())
        if diff_lower <= diff_upper:
            nearest_dt, alt_dt = lower_dt, upper_dt
        else:
            nearest_dt, alt_dt = upper_dt, lower_dt
        raise ValueError(
            f"scheduled_time must fall on a 30-minute boundary (e.g. on the hour or half-hour). "
            f"Nearest open slot: {nearest_dt.strftime('%H:%M')} (alternative: {alt_dt.strftime('%H:%M')})."
        )
    return v


class AppointmentCreate(BaseModel):
    reason: str = Field(min_length=3, max_length=2000)
    specialty: Optional[str] = Field(default=None, max_length=100)
    urgency: Optional[Urgency] = Urgency.low
    ai_summary: Optional[str] = Field(default=None, max_length=2000)
    scheduled_time: Optional[dt.datetime] = None
    provider_id: Optional[int] = None

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Please provide a bit more detail about the reason for this visit.")
        return v

    @field_validator("scheduled_time")
    @classmethod
    def must_be_future_and_on_slot(cls, v: Optional[dt.datetime]) -> Optional[dt.datetime]:
        if v is not None:
            # Enforce 30-minute slot boundary first
            v = _validate_slot_boundary(v)
            now_utc = dt.datetime.now(timezone.utc).replace(tzinfo=None) - dt.timedelta(minutes=1)
            now_local = dt.datetime.now() - dt.timedelta(minutes=1)

            # Reject if the slot is in the past
            if v < now_utc and v < now_local:
                raise ValueError("Appointment time must be in the future.")
        return v


class AdminAppointmentUpdate(BaseModel):
    """Superset of every field any role might PATCH. The router validates
    incoming requests against this schema, then filters the resulting
    fields down to whatever the caller's role is actually allowed to touch
    (see ALLOWED_FIELDS_BY_ROLE in routers/appointments.py) — a patient
    submitting {"status": "completed"} will have that field rejected with
    a 403 rather than silently applied, which is the fix for a bug where
    patients could mark their own appointments as completed."""
    status: Optional[AppointmentStatus] = None
    scheduled_time: Optional[dt.datetime] = None
    provider_id: Optional[int] = None
    urgency: Optional[Urgency] = None

    @field_validator("scheduled_time")
    @classmethod
    def must_be_on_slot(cls, v: Optional[dt.datetime]) -> Optional[dt.datetime]:
        return _validate_slot_boundary(v)


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    provider_id: Optional[int]
    specialty: Optional[str]
    reason: Optional[str]
    ai_summary: Optional[str]
    urgency: Urgency
    status: AppointmentStatus
    scheduled_time: Optional[dt.datetime]
    created_at: dt.datetime
    patient_name: Optional[str] = None
    patient_email: Optional[EmailStr] = None
    patient_phone: Optional[str] = None
    provider_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ---------- Notifications ----------
class NotificationOut(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: dt.datetime
    appointment_id: Optional[int]

    model_config = ConfigDict(from_attributes=True)


# ---------- Admin analytics ----------
class AnalyticsSummary(BaseModel):
    total_patients: int
    total_providers: int
    total_appointments: int
    pending_appointments: int
    confirmed_appointments: int
    completed_appointments: int
    cancelled_appointments: int
    appointments_by_specialty: dict
    appointments_by_urgency: dict
