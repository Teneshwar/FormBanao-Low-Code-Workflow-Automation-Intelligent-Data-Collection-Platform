from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine, ensure_legacy_schema
from .routers import admin, auth, drafts, forms, profile, fields, conditional_rules, public, schedules, uploads, analytics, translations, steps


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        ensure_legacy_schema()
        print("Database tables created / verified.")
        # Start the scheduler to enforce form publish/archive windows
        try:
            from . import scheduler as _scheduler_module
            _scheduler_module.start_scheduler()
            print("Scheduler started.")
        except Exception as se:
            print(f"Scheduler failed to start: {se}")
    except Exception as e:
        print(f"Database connection failed: {e}")
        print("   Fix your DATABASE_URL / credentials in .env and restart.")
    yield
    # On shutdown, stop scheduler if running
    try:
        from . import scheduler as _scheduler_module
        _scheduler_module.stop_scheduler()
        print("Scheduler stopped.")
    except Exception:
        pass


app = FastAPI(
    title="Enterprise Form Builder API",
    description=(
        "Backend REST API for dynamic form creation, versioning, validation, "
        "public sharing, and response collection."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,              prefix="/auth",               tags=["Auth"])
app.include_router(profile.router,           prefix="/profile",            tags=["Profile"])
app.include_router(forms.router,             prefix="/api/forms",          tags=["Forms"])
app.include_router(fields.router,            prefix="/api",                tags=["Fields"])
app.include_router(conditional_rules.router, prefix="/api",                tags=["Conditional Rules"])
app.include_router(uploads.router,           prefix="/api",                tags=["Uploads"])
app.include_router(public.router,            prefix="/public",             tags=["Public Forms"])
app.include_router(analytics.router,          prefix="/analytics",         tags=["Analytics"])
app.include_router(admin.router,              prefix="/admin",             tags=["Admin"])
app.include_router(drafts.router,             prefix="/drafts",            tags=["Saved Draft Responses"])
app.include_router(schedules.router,          prefix="/schedules",         tags=["Form Scheduling"])
app.include_router(translations.router,       prefix="/api/forms",          tags=["Translations"])
app.include_router(steps.router,              prefix="/api",                tags=["Form Steps"])


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "ok", "message": "API is running"}
