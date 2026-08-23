# API Reference

Base URL: `/api`

Protected endpoints require:

```http
Authorization: Bearer <jwt>
```

## Health

- `GET /health` returns API status.

## Authentication

- `POST /auth/register`
  - Body: `{ "fullName": "...", "email": "...", "password": "..." }`
  - Returns: `{ "token": "...", "user": {...} }`

- `POST /auth/login`
  - Body: `{ "email": "...", "password": "..." }`
  - Returns: `{ "token": "...", "user": {...} }`

- `GET /auth/me`
  - Returns the authenticated user.

### Account management

- `PUT /auth/details`
  - Body: `{ "fullName": "...", "email": "..." }`
  - Updates the account and returns a fresh JWT.

- `POST /auth/update-password`
  - Body: `{ "currentPassword": "...", "newPassword": "..." }`
  - Policy: at least 8 chars, one uppercase, one digit.

- `DELETE /auth/me`
  - Permanently deletes the account and all owned data.

### Password recovery

- `POST /auth/forgot-password`
  - Emails a single-use reset link (1 hour). Always returns the same generic
    message so accounts cannot be enumerated. Without a Resend key in
    development the response includes `devResetLink`.

- `POST /auth/reset-password`
  - Body: `{ "token": "...", "newPassword": "..." }`
  - Consumes the hashed token and signs the user in.

- `POST /auth/temp-password`
  - Issues a random temporary password valid for one hour; the next login
    returns `requirePasswordChange: true` and every other API returns 403
    until the password is changed. Email failure rolls the rotation back.
    Development without email configured returns `devTempPassword`.

While a forced change is pending only `GET /auth/me` and
`POST /auth/update-password` accept that session token.

## Profile

- `GET /profile`
  - Returns the structured CV profile, available CV templates, and skill level options.

- `PUT /profile`
  - Saves the full structured CV profile as JSON.

- `POST /profile/upload`
  - Multipart form field: `cvFile`
  - Uploads a PDF resume and uses the NVIDIA API to parse it into structured profile JSON.

- `POST /profile/summary`
  - Uses the NVIDIA API to generate a professional profile summary from saved profile data.

- `POST /profile/lint`
  - Body: `{ "text": "... CV text ..." }`
  - Rule-based lint; returns `{ "issues": [...] }`.

- `PUT /profile/skill-levels`
  - Body: `{ "levels": { "JavaScript": "Advanced" } }`
  - Saves per-skill proficiency levels.

- `GET /profile/cv.pdf?template=modern&download=1`
  - Streams the generated CV PDF.

## Applications

- `GET /applications/stats`
  - Returns total applications and average ATS score.

- `GET /applications`
  - Lists the authenticated user's job applications.

- `POST /applications`
  - Body: `{ "jobTitle": "...", "company": "...", "jobDescription": "..." }`
  - Creates an application and uses the NVIDIA API to calculate an ATS score.

- `GET /applications/:id`
  - Returns one user-owned application.

- `POST /applications/:id/cover-letter`
  - Body: `{ "selectedTone": "Formal" }`
  - Uses the NVIDIA API to generate or regenerate a cover letter.

- `GET /applications/:id/cover-letter.pdf`
  - Streams the generated cover letter PDF.

## Applications — tracker features

List sort/filter params are allowlisted server-side: `sort` in
`job_title|company|ats_match_score|created_at|status`, `order` in `asc|desc`,
and `filter_job_title` / `filter_company` / `filter_status`.

- `PATCH /applications/:id`
  - Editable fields: `job_title`, `company`, `job_description`, `status`,
    `custom_fields` (merged into existing JSONB). Status changes are recorded
    in `application_status_history`.

- `PATCH /applications/bulk`
  - Body: `{ "ids": [1,2], "operation": "delete" | "restore" | "status", "payload": { "status": "Applied" } }`
  - Delete/restore are soft operations (undoable); status updates write history.

- `GET /applications/table-preferences` and `PUT /applications/table-preferences`
  - Per-user tracker grid column order, visibility, and custom column definitions.

- `POST /applications/:id/tailor-cv`
  - AI rewrites CV bullets for this job description; output is validated before storage.

- `GET /applications/:id/tailored-cv.pdf?template=modern`
  - Streams the tailored CV PDF.

- `POST /applications/:id/interview-prep`
  - Generates up to 10 predicted questions with STAR-method answer strategies.

## Interviews

- `GET /applications/:appId/interviews`
  - Lists interviews scheduled under an application.

- `POST /applications/:appId/interviews`
  - Body: `{ "title", "startTime", "endTime", "location?", "notes?" }`
  - Title is required (max 255 chars); start must precede end.

- `POST /interviews/check-conflict`
  - Body: `{ "startTime", "endTime" }`
  - Returns `{ "hasConflict": bool, "conflict": {...} | null }`.

- `GET /interviews/:id/ics`
  - Downloads an RFC 5545 calendar invite.

## Analytics

- `GET /analytics/funnel?groupBy=channel`
  - Cumulative stage counts per group. "Interviewing" counts applications that
    reached interviewing (including later hires).

## ATS X-Ray

- `GET /xray`
  - Lists stored scans. Only the newest 20 per user are retained.

- `POST /xray/upload`
  - Multipart form field: `cvFile`. Returns `{ id, report }`; non-CV documents
    are rejected with 422 and the missing signals.

- `POST /xray/:id/pdf-ticket`
  - Mints a 60-second, single-purpose ticket for PDF preview.

- `GET /xray/:id/pdf?ticket=...`
  - Streams the stored PDF inline (used by an iframe, which cannot send
    Authorization headers).

- `DELETE /xray/:id`
  - Permanently removes a stored scan (owner-scoped).

## Insights

- `GET /insights/skill-gaps`
  - Ranked missing skills across all scored applications:
    `{ gaps: [{ skill, total, recentCount, priorCount, trend }], sampleOk }`.
    `trend` compares the trailing 30 days with the prior 30; `sampleOk` is
    false below three total mentions (the UI shows a hint instead).

- `GET /insights/outcomes`
  - Interview-reach split by feature usage:
    `{ total, insights: [{ feature, sampleOk, withRate?, withoutRate?, uplift? }] }`.
    Groups under four rows report `sampleOk: false` rather than fake uplift.

## Profile versions

- `GET /profile/versions` — metadata list, newest first (50 kept per user).
- `GET /profile/versions/:versionId` — full snapshot payload.
- `POST /profile/versions/:versionId/restore` — rolls the profile back and
  records a `restore` snapshot in the same transaction.

## Streaming cover letters

1. `POST /applications/:id/cover-letter/stream-ticket` → `{ ticket, expiresIn: 60 }`.
2. `GET /applications/:id/cover-letter/stream?ticket=…&tone=…` responds with
   Server-Sent Events:
   - `start` `{ tone }`
   - `delta` `{ t }` (repeat)
   - `reset` `{}` — partial output discarded, generation restarts on fallback model
   - `done` `{ application }` or `error` `{ message }`

## Mock interviews

- `POST /mock-interviews/:appId/start` — body `{ mode?: behavioral|technical|mixed }`.
  Resumes an active session when one exists. Generates flashcards via AI if absent.
- `POST /mock-interviews/session/:sessionId/answer` — body `{ text }`. Returns
  `{ finished, candidateMessage, coachMessage, session }`; the candidate message
  carries `critique: { rating, strengths[], improvements[], sample_answer }`.
- `GET /mock-interviews/session/:sessionId` / `GET /mock-interviews/:appId`.

## Reminders & digest

- `POST /applications/:id/reminders` — body `{ remindAt (ISO), message? }`.
  Schedules a delayed pg-boss job that emails the owner.
- `GET /applications/:id/reminders`, `POST /reminders/:id/dismiss`.
- Weekly digest: cron-driven fan-out to users with `digest_opt_in = true`;
  toggle via `POST /auth/digest-preference` body `{ digestOptIn }`.

## Contacts & activities

- `GET|POST /applications/:id/contacts` — name required (255); role/email/phone/notes optional.
- `DELETE /applications/:id/contacts/:entryId`.
- `GET|POST /applications/:id/activities` — `kind` ∈ note|call|email|interview|offer|rejection,
  optional `occurredAt`; enforced by a database CHECK constraint.
- `DELETE /applications/:id/activities/:entryId`.

## Two-factor authentication (TOTP)

1. `POST /auth/totp/enroll` → `{ otpauthUrl, qrDataUrl }` (seed stored encrypted, disabled).
2. `POST /auth/totp/confirm` body `{ token }` — verifies possession, activates.
3. Login becomes two-step: first call returns `{ twoFactorRequired: true }` with **no token**;
   re-post credentials plus `{ token }` to receive the JWT. Wrong codes are 401.
4. `POST /auth/totp/disable` requires the current password.

## Account export

- `GET /auth/export` — JSON attachment of every owned record (user sans
  credentials, profile + versions, applications + history, interviews,
  reminders, contacts, activities, X-Ray metadata). Rate limited like auth.
