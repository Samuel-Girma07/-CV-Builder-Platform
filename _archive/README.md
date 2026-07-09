# _archive

This folder contains files that are no longer part of the active application but are kept for reference.

| File | Reason archived |
|------|-----------------|
| `test_blocks.js` | One-off test script for the removed Content Blocks feature |
| `test_xray.js` | One-off manual ATS X-Ray test script (superseded by `tests/` + jest) |
| `generate_favicons.js` | One-time favicon generation script — favicons already exist in `public/favicons/` |
| `migrate.js` | Early one-off migration runner, superseded by `database/migrations/` |
| `PROJECT_PROGRESS.md` | Internal dev progress notes |
| `Screenshot*.png` | Development screenshot |
| `design.html` | UI component reference page used during development |
| `006_feature8_content_blocks.sql` | Migration for the Content Blocks feature, which was removed |

**Do not import or require any file from this directory in the application.**
