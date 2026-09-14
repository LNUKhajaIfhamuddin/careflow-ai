from collections import Counter
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas, auth
from ..database import get_db

router = APIRouter(prefix="/api/admin", tags=["admin"])

require_admin = auth.require_role("admin")


@router.get("/users", response_model=List[schemas.UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


@router.patch("/users/{user_id}/deactivate", response_model=schemas.UserOut)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own administrator account.")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/activate", response_model=schemas.UserOut)
def activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    db.commit()
    db.refresh(user)
    return user


@router.get("/analytics", response_model=schemas.AnalyticsSummary)
def analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    total_patients = db.query(models.User).filter(
        models.User.role == models.UserRole.patient,
        models.User.is_active == True,
    ).count()
    total_providers = db.query(models.User).filter(
        models.User.role == models.UserRole.provider,
        models.User.is_active == True,
    ).count()
    appointments = db.query(models.Appointment).all()

    specialty_counts = Counter(a.specialty or "Unspecified" for a in appointments)
    urgency_counts = Counter(a.urgency.value if a.urgency else "low" for a in appointments)

    return schemas.AnalyticsSummary(
        total_patients=total_patients,
        total_providers=total_providers,
        total_appointments=len(appointments),
        pending_appointments=sum(1 for a in appointments if a.status == models.AppointmentStatus.pending),
        confirmed_appointments=sum(1 for a in appointments if a.status == models.AppointmentStatus.confirmed),
        completed_appointments=sum(1 for a in appointments if a.status == models.AppointmentStatus.completed),
        cancelled_appointments=sum(1 for a in appointments if a.status == models.AppointmentStatus.cancelled),
        appointments_by_specialty=dict(specialty_counts),
        appointments_by_urgency=dict(urgency_counts),
    )
