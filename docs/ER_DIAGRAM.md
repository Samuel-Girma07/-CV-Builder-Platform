# Entity Relationship Diagram

```mermaid
erDiagram
  users ||--|| profiles : owns
  users ||--o{ applications : creates

  users {
    int id PK
    varchar email UK
    varchar password_hash
    varchar full_name
    timestamp created_at
  }

  profiles {
    int id PK
    int user_id FK
    jsonb parsed_json_data
    timestamp updated_at
  }

  applications {
    int id PK
    int user_id FK
    varchar job_title
    varchar company
    text job_description
    int ats_match_score
    jsonb missing_skills
    varchar selected_tone
    text generated_cover_letter
    timestamp created_at
  }
```

## Relationship Notes

- Each user has one profile.
- Each user can create many job applications.
- Profiles are deleted automatically when their user is deleted.
- Applications are deleted automatically when their user is deleted.
- `profiles.parsed_json_data` stores structured CV data because CV sections can vary by user.
