# CareFlow AI

AI-powered patient care coordination and appointment management platform.

CareFlow AI helps patients describe symptoms in plain language and get routed
to the right specialty and urgency level, while giving providers and hospital
administrators the dashboards they need to manage schedules and operations.
**CareFlow AI is a decision-support tool — it does not provide medical
diagnoses.**

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Local setup](#local-setup)
  - [1. Database (PostgreSQL)](#1-database-postgresql)
  - [2. Backend (FastAPI)](#2-backend-fastapi)
  - [3. Frontend (React)](#3-frontend-react)
  - [Option: run everything with Docker Compose](#option-run-everything-with-docker-compose)
- [Demo accounts](#demo-accounts)
- [Environment variables](#environment-variables)
- [AI integration notes](#ai-integration-notes)
- [API overview](#api-overview)

## Features

- **Secure authentication** — JWT-based login/registration with bcrypt password hashing, and three roles: patient, provider, admin.
- **AI symptom intake** — patients describe symptoms in natural language; the backend calls the OpenAI GPT API (or a built-in rule-based fallback with no key configured) to recommend a specialty, flag urgency, and produce a plain-language summary for staff.
- **Appointment scheduling** — patients book appointments from their AI recommendation; providers confirm/complete them; anyone can cancel their own.
- **Role-based dashboards** — separate views for patients (appointments + symptom intake), providers (schedule triage queue), and admins (analytics + user/appointment management).
- **Notifications** — in-app notifications are created when an appointment is booked or its status changes.
- **Admin analytics** — charts for appointment volume by specialty and urgency, plus counts of pending/completed/cancelled appointments.
- **Form validation & error handling** — client-side validation on auth forms, and consistent error/loading states throughout the UI.
- **Responsive design** — usable on mobile, tablet, and desktop.

## Tech stack

| Layer          | Technology                                   |
|----------------|-----------------------------------------------|
| Frontend       | React (Vite), React Router, Recharts, Axios   |
| Backend        | FastAPI (Python), Uvicorn                     |
| Database       | PostgreSQL + SQLAlchemy ORM                   |
| Authentication | JWT (python-jose) + bcrypt (passlib)          |
| AI             | OpenAI GPT API (`gpt-4o-mini`) with rule-based fallback |
| Deployment     | Docker + Docker Compose (AWS App Runner-ready) |

## Project structure

```
careflow-ai/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + CORS + router registration
│   │   ├── database.py        # SQLAlchemy engine/session
│   │   ├── models.py          # User, Appointment, Specialty, Notification
│   │   ├── schemas.py         # Pydantic request/response models
│   │   ├── auth.py            # JWT + bcrypt helpers, role guards
│   │   ├── ai_service.py      # OpenAI + mock symptom analyzer
│   │   ├── seed.py            # Demo data seeding script
│   │   └── routers/
│   │       ├── auth.py
│   │       ├── ai.py
│   │       ├── users.py
│   │       ├── appointments.py
│   │       └── admin.py
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/client.js      # Axios instance + auth interceptor
│   │   ├── context/AuthContext.jsx
│   │   ├── components/        # AppShell, ProtectedRoute, UI primitives
│   │   ├── pages/              # Login, Register, dashboards, symptom intake
│   │   ├── App.jsx
│   │   ├── index.css           # Design tokens (color, type)
│   │   └── layout.css          # Layout-specific styles
│   └── .env.example
├── docker-compose.yml
└── README.md
```

## Local setup

### 1. Database (PostgreSQL)

Install PostgreSQL locally if you don't already have it (macOS: `brew install postgresql@16`; Windows/Linux: use the official installer or your package manager), then create the database and user:

```bash
psql postgres
```

```sql
CREATE USER careflow_user WITH PASSWORD 'careflow_pass';
CREATE DATABASE careflow_ai OWNER careflow_user;
\q
```

### 2. Backend (FastAPI)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # then edit .env if your DB credentials differ
```

Start the API (tables are created automatically on first run):

```bash
uvicorn app.main:app --reload --port 8000
```

Seed demo accounts and one sample appointment (recommended for your first run):

```bash
python -m app.seed
```

The API is now running at `http://localhost:8000`, with interactive docs at
`http://localhost:8000/docs`.

### 3. Frontend (React)

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env             # defaults already point to localhost:8000
npm run dev
```

Open `http://localhost:5173` in your browser.

### Option: run everything with Docker Compose

If you prefer containers over a local PostgreSQL install, from the project root:

```bash
docker compose up --build
```

This starts PostgreSQL and the FastAPI backend together (`http://localhost:8000`).
Run the frontend separately with `npm run dev` as above, or add your own
frontend service to `docker-compose.yml` if you want it containerized too.
Seed demo data with:

```bash
docker compose exec backend python -m app.seed
```

## Demo accounts

After running the seed script:

| Role     | Email                    | Password       |
|----------|--------------------------|----------------|
| Patient  | khaja.patient@gmail.com  | khaja1234      |
| Provider | khaja.provider@gmail.com | khaja1234      |
| Admin    | Set in .env (`ADMIN_EMAIL`) | Set in .env (`ADMIN_PASSWORD`) |

## Environment variables

**backend/.env**

| Variable                    | Description                                             |
|------------------------------|----------------------------------------------------------|
| `DATABASE_URL`               | PostgreSQL connection string                              |
| `SECRET_KEY`                 | Secret used to sign JWTs — set a long random value        |
| `ACCESS_TOKEN_EXPIRE_MINUTES`| Token lifetime in minutes (default 1440 = 24h)             |
| `OPENAI_API_KEY`             | Optional. Leave blank to use the built-in mock AI analyzer |
| `FRONTEND_ORIGIN`            | Allowed CORS origin for the frontend                       |
| `ADMIN_EMAIL`                | Optional admin email for initial account creation         |
| `ADMIN_PASSWORD`             | Optional admin password for initial account creation      |
| `ADMIN_NAME`                 | Optional admin full name (default: System Administrator)  |

**frontend/.env**

| Variable        | Description                        |
|-----------------|-------------------------------------|
| `VITE_API_URL`  | Base URL of the backend API          |

## AI integration notes

`app/ai_service.py` checks for `OPENAI_API_KEY` at request time:

- **Key present:** calls the OpenAI GPT API (`gpt-4o-mini`) with a system prompt
  that restricts it to triage/classification only (specialty + urgency +
  summary) — never a diagnosis — and parses a strict JSON response.
- **Key absent, or the API call fails for any reason:** falls back to a
  transparent, rule-based keyword analyzer so the app is fully functional and
  demoable with zero external cost or dependency. The UI shows which mode
  produced each recommendation.

## API overview

| Method | Endpoint                              | Description                          |
|--------|----------------------------------------|---------------------------------------|
| POST   | `/api/auth/register`                   | Create an account, returns JWT         |
| POST   | `/api/auth/login`                      | Log in, returns JWT                    |
| GET    | `/api/auth/me`                         | Current user profile                   |
| POST   | `/api/ai/symptom-intake`               | AI specialty/urgency recommendation    |
| GET    | `/api/users/providers`                 | List providers (optional specialty filter) |
| POST   | `/api/appointments`                    | Book an appointment (patient)          |
| GET    | `/api/appointments`                    | List appointments (role-scoped)        |
| PATCH  | `/api/appointments/{id}`               | Update status/time/provider            |
| DELETE | `/api/appointments/{id}`               | Cancel an appointment                  |
| GET    | `/api/appointments/notifications/me`   | Current user's notifications           |
| GET    | `/api/admin/users`                     | List all users (admin)                 |
| PATCH  | `/api/admin/users/{id}/deactivate`     | Deactivate a user (admin)               |
| GET    | `/api/admin/analytics`                 | Operational analytics (admin)           |

Full interactive documentation is available at `/docs` while the backend is running.
