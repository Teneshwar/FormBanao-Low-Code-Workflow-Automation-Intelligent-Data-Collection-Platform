# Form Banao — Low-Code Workflow Automation & Intelligent Data Collection Platform

## 📌 Overview

Form Banao is a full-stack low-code platform for designing, scheduling, publishing, and analyzing forms and data-collection workflows. It combines a visual form builder, conditional logic, scheduling/automation, secure user management, and analytics into a single product so teams can replace scattered spreadsheets and manual processes with a structured, reusable system.

---

## 🎯 Features

- Drag & drop form builder with many field types (text, textarea, email, number, select, radio, checkbox, file, signature, rating, etc.)
- Field-level validation and placeholders
- Conditional rules engine (show/hide fields based on other answers)
- Form versioning and lifecycle (draft → published → archived)
- Public form sharing (UUID-based public URLs)
- Anonymous or authenticated submissions
- Scheduling: auto-publish and auto-archive windows
- Analytics dashboard (KPI cards, trends, per-form analytics)
- Role-based access control and audit logging
- File uploads and CSV export of responses
- Multi-language UI and multilingual form support
- PWA-ready frontend with Firebase auth integration

---

## 🛠️ Technologies Used

- Frontend: React, TypeScript, Vite, Tailwind CSS, Recharts, DnD Kit
- Backend: Python, FastAPI, SQLAlchemy, Pydantic
- Database: PostgreSQL
- Authentication: JWT (python-jose), Firebase (frontend for email verification)
- Background scheduling: APScheduler; Celery (optional) with Redis
- Other: Uvicorn, passlib (bcrypt), python-dotenv

---

## 📂 Project Structure

```
Low-Code-Workflow-Automation-and-Intelligent-Data-Collection-Platform/
│
├── app/                     # Backend FastAPI application
│   ├── main.py              # App factory, routers, lifespan (table creation + scheduler)
│   ├── database.py          # SQLAlchemy engine, SessionLocal, Base, migrations helper
│   ├── models.py            # ORM models (users, forms, versions, fields, submissions, etc.)
│   ├── schemas.py           # Pydantic schemas for requests/responses
│   ├── routers/             # API routers: auth, forms, fields, schedules, analytics, public, etc.
│   └── services/            # Internal services (notifications, uploads, exports)
│
├── frontend/                # React + Vite frontend
│   ├── src/                 # React source (pages, components, lib)
│   ├── package.json
│   └── README.md
│
├── uploads/                 # (Local) uploaded files storage
├── .env.example             # Template environment variables
├── requirements.txt         # Python dependencies
└── README.md                # Original README (kept intact)
```

Important directories:
- `app/routers` — HTTP endpoints and business logic
- `app/models.py` — Database schema outlines
- `frontend/src/pages` — Application screens (Form builder, dashboard, analytics, etc.)

---

## ⚙️ Prerequisites

Install the following before running the project locally:

- Python 3.10+ (project targets Python 3.14 compatibility)
- Node.js + npm (for the frontend)
- PostgreSQL 14+ (or newer)
- Redis (optional — required only if using Celery broker/result backend)
- Git

---

## 🚀 Installation

### 1. Clone the repository

```powershell
git clone <repository-url>
cd "Low-Code-Workflow-Automation-and-Intelligent-Data-Collection-Platform-Jun-2026"
```

### 2. Backend setup (Python)

Create and activate a virtual environment and install dependencies:

```powershell
py -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

Create the PostgreSQL database and user (example):

```sql
CREATE DATABASE "Workflow_platform";
CREATE USER postgres WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE "Workflow_platform" TO postgres;
```

Copy the `.env.example` to `.env` and edit values (see Environment Variables section).

### 3. Frontend setup

```powershell
cd frontend
npm install
```

Create frontend `.env` (or copy `.env.example` in `frontend/`) and set Firebase web app settings as described in `.env.example`.

---

## ▶️ Running the Project

### Backend (development)

From project root (activate venv first):

```powershell
py -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will automatically create required DB tables on first startup and start the scheduler used for publish/archive windows.

Interactive API docs:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Frontend (development)

From `frontend/`:

```powershell
npm run dev
```

Open the dev URL printed by Vite (typically http://localhost:5173).

---

## 💻 Usage

1. Open the frontend in your browser.
2. Register or sign in using Firebase auth (if configured) or the backend auth endpoints.
3. Create a form in "Forms" → use drag-and-drop or AI-assisted form generation (if available).
4. Configure conditional rules and validation for fields.
5. Publish the form or schedule a future open/close window.
6. Share the public URL or QR code with respondents.
7. View submissions, export CSVs, and analyze data using the Analytics dashboard.

<img width="1912" height="866" alt="Screenshot 2026-08-10 124327" src="https://github.com/user-attachments/assets/cea73f2e-b88e-4ffb-b38e-ea3fcdd5dda0" />
<img width="1896" height="865" alt="Screenshot 2026-08-10 124529" src="https://github.com/user-attachments/assets/3c0f243c-98db-4c7e-b7a6-43b8857a0fee" />
<img width="1917" height="872" alt="Screenshot 2026-08-10 125336" src="https://github.com/user-attachments/assets/8168d654-8225-472a-92e2-6831ae3dec3a" />




---

## 🔌 API Documentation (Selected Endpoints)

Base path: `http://localhost:8000`

### Auth

- POST /auth/register — Register new user (backend-side / admin flows)
- POST /auth/login — Login and receive JWT
- POST /auth/logout — Revoke token (token blocklist)
- GET /auth/me — Get current user

Example login request (JSON):

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response contains JWT token.

### Forms

- GET /api/forms — List forms for current user
- POST /api/forms — Create a new form
- GET /api/forms/{id} — Get form details
- POST /api/forms/{id}/publish — Publish a form
- GET /public/{uuid} — Public access to a published form

### Scheduling

- POST /schedules — Create a schedule for a form (auto-publish/auto-archive)
- GET /schedules — List schedules
- GET /schedules/upcoming — List upcoming scheduled forms

### Analytics

- GET /analytics — Dashboard KPIs
- GET /analytics/{form_id} — Per-form analytics

Note: Use the API docs at /docs for full, interactive OpenAPI schema and example payloads.

---

## 🧪 Testing

This repository does not include a formal test suite by default. Suggested steps to add tests:

- Backend: pytest + TestClient (FastAPI) with a disposable test database or SQLite in-memory
- Frontend: Jest / React Testing Library for unit tests, Playwright / Cypress for end-to-end tests

To run tests (once added):

```powershell
# backend (example)
pytest

# frontend (example, from frontend/)
npm test
```

---

## 🔐 Environment Variables

Create a `.env` in the project root (copy `.env.example`) and set the following (examples):

- DATABASE_URL (required) — e.g. `postgresql://postgres:password@localhost:5432/Workflow_platform`
- SECRET_KEY (required) — 64-character hex, used for JWT
- ALGORITHM (optional) — e.g. `HS256`
- CELERY_BROKER_URL / REDIS_URL (optional) — e.g. `redis://localhost:6379/0`
- VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID, etc. for frontend

**Never store real secrets in the repository or public README.** Use environment variables and secret manager tooling for production.

---

## 🐛 Known Issues & Limitations

- No formal test suite included by default
- Some analytics rollups (hourly/yearly) may be approximated in the current implementation
- Celery integration requires a running Redis instance; by default the scheduler uses APScheduler
- Email delivery depends on Firebase or configured SMTP settings and may require configuration in production

---

## 🗺️ Roadmap

Planned enhancements:

- AI-assisted form generation (prompt → form)
- Webhooks and 3rd-party integrations (Zapier, Slack, CRM)
- Approval workflows and multi-step automation
- Offline-capable data collection (queued submissions)
- SSO (SAML / OIDC) and enterprise security features
- Improved analytics (funnel/drop-off analysis, segmentation)


---

## 👨‍💻 Author

**Project Maintainer**

- GitHub: `Teneshwar`
- Email: `<teneshwardwivedi22102003@gmail.com>`


