# Enterprise Form Builder API

A production-ready backend REST API for building dynamic forms, managing form lifecycles, collecting intelligent data, and automating workflows — built with FastAPI and PostgreSQL.

---

## Features

- **User Authentication** — Register, login, logout with JWT Bearer tokens and token blocklist (revocation on logout)
- **User Profile Management** — View, update profile, change password, delete account
- **Dynamic Form Builder** — Create forms with fully typed fields (text, email, number, select, checkbox, radio, file, etc.)
- **Form Versioning** — Every form tracks draft versions; fields are copied forward automatically on new version creation
- **Form Lifecycle** — Full draft → published → archived state machine with dedicated endpoints
- **Field Management** — Add, update, patch, delete, and reorder fields within any form version
- **Conditional Rules Engine** — Show or hide fields based on other field values using configurable operators (equals, not\_equals, contains, greater\_than, less\_than)
- **Public Form Sharing** — Every published form gets a unique UUID-based public URL accessible without authentication
- **Form Submissions** — Anonymous or authenticated submission with per-field answer storage
- **Audit Logging** — Every mutating action (create, update, delete, login, logout, submit) is recorded with user ID, IP address, and timestamp
- **Auto Table Creation** — All 11 database tables are created automatically on first startup

---

## Tech Stack

### Backend
- **Python 3.14**
- **FastAPI 0.111** — High-performance async API framework
- **SQLAlchemy 2.0** — ORM with declarative models
- **Pydantic v2** — Request/response validation and serialization
- **Alembic 1.13** — Database migrations

### Database
- **PostgreSQL 18** — Primary data store

### Authentication & Security
- **python-jose** — JWT token generation and validation
- **passlib + bcrypt** — Password hashing
- **Token Blocklist** — DB-backed logout/token revocation

### Tools & Libraries
- **python-dotenv** — Environment variable management
- **psycopg2-binary** — PostgreSQL driver
- **uvicorn** — ASGI server
- **Kiro IDE** — Development environment

---

## Database Schema

The application manages **11 tables** across 3 domains:

### Identity & Access
| Table | Description |
|---|---|
| `users` | User accounts with email, hashed password, active status |
| `roles` | Role definitions (admin, editor, viewer) |
| `user_roles` | M2M join between users and roles |
| `token_blocklist` | Revoked JWT tokens for logout support |

### Form Engine
| Table | Description |
|---|---|
| `forms` | Form metadata with UUID, status (draft/published/archived), owner |
| `form_versions` | Versioned snapshots of a form's field configuration |
| `form_fields` | Individual fields per version with type, label, options, validation rules |
| `conditional_rules` | Show/hide logic linking trigger fields to target fields |

### Submissions
| Table | Description |
|---|---|
| `form_submissions` | Submitted form responses with IP address and timestamp |
| `submission_answers` | Per-field answers (text or JSON for multi-value) |
| `audit_logs` | Full activity trail for all system actions |

---

## Project Structure

```
enterprise-form-builder/
│
├── app/
│   ├── __init__.py
│   ├── main.py               ← FastAPI app, CORS, router registration, table creation
│   ├── database.py           ← SQLAlchemy engine, session, Base, get_db dependency
│   ├── models.py             ← All 11 ORM models
│   ├── schemas.py            ← Pydantic v2 request/response schemas
│   ├── dependencies.py       ← JWT auth dependencies (get_current_user, blocklist check)
│   └── routers/
│       ├── __init__.py
│       ├── auth.py           ← /auth — register, login, logout, me
│       ├── profile.py        ← /profile — get, update, delete account
│       ├── forms.py          ← /api/forms — full form CRUD + versioning + publish + archive
│       ├── fields.py         ← /api/forms/{id}/fields + /api/fields/{id} — field management
│       ├── conditional_rules.py ← /api/forms/{id}/conditional-rules — logic engine
│       └── public.py         ← /public/{uuid} — unauthenticated public form access
│
├── .env                      ← Local environment variables (never commit)
├── .env.example              ← Environment variable template
├── .gitignore
├── requirements.txt          ← Pinned Python dependencies
└── README.md
```

---

## Installation & Setup

### Prerequisites
- Python 3.10+ (project uses Python 3.14)
- PostgreSQL 14+ running locally or via Docker
- Git

### 1. Clone the repository

```bash
git clone <repository-url>
cd enterprise-form-builder
```

### 2. Create and activate a virtual environment

```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS / Linux
python -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Set up PostgreSQL

Create a database in PostgreSQL:

```sql
CREATE DATABASE "Workflow_platform";
```

If your PostgreSQL user is not `postgres`, create one:

```sql
CREATE USER postgres WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE "Workflow_platform" TO postgres;
```

---

## Environment Variables

Create a `.env` file in the project root (copy from `.env.example`):

```bash
copy .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/Workflow_platform
SECRET_KEY=your_64_character_random_hex_key
ALGORITHM=HS256
```

### Frontend Firebase Configuration

The frontend uses Firebase Authentication for registration and email verification. Create a `frontend/.env` file with your Firebase web app settings:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Then enable Email/Password sign-in in your Firebase console and add your app domain(s) to Authorized domains, including `localhost` during local development.

If verification emails still do not arrive, check the spam/junk folder and confirm the Firebase project is active.

To generate a secure `SECRET_KEY`:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## Running the Application

```bash
py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

> On Windows use `py` instead of `python` if `python` is not on PATH.

On successful startup you will see:

```
INFO:     Started server process
INFO:     Waiting for application startup.
✅ Database tables created / verified.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

**All 11 database tables are created automatically on first run.** No manual migration step needed for initial setup.

---

## API Documentation

Interactive documentation is available automatically at:

| URL | Description |
|---|---|
| `http://localhost:8000/docs` | Swagger UI — interactive, try endpoints directly |
| `http://localhost:8000/redoc` | ReDoc — clean reference documentation |
| `http://localhost:8000/openapi.json` | Raw OpenAPI schema |

---

## API Reference

### Auth

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | None | Register new user |
| POST | `/auth/login` | None | Login, returns JWT token |
| POST | `/auth/logout` | Bearer | Logout, revokes token |
| GET | `/auth/me` | Bearer | Get current user info |

### Profile

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/profile/me` | Bearer | Get profile |
| PUT | `/profile/me` | Bearer | Update name / change password |
| DELETE | `/profile/me` | Bearer | Delete account permanently |

### Forms

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/forms` | Bearer | Create form (auto-creates draft v1) |
| GET | `/api/forms` | Bearer | List own forms (paginated) |
| GET | `/api/forms/{id}` | Bearer | Get form with versions and fields |
| PUT | `/api/forms/{id}` | Bearer | Full update |
| PATCH | `/api/forms/{id}` | Bearer | Partial update |
| DELETE | `/api/forms/{id}` | Bearer | Delete form permanently |
| POST | `/api/forms/{id}/publish` | Bearer | Publish current draft version |
| POST | `/api/forms/{id}/archive` | Bearer | Archive form |
| GET | `/api/forms/{id}/versions` | Bearer | List all versions |
| POST | `/api/forms/{id}/versions` | Bearer | Create new draft version (copies fields) |

### Fields

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/forms/{id}/fields` | Bearer | Add field to current version |
| GET | `/api/forms/{id}/fields` | Bearer | List fields of current version |
| GET | `/api/fields/{id}` | Bearer | Get single field |
| PUT | `/api/fields/{id}` | Bearer | Full field update |
| PATCH | `/api/fields/{id}` | Bearer | Partial field update |
| DELETE | `/api/fields/{id}` | Bearer | Delete field |
| POST | `/api/forms/{id}/reorder-fields` | Bearer | Reorder fields by new index |

### Conditional Rules

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/forms/{id}/conditional-rules` | Bearer | Create show/hide rule |
| GET | `/api/forms/{id}/conditional-rules` | Bearer | List rules |
| GET | `/api/conditional-rules/{id}` | Bearer | Get single rule |
| PATCH | `/api/conditional-rules/{id}` | Bearer | Update rule |
| DELETE | `/api/conditional-rules/{id}` | Bearer | Delete rule |

### Submissions

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/forms/{form_id}/submit` | Optional | Submit form (anonymous allowed) |
| GET | `/api/forms/{form_id}/submissions` | Bearer | List submissions (owner only) |

### Analytics

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/analytics/dashboard` | ****** | Overall form, user, and submission statistics |
| GET | `/analytics/form/{id}` | ****** | Form-specific analytics and field breakdowns |
| GET | `/analytics/submission/{id}` | ****** | Submission counts and time-based trends for a form |
| GET | `/analytics/trends` | ****** | Trending day, most submitted form, field, and option |
| GET | `/analytics/export/json` | ****** | Download analytics report as JSON |
| GET | `/analytics/export/csv` | ****** | Download analytics report as CSV |
| GET | `/analytics/export/pdf` | ****** | Download analytics report as PDF |

### Public

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/public/{uuid}` | None | Access published form by UUID |

---

## Supported Field Types

| Type | Description |
|---|---|
| `text` | Single-line text input |
| `textarea` | Multi-line text input |
| `number` | Numeric input |
| `email` | Email address input |
| `date` | Date picker |
| `select` | Dropdown selection |
| `checkbox` | Multiple choice checkboxes |
| `radio` | Single choice radio buttons |
| `file` | File upload |

---

## Authentication Flow

```
1. POST /auth/register  →  Create account
2. POST /auth/login     →  Receive { access_token, token_type: "bearer" }
3. Add header           →  Authorization: Bearer <access_token>
4. POST /auth/logout    →  Token is blocklisted, subsequent requests with same token are rejected
```

Tokens expire after **24 hours**. On logout the token's `jti` (JWT ID) is stored in the `token_blocklist` table — every authenticated request checks this table to enforce immediate invalidation.

---

## Form Lifecycle

```
CREATE → draft (v1 auto-created)
       ↓
   PUBLISH → published (version marked published, is_published = true)
       ↓
   ARCHIVE → archived  (form and version marked archived, unpublished)

New Version:
   POST /versions → new draft (fields copied from current version)
```

---

## Admin access

`POST /auth/register` and the Firebase exchange flow create a standard user only. Clients can no longer request admin privileges from the public registration or authentication payloads.

An administrator can be promoted only by an existing superuser through the protected `/admin` management API and UI. Administrator-only endpoints are available under `/admin` and administrators can manage every user's forms, fields, rules, and submissions.

---

## Future Improvements

- [ ] Alembic migration scripts for schema evolution
- [ ] File upload handling with cloud storage (S3 / Azure Blob)
- [ ] Email notifications on form submission
- [ ] Submission export (CSV / Excel)
- [ ] Rate limiting on public endpoints
- [ ] Role-based access control (RBAC) enforcement on form access
- [ ] Webhook triggers on form submission
- [ ] Analytics dashboard — submission counts, completion rates
- [ ] Multi-language form labels

---

## License

MIT License — free to use, modify, and distribute.
