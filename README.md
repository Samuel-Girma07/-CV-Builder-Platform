# CV Builder Platform

CV Builder Platform is a full-stack web application for building structured CV profiles, scoring job applications against CV data, and generating cover letters and PDFs with AI assistance.

The backend is a Node.js and Express REST API. The frontend is a separate vanilla HTML/CSS/JavaScript client served from `public/` and communicates with the backend through `/api` endpoints.

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Backend | Express.js |
| Frontend | Vanilla HTML, CSS, and JavaScript |
| Database | PostgreSQL |
| Authentication | JWT |
| Password Security | bcrypt hashing |
| File Upload | multer |
| PDF Parsing | pdf-parse |
| PDF Generation | PDFKit |
| AI Integration | NVIDIA API through the OpenAI-compatible SDK |
| Rate Limiting | express-rate-limit |
| Configuration | dotenv |

## Core Features

- User registration and login with hashed passwords.
- JWT-protected API routes.
- Structured CV profile builder.
- PDF resume upload and AI parsing.
- AI-generated professional summaries.
- ATS score generation from CV data and job descriptions.
- AI-generated cover letters with tone selection.
- **Tailored CV Generation**: Dynamically optimizes CV profiles to match specific job descriptions.
- **Interview Prep Flashcards**: Generates behavioral and technical questions with STAR-method answers based on candidate experience. (Note: The previous Content Library feature has been deprecated and fully removed in favor of this direct AI generation approach).
- CV PDF and cover letter PDF downloads.
- PostgreSQL relational schema with user-owned profiles and applications.
- Leveled request and application logging to console and a log file.
- Rate limiting on authentication and AI endpoints.
- Consistent JSON API error responses.
- A dark-first design system with a vanilla-JS single-page client.

## Project Structure

```text
cv-builder-platform/
├── app.js
├── config/
│   ├── db.js
│   └── upload.js
├── controllers/
│   ├── analyticsController.js
│   ├── applicationController.js
│   ├── authController.js
│   ├── interviewController.js
│   ├── profileController.js
│   └── xrayController.js
├── database/
│   ├── bootstrap.sql
│   └── migrations/
├── docs/
│   ├── API.md
│   └── ER_DIAGRAM.md
├── middlewares/
│   ├── authMiddleware.js
│   ├── logger.js
│   └── rateLimiters.js
├── models/
│   ├── analyticsQuery.js
│   ├── applicationQuery.js
│   ├── interviewQuery.js
│   ├── profileQuery.js
│   ├── userQuery.js
│   └── userTablePreferenceQuery.js
├── public/
│   ├── css/
│   │   ├── linter.css
│   │   ├── redflags.css
│   │   ├── style.css
│   │   └── xray.css
│   ├── favicons/
│   ├── js/
│   │   ├── app.js
│   │   └── dataGrid.js
│   └── index.html
├── routes/
│   ├── analyticsRoutes.js
│   ├── applicationRoutes.js
│   ├── authRoutes.js
│   ├── interviewRoutes.js
│   ├── profileRoutes.js
│   └── xrayRoutes.js
├── services/
│   ├── aiClient.js
│   ├── coverLetterPdf.js
│   └── cvPdf.js
├── tests/
└── utils/
    ├── atsXray.js
    ├── cvLinter.js
    ├── email.js
    ├── redFlagRules.js
    └── schemas.js
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create an environment file:

```bash
cp .env.example .env
```

3. Fill in the required values:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cv_builder
JWT_SECRET=replace_with_a_long_random_secret
NVIDIA_API_KEY=replace_with_your_nvidia_api_key
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=qwen/qwen3-next-80b-a3b-instruct
PORT=3000

# Email delivery via Resend (https://resend.com). Without a key, recovery
# emails are not sent; in development the reset link is returned in the API
# response instead. In production a missing key is logged as an ERROR at boot.
RESEND_API_KEY=
RESEND_FROM="CV Builder Platform" <no-reply@cvbuilder.com>

NODE_ENV=development
```

The app requires `DATABASE_URL`, `JWT_SECRET` (at least 32 characters), and
`NVIDIA_API_KEY` at startup — it refuses to boot if any of them is missing or
the JWT secret is too weak.

4. Create the PostgreSQL database tables:

```bash
psql -U your_user -d cv_builder -f database/bootstrap.sql
```

`bootstrap.sql` is idempotent and consolidates the base schema plus all
feature migrations — it is safe to run more than once. The numbered files
in `database/migrations/` are kept for historical reference only.

5. Start the application:

```bash
npm start
```

Open `http://localhost:3000`.

## API Documentation

The API reference is in [docs/API.md](docs/API.md).

Main route groups:

- `/api/auth`
- `/api/profile`
- `/api/applications`
- `/api/interviews`
- `/api/mock-interviews`
- `/api/analytics`
- `/api/insights`
- `/api/reminders`
- `/api/xray`

### Endpoint Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Service health check. |
| POST | `/api/auth/register` | — | Register a user; returns a JWT. |
| POST | `/api/auth/login` | — | Log in; returns a JWT (or a 2FA challenge). |
| POST | `/api/auth/forgot-password` | — | Email a single-use reset link. |
| POST | `/api/auth/reset-password` | — | Complete a reset with the emailed token. |
| POST | `/api/auth/temp-password` | — | Issue a temporary password forcing a change on next login. |
| GET | `/api/auth/me` | JWT | Return the authenticated user. |
| PUT | `/api/auth/details` | JWT | Update full name and email. |
| POST | `/api/auth/update-password` | JWT | Change password (current password required). |
| POST | `/api/auth/digest-preference` | JWT | Opt in/out of the weekly digest email. |
| POST | `/api/auth/totp/enroll` | JWT | Start TOTP enrollment; returns QR + otpauth URL. |
| POST | `/api/auth/totp/confirm` | JWT | Verify a code and activate two-factor auth. |
| POST | `/api/auth/totp/disable` | JWT | Disable two-factor (current password required). |
| GET | `/api/auth/export` | JWT | Download the entire account as JSON. |
| DELETE | `/api/auth/me` | JWT | Permanently delete the account. |
| GET | `/api/profile` | JWT | Get the user's CV profile and template options. |
| PUT | `/api/profile` | JWT | Save the user's CV profile (snapshots a version). |
| GET | `/api/profile/versions` | JWT | List profile snapshots (newest first, capped at 50). |
| GET | `/api/profile/versions/:versionId` | JWT | Fetch one snapshot's full payload. |
| POST | `/api/profile/versions/:versionId/restore` | JWT | Roll the profile back to a snapshot. |
| POST | `/api/profile/upload` | JWT | Upload a PDF resume and parse it with AI. |
| POST | `/api/profile/summary` | JWT | Generate a professional summary with AI. |
| POST | `/api/profile/lint` | JWT | Rule-based CV lint of raw text. |
| PUT | `/api/profile/skill-levels` | JWT | Save per-skill proficiency levels. |
| GET | `/api/profile/cv.pdf` | JWT | Download the CV as a PDF (`?template=modern\|classic\|bold`). |
| GET | `/api/applications` | JWT | List applications (`sort`, `order`, `filter_*`, full-text `q`, `page`, `pageSize`). |
| GET | `/api/applications/stats` | JWT | Get application count and average ATS score. |
| GET/PUT | `/api/applications/table-preferences` | JWT | Tracker grid column preferences. |
| POST | `/api/applications` | JWT | Create an application and AI-score it against the CV. |
| PATCH | `/api/applications/bulk` | JWT | Bulk delete / restore / status update. |
| GET | `/api/applications/:id` | JWT | Get a single application. |
| PATCH | `/api/applications/:id` | JWT | Partially update editable fields. |
| DELETE | `/api/applications/:id` | JWT | Soft-delete an application (undoable). |
| GET/POST | `/api/applications/:id/reminders` | JWT | List or schedule follow-up reminders. |
| GET/POST | `/api/applications/:id/contacts` | JWT | List or add recruiter/hiring-team contacts. |
| DELETE | `/api/applications/:id/contacts/:entryId` | JWT | Delete a contact. |
| GET/POST | `/api/applications/:id/activities` | JWT | List or log typed touchpoints (call, email…). |
| DELETE | `/api/applications/:id/activities/:entryId` | JWT | Delete an activity entry. |
| POST | `/api/applications/:id/cover-letter` | JWT | Generate a cover letter with a selected tone. |
| POST | `/api/applications/:id/cover-letter/stream-ticket` | JWT | Mint a 60-second ticket for SSE streaming. |
| GET | `/api/applications/:id/cover-letter/stream` | Ticket | Stream generation over SSE (`start/delta/reset/done/error`). |
| GET | `/api/applications/:id/cover-letter.pdf` | JWT | Download the cover letter as a PDF. |
| POST | `/api/applications/:id/tailor-cv` | JWT | AI-tailor the CV to this job description. |
| GET | `/api/applications/:id/tailored-cv.pdf` | JWT | Download the tailored CV as a PDF. |
| POST | `/api/applications/:id/interview-prep` | JWT | Generate STAR-method interview flashcards. |
| GET/POST | `/api/applications/:appId/interviews` | JWT | List or schedule interviews for an application. |
| POST | `/api/mock-interviews/:appId/start` | JWT | Start (or resume) an AI-coached practice interview. |
| GET | `/api/mock-interviews/:appId` | JWT | List past practice sessions. |
| GET | `/api/mock-interviews/session/:sessionId` | JWT | Full transcript of one practice session. |
| POST | `/api/mock-interviews/session/:sessionId/answer` | JWT | Submit an answer; returns critique + next question. |
| POST | `/api/interviews/check-conflict` | JWT | Check a time window for scheduling conflicts. |
| GET | `/api/interviews/:id/ics` | JWT | Download an interview as a calendar invite. |
| GET | `/api/analytics/funnel` | JWT | Application funnel (`?groupBy=channel`). |
| GET | `/api/insights/skill-gaps` | JWT | Recurring missing skills with 30-day trends. |
| GET | `/api/insights/outcomes` | JWT | Feature usage vs interview-reach uplift. |
| GET | `/api/xray` | JWT | List stored X-Ray scans (newest 20 kept). |
| POST | `/api/xray/upload` | JWT | Upload a PDF for ATS parsability analysis. |
| POST | `/api/xray/:id/pdf-ticket` | JWT | Mint a 60-second ticket for PDF preview. |
| GET | `/api/xray/:id/pdf` | Ticket | Stream a stored PDF using `?ticket=` (iframe-safe). |
| DELETE | `/api/xray/:id` | JWT | Delete a stored scan. |

Authenticated routes expect an `Authorization: Bearer <token>` header. Full request
and response shapes are documented in [docs/API.md](docs/API.md).

## Database Schema

The bootstrap/DDL script is in [database/bootstrap.sql](database/bootstrap.sql).

The ER diagram is in [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md).

Tables:

- `users`
- `profiles`
- `applications` (+ `application_status_history`)
- `interviews`
- `user_table_preferences`
- `cv_versions`

Funnel analytics count each stage cumulatively: "Interviewing" means an
application reached interviewing (including those later hired), and
"Offered/Hired" counts applications that received an offer.

## Security Notes

- Passwords are stored as bcrypt hashes.
- Authenticated API routes require a signed JWT; TOTP seeds are stored AES-256-GCM encrypted (key derived from `JWT_SECRET`).
- Application and profile queries are scoped to the authenticated user.
- The NVIDIA API key is read from environment variables and is not committed.
- Authentication endpoints are rate limited to 20 requests per IP per 15 minutes
  to slow brute-force and signup abuse.
- AI endpoints are rate limited to 12 requests per IP per minute because they call
  a paid third-party API.

## Logging

All requests are logged with method, path, status code, and duration. Application
events and server errors are logged with levels (`INFO`, `WARN`, `ERROR`). Logs are
written both to the console and to `logs/app.log`. The active log file rotates to
`app.log.1` once it exceeds 5 MB, so it can never grow without bound. The `logs/`
directory is created automatically at startup and is ignored by Git.

## Design System

The client is a vanilla HTML/CSS/JavaScript single-page app served from `public/`,
built on a dark-first token system (typography, color tokens, surfaces, buttons,
inputs, cards, and state styles) defined in `public/css/style.css`.

## Extra Features Beyond The Basic Requirement

- **Password Recovery (two flows):** Email-based reset links with hashed, single-use tokens; plus temporary-password issuance that mandates a credential change within one hour of next login. Delivery uses the Resend HTTP API; without a key in development the link/password is returned in the API response for local testing, and a missing key in production is logged at ERROR level.
- **TOTP Two-Factor Authentication:** Authenticator-app 2FA with AES-256-GCM encrypted seeds, QR enrollment, a two-step login challenge, and password-gated disabling.
- **Skill-Gap Radar:** Aggregates missing skills across all scored applications into ranked trends so users know what to learn next.
- **What-Works Analytics:** Correlates tailored CVs / cover letters with interview reach rates — honest "not enough data" states included.
- **Profile Version History:** Every save/upload/summary snapshots atomically; browse, diff-lite preview, and one-click restore (50-version retention).
- **Streaming AI Cover Letters:** Token-by-token generation over Server-Sent Events with automatic model fallback and live character counts.
- **AI Mock Interview Coach:** Interactive practice sessions that critique answers against the candidate's actual CV using STAR scoring, ending in a session report.
- **Follow-Up Reminders + Weekly Digest:** pg-boss-scheduled reminder emails per application and an opted-in Monday pipeline digest.
- **Contacts & Activity Log:** Recruiter/hiring-team contacts and a typed touchpoint timeline (calls, emails, offers) per application.
- **Full-Text Application Search:** Postgres tsvector + GIN index powering instant keyword search across titles, companies, and descriptions.
- **ATS X-Ray Scanner:** Diagnostic tool that parses raw PDFs to check for ATS readability, font extraction issues, and hidden text. Stored scans are capped at 20 per user with owner-scoped deletion.
- **CV Linter & Red Flag Detection:** Rule-based analysis engine to detect common CV mistakes (e.g., missing metrics, generic action verbs) and scam-like job posting language.
- **Comprehensive Testing Suite:** 155+ automated unit tests using Jest (`npm test`), run on every push via GitHub Actions.
- **AI PDF Parsing & Structuring:** Upload a raw PDF resume and let AI extract and structure it into the platform's schema.
- **AI ATS Matching & Scoring:** Automatically match structured CV data against job descriptions for a granular ATS score.
- **AI Cover Letter Generation:** Generate tailored cover letters with selectable tones (Formal, Confident, Concise).
- **Tailored CVs & Interview Prep:** AI rewrites CV bullets per job description and predicts interview questions with STAR-method answer strategies.
- **Excel-style Application Tracker:** Editable grid with custom columns, bulk actions, soft-delete undo, formula-injection-safe CSV export, pagination, and status history analytics.
- **Interview Scheduler:** Schedule rounds with conflict detection and RFC-compliant `.ics` calendar invites.
- **Multi-template PDF Generation:** Generate tailored CV PDFs and Cover Letter PDFs server-side via PDFKit.
- **Rate Limiting:** IP-based rate limiting on authentication and AI endpoints to prevent abuse.
- **Light/Dark Themes + Accessibility:** Persisted theme toggle built on the design-token system; modal focus traps, Esc handling, and labelled icon buttons.
- **Account Data Export:** One request downloads the entire account as JSON (credentials excluded).
- **Background Job Queue:** pg-boss on the same Postgres instance powers reminders, digests, and retries with zero extra infrastructure.
- **Advanced UI/UX System:** Custom dark-first design system featuring a dynamic vanilla-JS SPA and interactive data grids.
- **Logging & Monitoring:** Leveled application logging to console and rotating file.
- **Detailed Documentation:** Structured API documentation and Database ER diagrams.

## Scripts

```bash
npm start
npm run dev
npm test
```
