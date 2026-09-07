from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


def _to_out(appt: models.Appointment) -> schemas.AppointmentOut:
    out = schemas.AppointmentOut.model_validate(appt)
    out.patient_name = appt.patient.full_name if appt.patient else None
    out.provider_name = appt.provider.full_name if appt.provider else None
    return out


def _get_appointment_or_404(db: Session, appointment_id: int) -> models.Appointment:
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


@router.post("", response_model=schemas.AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(
    payload: schemas.AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    if current_user.role != models.UserRole.patient:
        raise HTTPException(status_code=403, detail="Only patients can book appointments")

    # Fix: previously any integer was accepted for provider_id, including IDs
    # that didn't exist or belonged to a non-provider (e.g. another patient).
    # Now we verify the referenced user actually exists and is a provider.
    if payload.provider_id is not None:
        provider = (
            db.query(models.User)
            .filter(models.User.id == payload.provider_id, models.User.role == models.UserRole.provider)
            .first()
        )
        if not provider:
            raise HTTPException(status_code=400, detail="Selected provider does not exist.")

    appt = models.Appointment(
        patient_id=current_user.id,
        provider_id=payload.provider_id,
        specialty=payload.specialty,
        reason=payload.reason,
        ai_summary=payload.ai_summary,
        urgency=payload.urgency or models.Urgency.low,
        scheduled_time=payload.scheduled_time,
        status=models.AppointmentStatus.pending,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)

    note = models.Notification(
        user_id=current_user.id,
        appointment_id=appt.id,
        message=f"Your appointment request for {appt.specialty or 'General Practice'} has been received.",
    )
    db.add(note)
    db.commit()

    return _to_out(appt)


@router.get("", response_model=List[schemas.AppointmentOut])
def list_appointments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.Appointment)
    if current_user.role == models.UserRole.patient:
        query = query.filter(models.Appointment.patient_id == current_user.id)
    elif current_user.role == models.UserRole.provider:
        query = query.filter(models.Appointment.provider_id == current_user.id)
    # admin sees all
    appts = query.order_by(models.Appointment.created_at.desc()).all()
    return [_to_out(a) for a in appts]


# Fields each role is permitted to change via PATCH. This is the fix for a
# bug where a patient could set their own appointment's status straight to
# "completed" or hijack another provider's schedule by editing provider_id.
ALLOWED_FIELDS_BY_ROLE = {
    models.UserRole.patient: {"scheduled_time"},
    models.UserRole.provider: {"status", "scheduled_time"},
    models.UserRole.admin: {"status", "scheduled_time", "provider_id", "urgency"},
}


@router.patch("/{appointment_id}", response_model=schemas.AppointmentOut)
def update_appointment(
    appointment_id: int,
    payload: schemas.AdminAppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    appt = _get_appointment_or_404(db, appointment_id)

    if current_user.role == models.UserRole.patient and appt.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this appointment")
    if current_user.role == models.UserRole.provider and appt.provider_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this appointment")

    allowed_fields = ALLOWED_FIELDS_BY_ROLE.get(current_user.role, set())
    updates = payload.model_dump(exclude_unset=True)
    rejected = set(updates.keys()) - allowed_fields
    if rejected:
        raise HTTPException(
            status_code=403,
            detail=f"Your role cannot modify: {', '.join(sorted(rejected))}",
        )

    for field, value in updates.items():
        setattr(appt, field, value)

    db.commit()
    db.refresh(appt)

    if "status" in updates:
        note = models.Notification(
            user_id=appt.patient_id,
            appointment_id=appt.id,
            message=f"Your appointment status changed to '{updates['status'].value if hasattr(updates['status'], 'value') else updates['status']}'.",
        )
        db.add(note)
        db.commit()

    return _to_out(appt)


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    appt = _get_appointment_or_404(db, appointment_id)

    if current_user.role == models.UserRole.patient and appt.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment")
    # Fix: previously a provider could cancel ANY appointment, including ones
    # assigned to a different provider. Now restricted to their own.
    if current_user.role == models.UserRole.provider and appt.provider_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment")

    appt.status = models.AppointmentStatus.cancelled
    db.commit()
    return None


@router.get("/notifications/me", response_model=List[schemas.NotificationOut])
def my_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )
