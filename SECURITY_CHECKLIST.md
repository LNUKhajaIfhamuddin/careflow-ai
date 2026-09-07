# CareFlow AI — Security Checklist

## Authentication & authorization
- [x] Passwords hashed with bcrypt (never stored or logged in plain text)
- [x] JWT-based sessions, signed with a server-side secret, expiring after 24h
- [x] Password policy enforced server-side: 8+ characters, letter + number required (client mirrors this, but the server never trusts the client)
- [x] Admin role cannot be self-assigned through public registration — only `patient`/`provider` are accepted by the API, and the option is removed from the UI
- [x] Role-based access control enforced on every sensitive endpoint (not just hidden in the UI)
- [x] Field-level authorization on appointment updates — patients can no longer set their own appointment's `status`/`provider_id`/`urgency`; only providers (status/time on their own appointments) and admins (everything) can
- [x] Ownership checks on cancel — a provider can only cancel appointments assigned to them; a patient can only cancel their own
- [x] Email addresses normalized (trimmed + lowercased) to prevent case-based duplicate-account/account-confusion issues
- [x] Rate limiting on `/login` and `/register` (10 attempts per 5 minutes per IP) to slow brute-force and mass account-creation abuse

## Input validation & injection
- [x] All database queries go through the SQLAlchemy ORM with parameter binding — verified with SQL-injection-style payloads (`Robert'); DROP TABLE users;--`) in every text field; no raw SQL string interpolation anywhere in the codebase
- [x] Every request body validated against a strict Pydantic schema (type, length, format) before touching the database
- [x] `provider_id` on appointment booking is verified to reference an existing user with the `provider` role — previously accepted arbitrary/non-existent IDs
- [x] Symptom-intake text capped at 2000 characters and rejected if blank/whitespace-only (protects against AI-cost abuse and DoS via oversized payloads)
- [x] Appointment `scheduled_time` rejected if it's in the past
- [x] No `dangerouslySetInnerHTML`, `eval`, or raw `innerHTML` anywhere in the frontend — all user-generated text is rendered through React's automatic escaping, which was verified to neutralize script-injection attempts

## Secrets & configuration
- [x] No API keys or secrets committed to the repository — `.env` is git-ignored, `.env.example` ships with placeholders only
- [x] `OPENAI_API_KEY` is optional; the app degrades to a local rule-based analyzer rather than failing or hard-coding a key
- [x] Startup check warns (server log only, never exposed to clients) if `SECRET_KEY` is left at its insecure default
- [x] CORS restricted to the known frontend origin(s) rather than `*`, with an explicit, minimal method/header allowlist

## Error handling & information disclosure
- [x] Global exception handler returns a generic message on unexpected errors; full details are logged server-side only, never returned in the response body (prevents stack-trace/path/library-version leakage)
- [x] Validation errors return safe, structured field messages only (no internal object leakage)
- [x] Security response headers added to every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`
- [x] Frontend `ErrorBoundary` prevents a single component crash from blanking the whole app

## AI-specific responsible-use measures
- [x] System prompt to the AI model explicitly restricts it to classification (specialty + urgency + summary) and forbids diagnosis
- [x] UI repeatedly discloses that CareFlow AI is decision support only, not a diagnostic tool (login/register hero copy, symptom-intake page header)
- [x] The AI response discloses its own source (`OpenAI GPT analysis` vs. `built-in rule-based analyzer`) so staff/patients know when a human fallback produced the recommendation
- [x] Graceful, silent fallback to the rule-based analyzer on any API error (invalid key, rate limit, network failure, malformed response) so care coordination is never blocked by a third-party outage

## Known limitations (documented, not fixed in this pass — appropriate for a local/dev-scope project)
- Rate limiting is in-memory and per-process; a multi-instance production deployment needs a shared store (e.g. Redis)
- No email verification step on registration
- No server-side session/token revocation (logout is client-side token deletion only); a compromised token remains valid until it expires
- No automated dependency vulnerability scanning configured (recommend `pip-audit` / `npm audit` in CI for a production pipeline)
