"""
Run with: python -m app.seed
Creates demo accounts so you can log in immediately without registering:

  Admin accounts:
    Configured securely via ADMIN_EMAIL and ADMIN_PASSWORD environment variables.

  Provider accounts (password: Provider123!):
    chen.ortho@hospital.com     – Dr. Robert Chen       (Orthopedics)
    jenkins.ortho@hospital.com  – Dr. Sarah Jenkins     (Orthopedics)
    vance.neuro@hospital.com    – Dr. Marcus Vance      (Neurology)
    rostova.neuro@hospital.com  – Dr. Elena Rostova     (Neurology)
    lin.derm@hospital.com       – Dr. Maya Lin          (Dermatology)
    kim.derm@hospital.com       – Dr. David Kim         (Dermatology)
    wilson.gp@hospital.com      – Dr. Sam Wilson        (General Practice)
    ray.gp@hospital.com         – Dr. Lisa Ray          (General Practice)
    bennett.peds@hospital.com   – Dr. Chloe Bennett     (Pediatrics)
    carter.peds@hospital.com    – Dr. James Carter      (Pediatrics)
    patel.cardio@hospital.com   – Dr. Anita Patel       (Cardiology)
    khaja.cardio@hospital.com   – Dr. Khaja Provider    (Cardiology)

  Patient accounts:
    khaja.patient@gmail.com / khaja1234  (patient)
    jane.doe@example.com    / Patient123! (patient)
"""
import os
import datetime as dt

from .database import SessionLocal, Base, engine
from . import models, auth

Base.metadata.create_all(bind=engine)


def get_or_create_user(db, **kwargs):
    existing = db.query(models.User).filter(models.User.email == kwargs["email"]).first()
    if existing:
        existing.hashed_password = kwargs["hashed_password"]
        existing.full_name = kwargs.get("full_name", existing.full_name)
        existing.role = kwargs.get("role", existing.role)
        db.commit()
        db.refresh(existing)
        return existing
    user = models.User(**kwargs)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def run():
    db = SessionLocal()

    # ── Admin account (Configured securely via environment variables) ──
    admin_email = os.getenv("ADMIN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    if admin_email and admin_password:
        get_or_create_user(
            db,
            full_name=os.getenv("ADMIN_NAME", "System Administrator"),
            email=admin_email,
            hashed_password=auth.hash_password(admin_password),
            role=models.UserRole.admin,
        )

    # ── Khaja personal accounts ─────────────────────────────────────
    provider_khaja = get_or_create_user(
        db,
        full_name="Dr. Khaja Provider",
        email="khaja.provider@gmail.com",
        hashed_password=auth.hash_password("khaja1234"),
        role=models.UserRole.provider,
        specialty="Cardiology",
    )

    patient_khaja = get_or_create_user(
        db,
        full_name="Khaja Patient",
        email="khaja.patient@gmail.com",
        hashed_password=auth.hash_password("khaja1234"),
        role=models.UserRole.patient,
    )

    # ── Orthopedics ─────────────────────────────────────────────────
    dr_robert_chen = get_or_create_user(
        db,
        full_name="Dr. Robert Chen",
        email="chen.ortho@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Orthopedics",
    )

    dr_sarah_jenkins = get_or_create_user(
        db,
        full_name="Dr. Sarah Jenkins",
        email="jenkins.ortho@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Orthopedics",
    )

    # ── Neurology ───────────────────────────────────────────────────
    dr_marcus_vance = get_or_create_user(
        db,
        full_name="Dr. Marcus Vance",
        email="vance.neuro@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Neurology",
    )

    dr_elena_rostova = get_or_create_user(
        db,
        full_name="Dr. Elena Rostova",
        email="rostova.neuro@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Neurology",
    )

    # ── Dermatology ─────────────────────────────────────────────────
    dr_maya_lin = get_or_create_user(
        db,
        full_name="Dr. Maya Lin",
        email="lin.derm@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Dermatology",
    )

    dr_david_kim = get_or_create_user(
        db,
        full_name="Dr. David Kim",
        email="kim.derm@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Dermatology",
    )

    # ── General Practice ────────────────────────────────────────────
    dr_sam_wilson = get_or_create_user(
        db,
        full_name="Dr. Sam Wilson",
        email="wilson.gp@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="General Practice",
    )

    dr_lisa_ray = get_or_create_user(
        db,
        full_name="Dr. Lisa Ray",
        email="ray.gp@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="General Practice",
    )

    # ── Pediatrics ──────────────────────────────────────────────────
    dr_chloe_bennett = get_or_create_user(
        db,
        full_name="Dr. Chloe Bennett",
        email="bennett.peds@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Pediatrics",
    )

    dr_james_carter = get_or_create_user(
        db,
        full_name="Dr. James Carter",
        email="carter.peds@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Pediatrics",
    )

    # ── Cardiology ──────────────────────────────────────────────────
    dr_anita_patel = get_or_create_user(
        db,
        full_name="Dr. Anita Patel",
        email="patel.cardio@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Cardiology",
    )

    dr_khaja_cardio = get_or_create_user(
        db,
        full_name="Dr. Khaja Provider",
        email="khaja.cardio@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Cardiology",
    )

    jane = get_or_create_user(
        db,
        full_name="Jane Doe",
        email="jane.doe@example.com",
        hashed_password=auth.hash_password("Patient123!"),
        role=models.UserRole.patient,
    )

    # Ensure a sample appointment for khaja patient & provider
    existing_khaja_appt = db.query(models.Appointment).filter(
        models.Appointment.patient_id == patient_khaja.id
    ).first()

    if not existing_khaja_appt:
        appt = models.Appointment(
            patient_id=patient_khaja.id,
            provider_id=provider_khaja.id,
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
    print("  khaja.provider@gmail.com / khaja1234 (provider, Cardiology)")
    print("  khaja.patient@gmail.com  / khaja1234 (patient)")

    db.close()


if __name__ == "__main__":
    run()
