"""
Database engine and session setup.

DECISION: SQLite with a file-based DB (cases.db) rather than in-memory (:memory:)
so that data survives backend restarts during the demo. In-memory would be lost
every time uvicorn reloads.
"""

from sqlmodel import SQLModel, create_engine, Session

# DECISION: check_same_thread=False is required for SQLite when used with FastAPI's
# async request handling — multiple threads may access the same connection.
DATABASE_URL = "sqlite:///./cases.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def create_db_and_tables() -> None:
    """Create all tables defined via SQLModel metadata. Safe to call on every startup."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI dependency that yields a DB session and ensures it is closed after use."""
    with Session(engine) as session:
        yield session
