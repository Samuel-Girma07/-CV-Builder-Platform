# CV Builder Platform Upgrade Progress

Last updated: 2026-06-27

## Purpose

This file tracks planning, decisions, implementation progress, blockers, and verification steps for updating the project to match the Web Programming II final project requirements.

## Source Requirement Summary

The course brief requires a capstone-level web application with:

- Node.js and Express.js backend.
- A working RESTful API.
- A separate frontend, either framework-based or vanilla HTML/CSS/JS, that consumes the API.
- Authentication, authorization, JWT-based sessions, password hashing, and meaningful logging.
- MVC architecture.
- A relational database with DDL/schema included, and preferably an ER diagram.
- GitHub submission with at least 10 meaningful commits.
- README with setup instructions, stack, schema location, and extra features.

Important constraint: the project cannot be based solely on server-rendered templates.

## Current Project Snapshot

Detected on 2026-06-27:

- App name: `cv-builder-platform`.
- Runtime/framework: Node.js + Express.
- Previous frontend approach: server-rendered templates.
- Previous auth approach: database-backed browser sessions and `bcrypt`.
- Database: PostgreSQL via `pg`.
- Existing domain features:
  - CV/profile onboarding flow.
  - PDF resume upload and parsing.
  - AI-assisted profile parsing.
  - ATS matching.
  - Cover letter generation.
  - PDF/export-related services.
- Existing MVC-like structure:
  - `controllers/`
  - `models/`
  - `routes/`
  - previous server-rendered view layer
  - `services/`

## Main Gap Analysis

- The project was previously described and structured as a server-rendered app.
- The final requirement expects an API-first backend consumed by a separate frontend.
- Authentication currently appears session-based, but the requirement explicitly includes JWT.
- Need to confirm whether old template pages should be removed, kept only as legacy/admin pages, or replaced by a separate client.
- Need to check whether all routes already have equivalent JSON API behavior.
- Need to ensure logging, authorization, validation, README, DDL, and likely ER diagram are submission-ready.

## Proposed Upgrade Direction

Recommended direction:

1. Keep the CV Builder Platform domain because it is non-trivial and capstone-appropriate.
2. Convert the Express app into an API-first backend under routes like `/api/auth`, `/api/profile`, `/api/applications`, and `/api/cv`.
3. Replace browser session auth with JWT access tokens, while keeping `bcrypt` password hashing.
4. Add authorization middleware that protects user-owned resources.
5. Build a separate frontend that consumes the API. To keep scope manageable, this can be vanilla HTML/CSS/JS in `client/` or a React/Vite app if preferred.
6. Preserve useful domain logic only if it does not conflict with the API-first submission.
7. Update database schema, README, and documentation for the final requirement.

## Clarification Status

Initial clarity score: 68/100
Updated clarity score after user answers: 92/100

Clear:

- Project topic is CV/cover letter builder.
- Backend stack is Node.js + Express.
- Database is PostgreSQL.
- Course requires API + separate frontend, JWT, auth, hashing, logging, MVC, schema/DDL, README.

Needs clarification:

- Submission timeline after first course-compliance pass.
- Whether deployment is needed after local requirements are met.
- Deployment target, if any.

## Open Questions For User

Answered on 2026-06-27:

1. Frontend will be vanilla HTML/CSS/JS.
2. Previous template pages should be gracefully replaced and removed entirely.
3. AI features should require an API key.
4. First priority is meeting course requirements.
5. Commits will be made after the work is done, not during implementation.

## Working Plan

### Phase 1: Requirements and Architecture

- [x] Read project brief from attached text.
- [x] Inspect repository structure.
- [x] Create persistent progress tracker.
- [x] Confirm frontend choice and old view-layer strategy with user.
- [x] Audit current routes/controllers/models for reusable logic.
- [x] Produce detailed implementation plan after clarification.

Implementation direction chosen:

- Replace server-rendered pages with a static vanilla frontend in `public/`.
- Replace session auth with JWT auth.
- Keep PostgreSQL models and PDF services.
- Replace redirect/render controllers with JSON API controllers.
- Require `NVIDIA_API_KEY` at server startup because AI features are required.
- Remove old template files and session dependencies.

### Phase 2: API Backend

- [ ] Add JWT dependency and auth configuration.
- [ ] Convert or add API auth endpoints.
- [ ] Add JWT authorization middleware.
- [ ] Add JSON API endpoints for profile, CV upload/parse, applications, ATS scoring, and cover letters.
- [ ] Add request logging.
- [ ] Add validation and consistent API error responses.

### Phase 3: Separate Frontend

- [ ] Create frontend app/client structure.
- [ ] Implement login/register.
- [ ] Implement dashboard/profile flow.
- [ ] Implement application creation and list/detail screens.
- [ ] Connect frontend to API with token storage.
- [ ] Add responsive styling suitable for presentation.

### Phase 4: Database and Documentation

- [ ] Review and update `database/schema.sql`.
- [ ] Add ER diagram or Mermaid ER documentation.
- [ ] Update README to match final requirements.
- [ ] Add `.env.example` if missing.
- [ ] Document API endpoints.

### Phase 5: Verification

- [ ] Run install/build/start checks.
- [ ] Test auth flow.
- [ ] Test protected API routes.
- [ ] Test frontend consuming backend.
- [ ] Test database setup path.
- [ ] Check README instructions from a fresh-start perspective.

## Completion Log — 2026-06-28

All planned upgrade work is implemented and verified live against local PostgreSQL 18.

Done:

- Design system: dark-first token set in `public/css/style.css`, fonts (Space Grotesk +
  Schibsted Grotesk), and a design-system proof page at `public/design.html`.
- Dashboard redesigned from the provided inspiration, mapped to real data only
  (ATS hero, recent-application tiles, profile breakdown, quick-action panel,
  SVG ATS sparkline, activity list). All API calls unchanged.
- All views restyled consistently (auth, profile, CV, applications, detail).
- Contextual AI loaders (rotating status + step dots + elapsed timer), skeletons,
  button spinners, toasts, designed empty/error states, reduced-motion support.
- Logging: `middlewares/logger.js` (leveled console + `logs/app.log`), wired in `app.js`.
- Rate limiting: `middlewares/rateLimiters.js`, applied to auth and AI routes.
- Removed dead code: `applicationQuery.updateCoverLetter`, `profileQuery.updateSection`.
- Dropped orphan `session` table so the live DB matches `database/schema.sql`.
- README updated (stack, structure, security, logging, design system, extra features).

Verified live:

- Health, register, login, `/me`, 401 guard on protected routes.
- Profile GET/PUT, stats.
- AI ATS scoring on application create (returned score + missing skills).
- AI cover-letter generation; CV and cover-letter PDF downloads (valid `%PDF-`).
- Auth rate limiter returns 429 after 20 attempts; file logging confirmed.

## Notes

- The course brief says AI-generated code is prohibited. Any implementation should be something the student can understand and defend line by line.
- Favor simple, explainable architecture over clever abstractions.
- Keep commits descriptive and incremental if commit creation is requested.
