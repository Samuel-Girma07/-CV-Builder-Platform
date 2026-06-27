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
│   └── db.js
├── controllers/
│   ├── applicationController.js
│   ├── authController.js
│   └── profileController.js
├── database/
│   └── schema.sql
├── docs/
│   ├── API.md
│   └── ER_DIAGRAM.md
├── middlewares/
│   ├── authMiddleware.js
│   ├── logger.js
│   └── rateLimiters.js
├── models/
│   ├── applicationQuery.js
│   ├── profileQuery.js
│   └── userQuery.js
├── public/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   ├── design.html
│   └── index.html
├── routes/
│   ├── applicationRoutes.js
│   ├── authRoutes.js
│   └── profileRoutes.js
└── services/
    ├── coverLetterPdf.js
    └── cvPdf.js
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
```

The app requires `DATABASE_URL`, `JWT_SECRET`, and `NVIDIA_API_KEY` at startup.

4. Create the PostgreSQL database tables:

```bash
psql -U your_user -d cv_builder -f database/schema.sql
```

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

### Endpoint Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Service health check. |
| POST | `/api/auth/register` | — | Register a user; returns a JWT. |
| POST | `/api/auth/login` | — | Log in; returns a JWT. |
| GET | `/api/auth/me` | JWT | Return the authenticated user. |
| GET | `/api/profile` | JWT | Get the user's CV profile and template options. |
| PUT | `/api/profile` | JWT | Save the user's CV profile. |
| POST | `/api/profile/upload` | JWT | Upload a PDF resume and parse it with AI. |
| POST | `/api/profile/summary` | JWT | Generate a professional summary with AI. |
| PUT | `/api/profile/skill-levels` | JWT | Save per-skill proficiency levels. |
| GET | `/api/profile/cv.pdf` | JWT | Download the CV as a PDF (`?template=modern\|classic\|bold`). |
| GET | `/api/applications` | JWT | List the user's applications. |
| GET | `/api/applications/stats` | JWT | Get application count and average ATS score. |
| POST | `/api/applications` | JWT | Create an application and AI-score it against the CV. |
| GET | `/api/applications/:id` | JWT | Get a single application. |
| POST | `/api/applications/:id/cover-letter` | JWT | Generate a cover letter with a selected tone. |
| GET | `/api/applications/:id/cover-letter.pdf` | JWT | Download the cover letter as a PDF. |

Authenticated routes expect an `Authorization: Bearer <token>` header. Full request
and response shapes are documented in [docs/API.md](docs/API.md).

## Database Schema

The DDL script is in [database/schema.sql](database/schema.sql).

The ER diagram is in [docs/ER_DIAGRAM.md](docs/ER_DIAGRAM.md).

Tables:

- `users`
- `profiles`
- `applications`

## Security Notes

- Passwords are stored as bcrypt hashes.
- Authenticated API routes require a signed JWT.
- Application and profile queries are scoped to the authenticated user.
- The NVIDIA API key is read from environment variables and is not committed.
- Authentication endpoints are rate limited to 20 requests per IP per 15 minutes
  to slow brute-force and signup abuse.
- AI endpoints are rate limited to 12 requests per IP per minute because they call
  a paid third-party API.

## Logging

All requests are logged with method, path, status code, and duration. Application
events and server errors are logged with levels (`INFO`, `WARN`, `ERROR`). Logs are
written both to the console and to `logs/app.log`. The `logs/` directory is created
automatically at startup and is ignored by Git.

## Design System

The client is a vanilla HTML/CSS/JavaScript single-page app served from `public/`.
A standalone design-system proof page is available at `/design.html`, showing the
typography, color tokens, surfaces, buttons, inputs, cards, states, and light/dark
themes that the rest of the interface is built from.

## Extra Features Beyond The Basic Requirement

- PDF upload and AI parsing.
- AI ATS matching.
- AI cover letter generation.
- CV PDF generation with multiple templates.
- Cover letter PDF generation.
- Rate limiting on authentication and AI endpoints.
- Leveled application logging to console and file.
- A custom dark-first design system with a design-system proof page.
- Structured API documentation.
- ER diagram documentation.

## Scripts

```bash
npm start
npm run dev
```
