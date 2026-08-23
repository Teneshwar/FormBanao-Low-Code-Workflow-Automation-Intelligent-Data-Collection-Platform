from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
import os
import uuid

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def _add_column_if_missing(conn, columns: set[str], table: str, column: str, definition: str) -> None:
    if column not in columns:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))


def ensure_legacy_schema() -> None:
    """Apply small, safe upgrades needed by databases created by earlier releases.

    ``create_all`` creates new tables but deliberately does not alter existing ones.
    Without these upgrades an older database can accept registration but fail with a
    generic 500 when form creation writes newer form/version columns.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "users" in tables:
        columns = {column["name"] for column in inspector.get_columns("users")}
        with engine.begin() as conn:
            _add_column_if_missing(conn, columns, "users", "hashed_password", "VARCHAR(255)")
            _add_column_if_missing(conn, columns, "users", "full_name", "VARCHAR(255)")
            _add_column_if_missing(conn, columns, "users", "firebase_uid", "VARCHAR(255)")
            _add_column_if_missing(conn, columns, "users", "is_superuser", "BOOLEAN DEFAULT FALSE")
            _add_column_if_missing(conn, columns, "users", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_firebase_uid_unique ON users (firebase_uid)"))

            if "first_name" in columns:
                conn.execute(text("ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL"))
            if "last_name" in columns:
                conn.execute(text("ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL"))
            if "password" in columns:
                conn.execute(text("ALTER TABLE users ALTER COLUMN password DROP NOT NULL"))

    if "forms" in tables:
        columns = {column["name"] for column in inspector.get_columns("forms")}
        with engine.begin() as conn:
            _add_column_if_missing(conn, columns, "forms", "is_published", "BOOLEAN DEFAULT FALSE")
            _add_column_if_missing(conn, columns, "forms", "current_version_id", "INTEGER")
            _add_column_if_missing(conn, columns, "forms", "uuid", "VARCHAR(36)")
            _add_column_if_missing(conn, columns, "forms", "status", "VARCHAR(20) DEFAULT 'draft'")

            # Existing rows need values before the current model can serialize them.
            missing_uuid_ids = conn.execute(
                text("SELECT id FROM forms WHERE uuid IS NULL")
            ).scalars().all()
            for form_id in missing_uuid_ids:
                conn.execute(
                    text("UPDATE forms SET uuid = :uuid WHERE id = :id"),
                    {"uuid": str(uuid.uuid4()), "id": form_id},
                )
            conn.execute(text("UPDATE forms SET status = 'draft' WHERE status IS NULL"))
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_forms_uuid_unique ON forms (uuid)"
            ))

    if "form_fields" in tables:
        columns = {column["name"] for column in inspector.get_columns("form_fields")}
        with engine.begin() as conn:
            _add_column_if_missing(conn, columns, "form_fields", "profile_field_mapping", "VARCHAR(100)")

        # OTP tables removed: Firebase Authentication supersedes server-side OTPs.

    # Backwards-compatible name used by earlier application versions.
ensure_legacy_user_columns = ensure_legacy_schema


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

