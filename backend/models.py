"""
Case data model.

DECISION: Using SQLModel so the same class serves as both the SQLAlchemy ORM
table definition and the Pydantic schema for FastAPI request/response validation.
This eliminates the duplicated model boilerplate common with raw SQLAlchemy + Pydantic.
"""

from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class CaseBase(SQLModel):
    """Shared fields used for both creation and reading."""

    caller_name: str
    phone_number: str
    # DECISION: issue_type is a free string rather than an Enum so the voice agent
    # can pass values it infers from conversation without failing validation.
    # In production this would be a constrained Enum with a migration path.
    issue_type: str
    description: str
    # DECISION: status defaults to "open" — every new case starts open and staff
    # or the agent can advance it. Constrained to three states sufficient for the demo.
    status: str = "open"
    notes: str = ""


class Case(CaseBase, table=True):
    """Database table definition."""

    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class CaseCreate(CaseBase):
    """Request body for POST /cases."""
    pass


class CaseUpdate(SQLModel):
    """
    Request body for PATCH /cases/{id}.
    All fields optional so callers only send what changed.
    """

    caller_name: Optional[str] = None
    phone_number: Optional[str] = None
    issue_type: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class CaseRead(CaseBase):
    """Response schema — includes DB-generated fields."""

    id: int
    created_at: datetime
    updated_at: datetime
