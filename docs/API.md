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
