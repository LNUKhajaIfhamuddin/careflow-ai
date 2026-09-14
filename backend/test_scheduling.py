"""
Scheduling integration tests
=============================
Verifies double-booking prevention, 30-minute boundary validation,
cross-provider availability, and cancel-then-rebook flows.

Run with:
    cd backend
    python -m pytest test_scheduling.py -v
"""
import datetime as dt

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

# ── Bootstrap the app with an isolated in-memory SQLite DB ──────────────
from app.database import Base, get_db
from app.main import app
from app import models, auth

SQLALCHEMY_DATABASE_URL = "sqlite:///./test_scheduling.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)

# ── Future slot on a 30-minute boundary ─────────────────────────────────
SLOT = dt.datetime(2026, 9, 15, 10, 0, 0)  # 2026-09-15T10:00:00
SLOT_ISO = SLOT.isoformat()
BAD_SLOT_ISO = dt.datetime(2026, 9, 15, 10, 15, 0).isoformat()  # not on boundary


# ── Fixtures ────────────────────────────────────────────────────────────
@pytest.fixture(scope="module", autouse=True)
def setup_database():
    """Create tables and seed test users once for the entire module."""
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()

    # Patient 1 — needed to book appointments
    patient = models.User(
        full_name="Test Patient",
        email="testpatient@example.com",
        hashed_password=auth.hash_password("Test1234"),
        role=models.UserRole.patient,
    )
    db.add(patient)

    # Patient 2 — needed to test cross-provider concurrent booking
    patient2 = models.User(
        full_name="Second Patient",
        email="patient2@example.com",
        hashed_password=auth.hash_password("Test1234"),
        role=models.UserRole.patient,
    )
    db.add(patient2)

    # Provider: Dr. Khaja (Cardiology)
    khaja = models.User(
        full_name="Dr. Khaja Provider",
        email="khaja.cardio@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Cardiology",
    )
    db.add(khaja)

    # Provider: Dr. Anita Patel (Cardiology)
    anita = models.User(
        full_name="Dr. Anita Patel",
        email="patel.cardio@hospital.com",
        hashed_password=auth.hash_password("Provider123!"),
        role=models.UserRole.provider,
        specialty="Cardiology",
    )
    db.add(anita)

    # Admin: System Admin
    admin = models.User(
        full_name="Test Administrator",
        email="testadmin@hospital.com",
        hashed_password=auth.hash_password("Admin123!"),
        role=models.UserRole.admin,
    )
    db.add(admin)

    db.commit()
    db.close()

    yield

    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="module")
def admin_token():
    """Get a JWT for the test admin."""
    resp = client.post("/api/auth/login", json={
        "email": "testadmin@hospital.com",
        "password": "Admin123!",
    })
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def provider_token():
    """Get a JWT for Dr. Khaja."""
    resp = client.post("/api/auth/login", json={
        "email": "khaja.cardio@hospital.com",
        "password": "Provider123!",
    })
    assert resp.status_code == 200, f"Provider login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def patient_token():
    """Get a JWT for the test patient."""
    resp = client.post("/api/auth/login", json={
        "email": "testpatient@example.com",
        "password": "Test1234",
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def patient2_token():
    """Get a JWT for the second test patient."""
    resp = client.post("/api/auth/login", json={
        "email": "patient2@example.com",
        "password": "Test1234",
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def provider_ids():
    """Look up provider IDs by email so tests don't hard-code them."""
    db = TestingSessionLocal()
    khaja = db.query(models.User).filter(models.User.email == "khaja.cardio@hospital.com").first()
    anita = db.query(models.User).filter(models.User.email == "patel.cardio@hospital.com").first()
    db.close()
    return {"khaja": khaja.id, "anita": anita.id}


# ── Shared state across ordered tests ───────────────────────────────────
_state = {}


# ── Test Cases ──────────────────────────────────────────────────────────

def test_case_1_book_khaja_at_10(patient_token, provider_ids):
    """Book Dr. Khaja at 2026-09-15 10:00 → should succeed (201)."""
    resp = client.post(
        "/api/appointments",
        json={
            "reason": "Routine cardio checkup for scheduling test",
            "specialty": "Cardiology",
            "urgency": "low",
            "scheduled_time": SLOT_ISO,
            "provider_id": provider_ids["khaja"],
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["provider_id"] == provider_ids["khaja"]
    _state["khaja_appt_id"] = data["id"]
    print(f"  [OK] Created appointment #{data['id']} for Dr. Khaja at {SLOT_ISO}")


def test_case_2_duplicate_khaja_409(patient_token, provider_ids):
    """Duplicate booking for Dr. Khaja at 10:00 → HTTP 409 with suggested_slots."""
    resp = client.post(
        "/api/appointments",
        json={
            "reason": "Duplicate attempt",
            "specialty": "Cardiology",
            "urgency": "low",
            "scheduled_time": SLOT_ISO,
            "provider_id": provider_ids["khaja"],
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp.status_code == 409, f"Expected 409, got {resp.status_code}: {resp.text}"
    detail = resp.json()["detail"]
    assert "suggested_slots" in detail, f"Response missing suggested_slots: {detail}"
    assert isinstance(detail["suggested_slots"], list)
    print(f"  [OK] 409 Conflict returned with {len(detail['suggested_slots'])} suggested slot(s)")
    print(f"    Message: {detail['message']}")
    for s in detail["suggested_slots"]:
        print(f"    -> {s}")


def test_case_3_non_30min_boundary_rejected(patient_token, provider_ids):
    """Booking at 10:15 → HTTP 422 (fails 30-minute boundary validation)."""
    resp = client.post(
        "/api/appointments",
        json={
            "reason": "Off-boundary test",
            "specialty": "Cardiology",
            "urgency": "low",
            "scheduled_time": BAD_SLOT_ISO,
            "provider_id": provider_ids["khaja"],
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp.status_code == 422, f"Expected 422, got {resp.status_code}: {resp.text}"
    detail = resp.json()["detail"]
    # Check that the error mentions 30-minute boundary
    detail_str = str(detail).lower()
    assert "30-minute boundary" in detail_str or "30" in detail_str, (
        f"Expected error about 30-minute boundary, got: {detail}"
    )
    print(f"  [OK] 422 Validation error returned for 10:15 timestamp")


def test_case_4_book_anita_at_10(patient2_token, provider_ids):
    """Book Dr. Anita at the same 10:00 slot → should succeed (201, different doctor for distinct patient)."""
    resp = client.post(
        "/api/appointments",
        json={
            "reason": "Second cardio opinion – different provider",
            "specialty": "Cardiology",
            "urgency": "low",
            "scheduled_time": SLOT_ISO,
            "provider_id": provider_ids["anita"],
        },
        headers={"Authorization": f"Bearer {patient2_token}"},
    )
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["provider_id"] == provider_ids["anita"]
    print(f"  [OK] Created appointment #{data['id']} for Dr. Anita at {SLOT_ISO}")


def test_case_5_cancel_and_rebook_khaja(patient_token, provider_ids):
    """Cancel Dr. Khaja's 10:00, then rebook the same slot → should succeed (201)."""
    appt_id = _state.get("khaja_appt_id")
    assert appt_id is not None, "No appointment ID from test_case_1 -- run tests in order"

    # Cancel
    resp = client.delete(
        f"/api/appointments/{appt_id}",
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp.status_code == 204, f"Cancel failed: {resp.status_code}: {resp.text}"
    print(f"  [OK] Cancelled appointment #{appt_id}")

    # Rebook
    resp = client.post(
        "/api/appointments",
        json={
            "reason": "Re-booking after cancellation",
            "specialty": "Cardiology",
            "urgency": "low",
            "scheduled_time": SLOT_ISO,
            "provider_id": provider_ids["khaja"],
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp.status_code == 201, f"Expected 201 on rebook, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["provider_id"] == provider_ids["khaja"]
    print(f"  [OK] Re-booked appointment #{data['id']} for Dr. Khaja at {SLOT_ISO}")


def test_case_6_available_slots_filters_blocked(patient_token, provider_ids):
    """GET /api/appointments/available-slots excludes booked slots from open_slots."""
    resp = client.get(
        "/api/appointments/available-slots",
        params={
            "date": "2026-09-15",
            "specialty": "Cardiology",
            "provider_id": provider_ids["khaja"],
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.text}"
    data = resp.json()
    open_slot_isos = [s["iso"] for s in data["open_slots"]]
    # At this point, SLOT_ISO (2026-09-15T10:00:00) is booked for Dr. Khaja
    assert SLOT_ISO not in open_slot_isos, f"Expected {SLOT_ISO} to be blocked, but found in open_slots"
    # Other slots (e.g. 10:30) should be available
    assert "2026-09-15T10:30:00" in open_slot_isos
    print("  [OK] 10:00 slot correctly blocked and excluded from available open_slots")


def test_case_7_patient_cannot_double_book(patient_token, provider_ids):
    """Patient cannot book two appointments at the exact same time slot -> HTTP 409."""
    # Dr. Khaja is already booked at SLOT_ISO for this patient in test_case_5
    resp = client.post(
        "/api/appointments",
        json={
            "reason": "Attempting second appointment at same time",
            "specialty": "Cardiology",
            "urgency": "low",
            "scheduled_time": SLOT_ISO,
            "provider_id": provider_ids["khaja"],
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp.status_code == 409, f"Expected 409 Conflict, got {resp.status_code}: {resp.text}"
    detail = resp.json()["detail"]
    msg = detail["message"] if isinstance(detail, dict) else str(detail)
    assert "already have an appointment" in msg.lower()
    print("  [OK] Patient duplicate booking prevented with HTTP 409")


def test_case_8_past_slot_rejected(patient_token, provider_ids):
    """Booking a slot in the past is rejected with HTTP 422."""
    past_iso = (dt.datetime.now() - dt.timedelta(days=1)).replace(minute=0, second=0, microsecond=0).isoformat()
    resp = client.post(
        "/api/appointments",
        json={
            "reason": "Past appointment attempt",
            "specialty": "Cardiology",
            "urgency": "low",
            "scheduled_time": past_iso,
            "provider_id": provider_ids["khaja"],
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert resp.status_code == 422, f"Expected 422 Unprocessable Entity, got {resp.status_code}: {resp.text}"
    print("  [OK] Past slot rejected with HTTP 422")


def test_case_9_deactivated_user_token_rejected(admin_token, patient2_token):
    """Deactivated user's JWT token is immediately rejected with HTTP 403."""
    db = TestingSessionLocal()
    patient2 = db.query(models.User).filter(models.User.email == "patient2@example.com").first()
    patient2_id = patient2.id
    db.close()

    # Deactivate patient2
    resp = client.patch(
        f"/api/admin/users/{patient2_id}/deactivate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Patient2 now tries to make an authenticated request -> must fail with 403
    resp = client.get(
        "/api/appointments",
        headers={"Authorization": f"Bearer {patient2_token}"},
    )
    assert resp.status_code == 403, f"Expected 403, got {resp.status_code}: {resp.text}"

    # Reactivate patient2
    resp = client.patch(
        f"/api/admin/users/{patient2_id}/activate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True

    # Patient2 now tries to make an authenticated request -> succeeds
    resp = client.get(
        "/api/appointments",
        headers={"Authorization": f"Bearer {patient2_token}"},
    )
    assert resp.status_code == 200
    print("  [OK] Deactivated user token immediately rejected with 403 and restored on reactivation")


def test_case_10_admin_cannot_self_deactivate(admin_token):
    """Admin cannot deactivate their own account -> HTTP 400."""
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert me_resp.status_code == 200
    admin_id = me_resp.json()["id"]

    resp = client.patch(
        f"/api/admin/users/{admin_id}/deactivate",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 400
    assert "Cannot deactivate your own" in resp.json()["detail"]
    print("  [OK] Admin self-deactivation prevented with HTTP 400")


def test_case_11_admin_analytics_confirmed_count(admin_token):
    """Admin analytics summary includes confirmed_appointments count."""
    resp = client.get(
        "/api/admin/analytics",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "confirmed_appointments" in data
    assert isinstance(data["confirmed_appointments"], int)
    print("  [OK] confirmed_appointments verified in Admin analytics")


def test_case_12_deactivated_provider_cannot_be_booked(admin_token, patient_token, provider_ids):
    """Deactivated provider is excluded from list and cannot be booked."""
    anita_id = provider_ids["anita"]

    # Deactivate Dr. Anita
    resp = client.patch(f"/api/admin/users/{anita_id}/deactivate", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200

    # Verify Anita is not returned in active providers list
    prov_resp = client.get("/api/users/providers", headers={"Authorization": f"Bearer {patient_token}"})
    active_ids = [p["id"] for p in prov_resp.json()]
    assert anita_id not in active_ids

    # Try booking Anita -> fails with 400
    target_slot = dt.datetime(2026, 9, 20, 11, 0, 0).isoformat()
    book_resp = client.post(
        "/api/appointments",
        json={
            "reason": "Cardio check",
            "specialty": "Cardiology",
            "urgency": "low",
            "scheduled_time": target_slot,
            "provider_id": anita_id,
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert book_resp.status_code == 400

    # Reactivate Anita
    reactivate_resp = client.patch(f"/api/admin/users/{anita_id}/activate", headers={"Authorization": f"Bearer {admin_token}"})
    assert reactivate_resp.status_code == 200
    print("  [OK] Deactivated provider excluded from providers list and rejected on booking")


def test_case_13_admin_cannot_double_book_on_assignment(admin_token, patient_token, patient2_token, provider_ids):
    """Assigning a provider via PATCH validates against double-booking."""
    slot_time = dt.datetime(2026, 9, 22, 14, 0, 0).isoformat()
    khaja_id = provider_ids["khaja"]
    anita_id = provider_ids["anita"]

    # 1. Book Khaja at 14:00
    r1 = client.post(
        "/api/appointments",
        json={
            "reason": "Khaja visit",
            "specialty": "Cardiology",
            "urgency": "low",
            "scheduled_time": slot_time,
            "provider_id": khaja_id,
        },
        headers={"Authorization": f"Bearer {patient_token}"},
    )
    assert r1.status_code == 201
    appt1_id = r1.json()["id"]

    # 2. Book Anita at 14:00 with patient 2
    r2 = client.post(
        "/api/appointments",
        json={
            "reason": "Anita visit",
            "specialty": "Cardiology",
            "urgency": "low",
            "scheduled_time": slot_time,
            "provider_id": anita_id,
        },
        headers={"Authorization": f"Bearer {patient2_token}"},
    )
    assert r2.status_code == 201
    appt2_id = r2.json()["id"]

    # 3. Admin tries to reassign appt2 from Anita to Khaja without changing scheduled_time -> 409 conflict
    patch_resp = client.patch(
        f"/api/appointments/{appt2_id}",
        json={"provider_id": khaja_id},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert patch_resp.status_code == 409, f"Expected 409 Conflict on doctor assignment, got {patch_resp.status_code}"
    print("  [OK] Doctor assignment double-booking prevented with HTTP 409")


def test_case_14_notifications_flow_and_mark_read(patient_token):
    """Patient can view and mark notifications as read."""
    resp = client.get("/api/appointments/notifications/me", headers={"Authorization": f"Bearer {patient_token}"})
    assert resp.status_code == 200
    notes = resp.json()
    assert len(notes) > 0

    # Mark all read
    read_resp = client.post("/api/appointments/notifications/read-all", headers={"Authorization": f"Bearer {patient_token}"})
    assert read_resp.status_code == 200

    # Verify all are read
    after_resp = client.get("/api/appointments/notifications/me", headers={"Authorization": f"Bearer {patient_token}"})
    assert all(n["is_read"] for n in after_resp.json())
    print("  [OK] Notifications list and mark-all-read endpoint verified")


