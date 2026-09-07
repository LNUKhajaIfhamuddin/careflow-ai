# CareFlow AI — Prompts Used

These are the prompts used to build this application with an AI coding agent
(Claude, via Claude Code / an AI-powered IDE). Paste the "Kickoff prompt" first,
then work through the follow-ups as needed — most of the app can be built in
one pass, with follow-ups used for refinement.

## 1. Kickoff prompt

```
Build a full-stack web application based on these specifications:

Company and business problem: Mayo Clinic — patients face delayed
appointments, missed appointments, inefficient routing to the right
specialty, and rising administrative burden for staff.

AI solution: An AI assistant that takes a patient's symptoms/needs in
natural language, recommends the most relevant medical specialty,
flags urgency, and suggests appointment scheduling — decision support
only, no medical diagnosis.

Target users: Patients, providers, receptionists/care coordinators,
hospital administrators.

Technical stack: React.js frontend, FastAPI (Python) backend,
PostgreSQL database, OpenAI GPT API for natural language symptom
intake, JWT + bcrypt authentication, Docker for deployment.

Key features: secure patient registration/login, AI-driven symptom
intake, specialty recommendations, appointment scheduling, appointment
reminders/notifications, patient and provider dashboards, admin
dashboard with analytics.

Create a complete project with proper folder structure, frontend,
backend, database setup (SQLAlchemy models), and AI integration.
Make sure the AI symptom intake still works if no OpenAI API key is
configured, by falling back to a rule-based analyzer.
```

## 2. Local run & environment setup

```
Please run this application locally for me. Show me how to start the
backend dev server and the frontend dev server, and what environment
variables I need to set for PostgreSQL and the OpenAI API key.
```

## 3. Core feature prompts (applying lessons from App #1)

```
Build the AI symptom intake feature with error handling and loading
states: show a loading indicator while the AI call is in progress, and
a clear error message with a retry option if the call fails.
```

```
Add input validation to the registration and login forms: required
fields, valid email format, minimum password length, and password
confirmation matching, with inline error messages under each field.
```

```
Make the entire app mobile responsive — sidebar navigation should
collapse into a top bar on small screens, and all dashboard cards
should stack in a single column on mobile.
```

```
Integrate the OpenAI GPT API for the symptom intake feature: use a
system prompt that restricts the model to classification only
(specialty + urgency + summary), never a diagnosis, and return
strict JSON. Fall back to a rule-based analyzer if no API key is set
or the call fails.
```

```
Add JWT-based user authentication with three roles: patient,
provider, and admin. Passwords should be hashed with bcrypt. Protect
role-specific routes on both the frontend (redirect if wrong role)
and backend (403 if wrong role).
```

```
Set up the PostgreSQL database and create SQLAlchemy data models for
users, appointments, and notifications, with proper foreign keys and
enums for role, appointment status, and urgency level.
```

## 4. Quality and polish prompts

```
Please organize my project with: a clean folder structure separating
routers/models/schemas in the backend and pages/components/context in
the frontend, a professional README covering setup and environment
variables, .env.example files for both frontend and backend, and
consistent error handling across all API calls in the frontend.
```

```
Design a distinctive visual identity for this healthcare app — avoid
generic AI-app defaults (cream backgrounds with terracotta accents,
or black backgrounds with neon accents). Use a calm, trustworthy
clinical palette and pair a warm serif display face with a clean
sans-serif body face.
```

## 5. Troubleshooting prompts used during development

```
Fix this error: [pasted FastAPI/SQLAlchemy or React error output]
```

```
My appointment booking doesn't refresh the dashboard after I book —
the list still shows the old data. How do I fix this?
```

```
Add a seed script that creates demo accounts for each role (patient,
provider, admin) so I can log in immediately for testing/screenshots
without registering manually.
```

## Most helpful prompts (see Development Report for details)

The single most efficient prompt was the **kickoff prompt** — because it
included the full 5.2 use case (business problem, AI solution, tech stack,
key features, target users) in one shot, the agent generated a coherent,
correctly-scoped project structure on the first pass rather than needing
multiple rounds of "actually, also add X."
