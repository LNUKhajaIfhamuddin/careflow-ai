import enum
import datetime as dt

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Enum,
    Text,
    Boolean,
)
from sqlalchemy.orm import relationship

from .database import Base


class UserRole(str, enum.Enum):
    patient = "patient"
    provider = "provider"
    admin = "admin"


class AppointmentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"


class Urgency(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.patient, nullable=False)
    specialty = Column(String, nullable=True)  # only relevant for providers
    phone = Column(String, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)
    is_active = Column(Boolean, default=True)

    appointments_as_patient = relationship(
        "Appointment",
        back_populates="patient",
        foreign_keys="Appointment.patient_id",
    )
    appointments_as_provider = relationship(
        "Appointment",
        back_populates="provider",
        foreign_keys="Appointment.provider_id",
    )
    notifications = relationship("Notification", back_populates="user")


class Specialty(Base):
    __tablename__ = "specialties"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    specialty = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    ai_summary = Column(Text, nullable=True)
    urgency = Column(Enum(Urgency), default=Urgency.low)
    status = Column(Enum(AppointmentStatus), default=AppointmentStatus.pending)
    scheduled_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    patient = relationship(
        "User", back_populates="appointments_as_patient", foreign_keys=[patient_id]
    )
    provider = relationship(
        "User", back_populates="appointments_as_provider", foreign_keys=[provider_id]
    )
    notifications = relationship("Notification", back_populates="appointment")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=True)
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=dt.datetime.utcnow)

    user = relationship("User", back_populates="notifications")
    appointment = relationship("Appointment", back_populates="notifications")
