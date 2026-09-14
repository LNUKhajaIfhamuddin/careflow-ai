# Video Demonstration Script (3–5 minutes)

Record your screen (e.g., built-in screen recorder, Loom, OBS) while narrating
briefly. You don't need to script exact words — just hit every beat below in
order. Keep the app running locally (`uvicorn` + `npm run dev`) before you start.

## Before recording
- [ ] Backend running (`http://localhost:8000/docs` loads)
- [ ] Frontend running (`http://localhost:5173` loads)
- [ ] Demo data seeded (`python -m app.seed`)
- [ ] System clock/date visible somewhere on screen at least once (taskbar clock is fine)

## Shot list

**1. Login & auth validation (30 sec)**
- Show the login page
- Try logging in with a wrong password → point out the error message
- Log in as `jane.doe@example.com` / `Patient123!` → land on Patient Dashboard

**2. Registration form validation (30 sec)**
- Go to Register
- Try a weak password (e.g. "abc") → show the validation error
- Try mismatched confirm-password → show the validation error
- Point out that "Hospital Administrator" is no longer a selectable role (security fix)
- Register a real new patient account successfully

**3. AI Symptom Intake (45 sec)**
- Click "+ New symptom check-in"
- Submit an empty/whitespace description → show it's rejected
- Type a real symptom description (e.g. "severe headache and dizziness for two days")
- Click Analyze → show the AI recommendation (specialty, urgency badge, summary, source label)
- Book the appointment → land back on the dashboard, show the new appointment

**4. Patient dashboard (20 sec)**
- Show the upcoming appointment with urgency/status badges
- Cancel it → show it move to the "Past & cancelled" section

**5. Provider dashboard (30 sec)**
- Log out, log in as `dr.patel@careflow.ai` / `Provider123!`
- Show the stat cards and the appointment queue
- Click "Confirm" on a pending appointment, then "Mark completed"

**6. Admin dashboard (30 sec)**
- Log out, log in with administrator credentials
- Show the analytics charts (specialty bar chart, urgency pie chart)
- Switch to Users & Appointments tab, show the full lists
- Deactivate a test user

**7. Error handling proof (30 sec)**
- Stop the backend server briefly
- Try an action (e.g. refresh the dashboard) with the backend stopped → show the friendly error message instead of a crash/blank screen
- Restart the backend, show it recovers

**8. Accessibility — keyboard navigation (30 sec)**
- Click into the address bar, then press Tab repeatedly to move through the login/dashboard page
- Show the visible focus outline moving between fields/buttons
- Press Tab once from a fresh page load and show the "Skip to main content" link appear
- Trigger an error (e.g. wrong password) and mention it's announced to screen readers via `role="alert"` (you can say this verbally even without a screen reader demo)

**9. Mobile responsiveness (20 sec)**
- Open browser dev tools → toggle device toolbar / responsive mode (or resize the window narrow)
- Show the sidebar collapse into the mobile top bar
- Show a dashboard's cards stack into a single column

## Wrap-up (10 sec)
- Briefly state: "That covers every feature, form validation, error handling, and accessibility feature in CareFlow AI."
