import datetime as dt
from typing import Dict, List, Optional, Union

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


def _to_out(appt: models.Appointment) -> schemas.AppointmentOut:
    out = schemas.AppointmentOut.model_validate(appt)
    out.patient_name = appt.patient.full_name if appt.patient else None
    out.patient_email = appt.patient.email if appt.patient else None
    out.patient_phone = appt.patient.phone if appt.patient else None
    out.provider_name = appt.provider.full_name if appt.provider else None
    return out


def _get_appointment_or_404(db: Session, appointment_id: int) -> models.Appointment:
    appt = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


# ---------------------------------------------------------------------------
# Double-booking detection & nearest-slot recommendation engine
# ---------------------------------------------------------------------------

_SLOT_DURATION = dt.timedelta(minutes=30)
_MAX_SCAN_OFFSETS = 3  # scan up to ±3 slots (±90 min) in each direction
_MAX_SUGGESTIONS = 4   # return at most 4 alternative timestamps

_ACTIVE_STATUSES = [
    models.AppointmentStatus.pending,
    models.AppointmentStatus.confirmed,
]


def _provider_ids_for_specialty(db: Session, specialty: str) -> List[int]:
    """Return IDs of every active provider in *specialty*."""
    return [
        uid
        for (uid,) in db.query(models.User.id).filter(
            models.User.role == models.UserRole.provider,
            models.User.specialty == specialty,
            models.User.is_active == True,
        ).all()
    ]


def _booked_provider_ids_at(
    db: Session,
    slot_start: dt.datetime,
    provider_ids: List[int],
    exclude_appointment_id: Optional[int] = None,
) -> set:
    """Return the subset of *provider_ids* that have an active appointment
    at *slot_start* (exact match — all times sit on 30-min boundaries).
    """
    q = db.query(models.Appointment.provider_id).filter(
        models.Appointment.provider_id.in_(provider_ids),
        models.Appointment.status.in_(_ACTIVE_STATUSES),
        # All scheduled_time values are validated to fall on 30-minute
        # boundaries (minute ∈ {0, 30}, seconds = 0).  Each appointment
        # occupies exactly one 30-min slot.  Two such slots overlap iff
        # they start at the same time — a simple equality check suffices.
        models.Appointment.scheduled_time == slot_start,
    )
    if exclude_appointment_id is not None:
        q = q.filter(models.Appointment.id != exclude_appointment_id)
    return {pid for (pid,) in q.all()}


def find_slot_conflict_and_alternatives(
    db: Session,
    scheduled_time: dt.datetime,
    specialty: Optional[str],
    provider_id: Optional[int] = None,
    exclude_appointment_id: Optional[int] = None,
) -> Optional[Dict[str, Union[str, int, List[str]]]]:
    """Check whether *scheduled_time* is double-booked and, if so, suggest
    nearby 30-minute slots that are still available.

    Returns ``None`` when the slot is available (no conflict).

    When a conflict exists the return value is a dict::

        {
            "message": "...",
            "suggested_slots": ["2025-06-15T10:00:00", ...],
            # If "any doctor" mode resolved to a free provider:
            "assigned_provider_id": 42,          # only when applicable
        }
    """
    if scheduled_time is None:
        return None  # nothing to check

    req_start = scheduled_time

    # -- Specific-provider mode ------------------------------------------
    if provider_id is not None:
        booked = _booked_provider_ids_at(
            db, req_start, [provider_id], exclude_appointment_id
        )
        if provider_id not in booked:
            return None  # slot is free

        # Provider is busy – scan nearby slots for alternatives
        now_compare = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
        suggestions: List[str] = []
        for offset_idx in range(1, _MAX_SCAN_OFFSETS + 1):
            for direction in (-1, 1):
                candidate = req_start + direction * offset_idx * _SLOT_DURATION
                if candidate < now_compare:
                    continue  # don't suggest past slots
                if candidate.hour < 8 or candidate.hour >= 18:
                    continue  # outside clinic operating hours (08:00 - 18:00)
                busy = _booked_provider_ids_at(
                    db, candidate, [provider_id], exclude_appointment_id
                )
                if provider_id not in busy:
                    suggestions.append(candidate.isoformat())
                if len(suggestions) >= _MAX_SUGGESTIONS:
                    break
            if len(suggestions) >= _MAX_SUGGESTIONS:
                break

        return {
            "message": (
                "The selected provider already has an appointment at this time."
            ),
            "suggested_slots": suggestions,
        }

    # -- "Any Doctor" mode -----------------------------------------------
    effective_specialty = specialty or "General Practice"
    all_provider_ids = _provider_ids_for_specialty(db, effective_specialty)

    if not all_provider_ids:
        return None  # no providers to conflict with

    booked_at_requested = _booked_provider_ids_at(
        db, req_start, all_provider_ids, exclude_appointment_id
    )
    # Also check unassigned active appointments in this specialty
    unassigned_count = db.query(models.Appointment).filter(
        models.Appointment.provider_id == None,
        models.Appointment.specialty == effective_specialty,
        models.Appointment.status.in_(_ACTIVE_STATUSES),
        models.Appointment.scheduled_time == req_start,
    ).count()

    free_at_requested = set(all_provider_ids) - booked_at_requested
    if len(free_at_requested) > unassigned_count:
        # At least one provider is free — pick the first available
        return {
            "assigned_provider_id": min(free_at_requested),  # deterministic pick
        }  # type: ignore[return-value]

    # ALL providers are busy at the requested time — scan nearby slots
    now_compare = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)
    suggestions: List[str] = []
    for offset_idx in range(1, _MAX_SCAN_OFFSETS + 1):
        for direction in (-1, 1):
            candidate = req_start + direction * offset_idx * _SLOT_DURATION
            if candidate < now_compare:
                continue
            if candidate.hour < 8 or candidate.hour >= 18:
                continue  # outside clinic operating hours (08:00 - 18:00)
            booked = _booked_provider_ids_at(
                db, candidate, all_provider_ids, exclude_appointment_id
            )
            if set(all_provider_ids) - booked:
                suggestions.append(candidate.isoformat())
            if len(suggestions) >= _MAX_SUGGESTIONS:
                break
        if len(suggestions) >= _MAX_SUGGESTIONS:
            break

    return {
        "message": (
            f"All {effective_specialty} providers are booked at this time."
        ),
        "suggested_slots": suggestions,
    }


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
    # Now we verify the referenced user actually exists and is an active provider.
    if payload.provider_id is not None:
        provider = (
            db.query(models.User)
            .filter(
                models.User.id == payload.provider_id,
                models.User.role == models.UserRole.provider,
                models.User.is_active == True,
            )
            .first()
        )
        if not provider:
            raise HTTPException(status_code=400, detail="Selected provider does not exist or is inactive.")

    # ── Double-booking check ────────────────────────────────────────
    resolved_provider_id = payload.provider_id
    if payload.scheduled_time is not None:
        # Prevent patient from duplicate booking at the same slot (with same or different doctor)
        existing_patient_appt = db.query(models.Appointment).filter(
            models.Appointment.patient_id == current_user.id,
            models.Appointment.status.in_(_ACTIVE_STATUSES),
            models.Appointment.scheduled_time == payload.scheduled_time,
        ).first()
        if existing_patient_appt:
            alt_conflict = find_slot_conflict_and_alternatives(
                db,
                scheduled_time=payload.scheduled_time,
                specialty=payload.specialty,
                provider_id=resolved_provider_id,
            )
            suggested = alt_conflict.get("suggested_slots", []) if alt_conflict else []
            msg = (
                "You already have an appointment with this doctor at this time. Please choose a different slot."
                if resolved_provider_id is not None and existing_patient_appt.provider_id == resolved_provider_id
                else "You already have another appointment scheduled at this time. Please choose a different slot."
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": msg,
                    "suggested_slots": suggested,
                },
            )

        conflict = find_slot_conflict_and_alternatives(
            db,
            scheduled_time=payload.scheduled_time,
            specialty=payload.specialty,
            provider_id=payload.provider_id,
        )
        if conflict is not None:
            # "Any Doctor" mode may auto-assign a free provider
            if "assigned_provider_id" in conflict and "message" not in conflict:
                resolved_provider_id = conflict["assigned_provider_id"]
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=conflict,
                )

    appt = models.Appointment(
        patient_id=current_user.id,
        provider_id=resolved_provider_id,
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

    if resolved_provider_id is not None:
        slot_str = appt.scheduled_time.strftime('%b %d, %Y at %I:%M %p') if appt.scheduled_time else 'an open slot'
        note_prov = models.Notification(
            user_id=resolved_provider_id,
            appointment_id=appt.id,
            message=f"New appointment booked with patient {current_user.full_name} for {slot_str}.",
        )
        db.add(note_prov)

    db.commit()

    return _to_out(appt)


@router.get("", response_model=List[schemas.AppointmentOut])
def list_appointments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    query = db.query(models.Appointment)
    if current_user.role == models.UserRole.patient:
        query = query.filter(models.Appointment.patient_id == current_user.id).order_by(models.Appointment.created_at.desc())
    elif current_user.role == models.UserRole.provider:
        query = query.filter(models.Appointment.provider_id == current_user.id).order_by(
            models.Appointment.scheduled_time.asc().nullslast(),
            models.Appointment.created_at.desc(),
        )
    else:
        # admin sees all
        query = query.order_by(models.Appointment.created_at.desc())
    appts = query.all()
    return [_to_out(a) for a in appts]


@router.get("/available-slots")
def get_available_slots(
    date: str,
    specialty: Optional[str] = None,
    provider_id: Optional[int] = None,
    client_time: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """Return open 30-minute interval slots for a given date, excluding blocked slots."""
    try:
        target_date = dt.date.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Expected YYYY-MM-DD.")

    effective_specialty = specialty or "General Practice"
    if provider_id is not None:
        prov = db.query(models.User).filter(
            models.User.id == provider_id,
            models.User.role == models.UserRole.provider,
            models.User.is_active == True,
        ).first()
        if not prov:
            raise HTTPException(status_code=404, detail="Selected provider does not exist.")
        candidate_provider_ids = [provider_id]
    else:
        candidate_provider_ids = _provider_ids_for_specialty(db, effective_specialty)

    # Query active appointments on target date
    start_of_day = dt.datetime.combine(target_date, dt.time.min)
    end_of_day = dt.datetime.combine(target_date, dt.time.max)

    # 1. Track slots already booked by current user (patient)
    patient_booked_times = set()
    if current_user and current_user.role == models.UserRole.patient:
        pat_appts = db.query(models.Appointment.scheduled_time).filter(
            models.Appointment.patient_id == current_user.id,
            models.Appointment.status.in_(_ACTIVE_STATUSES),
            models.Appointment.scheduled_time >= start_of_day,
            models.Appointment.scheduled_time <= end_of_day,
        ).all()
        for (st,) in pat_appts:
            if st is not None:
                patient_booked_times.add(st.replace(second=0, microsecond=0))

    # 2. Track provider appointments and unassigned appointments on target date
    booked_map: Dict[dt.datetime, set] = {}
    unassigned_count_map: Dict[dt.datetime, int] = {}
    if candidate_provider_ids:
        q = db.query(models.Appointment.scheduled_time, models.Appointment.provider_id).filter(
            models.Appointment.provider_id.in_(candidate_provider_ids),
            models.Appointment.status.in_(_ACTIVE_STATUSES),
            models.Appointment.scheduled_time >= start_of_day,
            models.Appointment.scheduled_time <= end_of_day,
        )
        for slot_time, pid in q.all():
            if slot_time is not None:
                norm_time = slot_time.replace(second=0, microsecond=0)
                booked_map.setdefault(norm_time, set()).add(pid)

        # Unassigned appointments in this specialty count against capacity in "Any Doctor" mode
        q_unassigned = db.query(models.Appointment.scheduled_time).filter(
            models.Appointment.provider_id == None,
            models.Appointment.specialty == effective_specialty,
            models.Appointment.status.in_(_ACTIVE_STATUSES),
            models.Appointment.scheduled_time >= start_of_day,
            models.Appointment.scheduled_time <= end_of_day,
        )
        for (slot_time,) in q_unassigned.all():
            if slot_time is not None:
                norm_time = slot_time.replace(second=0, microsecond=0)
                unassigned_count_map[norm_time] = unassigned_count_map.get(norm_time, 0) + 1

    now_local = dt.datetime.now()
    now_utc = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)

    # Parse client local datetime if provided
    client_now = None
    if client_time:
        try:
            raw_clean = client_time.replace("Z", "+00:00")
            parsed_client = dt.datetime.fromisoformat(raw_clean)
            client_now = dt.datetime(
                parsed_client.year, parsed_client.month, parsed_client.day,
                parsed_client.hour, parsed_client.minute, parsed_client.second
            )
        except Exception:
            client_now = None

    slots = []
    # Clinic operating hours: 08:00 to 18:00 (last 30-min appointment begins at 17:30)
    for hour in range(8, 18):
        for minute in (0, 30):
            slot_dt = dt.datetime.combine(target_date, dt.time(hour, minute))

            # Strictly determine if the slot is in the past:
            # 1. Target date is in the past
            # 2. Target date is today and slot time is earlier than or equal to current time
            is_past = False
            if client_now is not None:
                if target_date < client_now.date():
                    is_past = True
                elif target_date == client_now.date() and slot_dt <= client_now:
                    is_past = True
            elif target_date < now_local.date():
                is_past = True
            elif target_date == now_local.date() and slot_dt <= now_local:
                is_past = True
            elif target_date < now_utc.date():
                is_past = True
            elif target_date == now_utc.date() and slot_dt <= now_utc:
                is_past = True

            booked_pids = booked_map.get(slot_dt, set())
            unassigned_count = unassigned_count_map.get(slot_dt, 0)
            is_patient_booked = slot_dt in patient_booked_times

            if not candidate_provider_ids:
                is_blocked = True
            elif provider_id is not None:
                # When checking a specific doctor, block only if THAT doctor is already booked at this slot
                is_blocked = provider_id in booked_pids
            else:
                total_booked = len(booked_pids) + unassigned_count
                is_blocked = (
                    is_patient_booked
                    or total_booked >= len(candidate_provider_ids)
                    or set(candidate_provider_ids).issubset(booked_pids)
                )

            is_available = not is_past and not is_blocked

            slots.append({
                "time": slot_dt.strftime("%H:%M"),
                "label": slot_dt.strftime("%I:%M %p"),
                "iso": slot_dt.isoformat(),
                "available": is_available,
                "is_past": is_past,
                "is_booked": is_blocked and not is_past,
            })

    # Exclude blocked and past slots so patients only see open intervals
    open_slots = [s for s in slots if s["available"]]

    return {
        "date": date,
        "specialty": effective_specialty,
        "provider_id": provider_id,
        "total_slots": len(slots),
        "open_count": len(open_slots),
        "open_slots": open_slots,
        "all_slots": slots,
    }


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

    # ── Double-booking and doctor validation check ───────────────────
    new_time = updates.get("scheduled_time")
    new_provider_id = updates.get("provider_id")
    target_time = new_time if new_time is not None else appt.scheduled_time
    target_provider_id = new_provider_id if new_provider_id is not None else appt.provider_id
    provider_changed = new_provider_id is not None and new_provider_id != appt.provider_id

    if new_provider_id is not None:
        cand_provider = db.query(models.User).filter(
            models.User.id == new_provider_id,
            models.User.role == models.UserRole.provider,
            models.User.is_active == True,
        ).first()
        if not cand_provider:
            raise HTTPException(status_code=400, detail="Assigned provider does not exist or is inactive.")
        if appt.specialty and cand_provider.specialty and cand_provider.specialty.strip().lower() != appt.specialty.strip().lower():
            raise HTTPException(
                status_code=400,
                detail=f"Provider specialty ({cand_provider.specialty}) does not match appointment specialty ({appt.specialty}).",
            )

    if (new_time is not None or provider_changed) and target_time is not None and target_provider_id is not None:
        conflict = find_slot_conflict_and_alternatives(
            db,
            scheduled_time=target_time,
            specialty=appt.specialty,
            provider_id=target_provider_id,
            exclude_appointment_id=appointment_id,
        )
        if conflict is not None:
            if "assigned_provider_id" in conflict and "message" not in conflict:
                updates["provider_id"] = conflict["assigned_provider_id"]
            else:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=conflict,
                )

    for field, value in updates.items():
        setattr(appt, field, value)

    db.commit()
    db.refresh(appt)

    patient_name = appt.patient.full_name if appt.patient else 'Patient'

    if "status" in updates:
        note = models.Notification(
            user_id=appt.patient_id,
            appointment_id=appt.id,
            message=f"Your appointment status changed to '{updates['status'].value if hasattr(updates['status'], 'value') else updates['status']}'.",
        )
        db.add(note)
        db.commit()

    if new_time is not None:
        slot_label = new_time.strftime('%b %d, %Y at %I:%M %p')
        # Notify patient of new time
        db.add(models.Notification(
            user_id=appt.patient_id,
            appointment_id=appt.id,
            message=f"Your appointment has been rescheduled to {slot_label}.",
        ))
        # If rescheduled by someone other than the assigned doctor, notify the doctor
        if appt.provider_id and current_user.id != appt.provider_id:
            db.add(models.Notification(
                user_id=appt.provider_id,
                appointment_id=appt.id,
                message=f"Appointment with {patient_name} was rescheduled to {slot_label}.",
            ))
        db.commit()

    if provider_changed and updates.get("provider_id"):
        slot_label = appt.scheduled_time.strftime('%b %d, %Y at %I:%M %p') if appt.scheduled_time else 'an open slot'
        note_prov = models.Notification(
            user_id=updates["provider_id"],
            appointment_id=appt.id,
            message=f"You have been assigned to patient {patient_name}'s appointment ({slot_label}).",
        )
        db.add(note_prov)

        # Notify the patient of their newly assigned doctor
        assigned_prov = db.query(models.User).filter(models.User.id == updates["provider_id"]).first()
        if assigned_prov:
            doc_label = assigned_prov.full_name if assigned_prov.full_name.startswith("Dr.") else f"Dr. {assigned_prov.full_name}"
            db.add(models.Notification(
                user_id=appt.patient_id,
                appointment_id=appt.id,
                message=f"{doc_label} has been assigned to your appointment ({slot_label}).",
            ))
        db.commit()

    return _to_out(appt)


@router.delete("/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    appt = _get_appointment_or_404(db, appointment_id)

    if appt.status == models.AppointmentStatus.completed:
        raise HTTPException(status_code=400, detail="Cannot cancel an appointment that is already completed.")

    if current_user.role == models.UserRole.patient and appt.patient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment")
    # Fix: previously a provider could cancel ANY appointment, including ones
    # assigned to a different provider. Now restricted to their own.
    if current_user.role == models.UserRole.provider and appt.provider_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this appointment")

    appt.status = models.AppointmentStatus.cancelled
    db.commit()

    # Create notifications for cancellation
    if current_user.role == models.UserRole.patient:
        if appt.provider_id:
            db.add(models.Notification(
                user_id=appt.provider_id,
                appointment_id=appt.id,
                message=f"Patient {current_user.full_name} cancelled their appointment.",
            ))
            db.commit()
    else:
        # Cancelled by provider or admin
        db.add(models.Notification(
            user_id=appt.patient_id,
            appointment_id=appt.id,
            message="Your appointment has been cancelled.",
        ))
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


@router.patch("/notifications/{notification_id}/read", response_model=schemas.NotificationOut)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    note = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id,
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Notification not found")
    note.is_read = True
    db.commit()
    db.refresh(note)
    return note


@router.post("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "All notifications marked as read"}
