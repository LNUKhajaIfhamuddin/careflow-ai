"""
Run with: python -m app.seed
Creates demo accounts so you can log in immediately without registering:

  admin@careflow.ai      / Admin123!    (admin)
  dr.patel@careflow.ai   / Provider123! (provider, Cardiology)
  dr.chen@careflow.ai    / Provider123! (provider, Pediatrics)
  jane.doe@example.com   / Patient123!  (patient)
"""
import datetime as dt

from .database import SessionLocal, Base, engine
from . import models, auth

Base.metadata.create_all(bind=engine)


def get_or_create_user(db, **kwargs):
    existing = db.query(models.User).filter(models.User.email == kwargs["email"]).first()
    if existing:
        return existing
    user = models.User(**kwargs)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def run():
    db = SessionLocal()

    admin = get_or_create_user(
        db,
        full_name="System Administrator",
        email="admin@careflow.ai",
        hashed_password=auth.hash_password("Admin123!"),
        role=models.UserRole.admin,
    )

    dr_patel = get_or_create_user(
        db,
        full_name="Dr. Anita Patel",
        email="dr.patel@careflow.ai",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Cardiology",
    )

    dr_chen = get_or_create_user(
        db,
        full_name="Dr. Michael Chen",
        email="dr.chen@careflow.ai",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Pediatrics",
    )

    jane = get_or_create_user(
        db,
        full_name="Jane Doe",
        email="jane.doe@example.com",
        hashed_password=auth.hash_password("Patient123!"),
        role=models.UserRole.patient,
    )

    if db.query(models.Appointment).count() == 0:
        appt = models.Appointment(
            patient_id=jane.id,
            provider_id=dr_patel.id,
            specialty="Cardiology",
            reason="Occasional chest tightness after exercise for the past week.",
            ai_summary="Patient reports exertional chest tightness lasting one week; recommend Cardiology evaluation with medium urgency.",
            urgency=models.Urgency.medium,
            status=models.AppointmentStatus.confirmed,
            scheduled_time=dt.datetime.utcnow() + dt.timedelta(days=2),
        )
        db.add(appt)
        db.commit()

    print("Seed complete. Demo accounts:")
    print("  admin@careflow.ai      / Admin123!    (admin)")
    print("  dr.patel@careflow.ai   / Provider123! (provider, Cardiology)")
    print("  dr.chen@careflow.ai    / Provider123! (provider, Pediatrics)")
    print("  jane.doe@example.com   / Patient123!  (patient)")

    db.close()


if __name__ == "__main__":
    run()
