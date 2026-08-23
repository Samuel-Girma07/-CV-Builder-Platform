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
