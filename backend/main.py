"""
FastAPI backend — case management API.

Endpoints:
  POST   /cases          Create a new case
  GET    /cases          List all cases (optional ?phone= filter)
  GET    /cases/{id}     Get a single case
  PATCH  /cases/{id}     Update case fields (used by voice agent and dashboard)

DECISION: Four focused endpoints covering the exact spec requirements.
No auth, no pagination — out of scope for a localhost demo.
"""

import os
from datetime import datetime
from typing import List, Optional

from dotenv import find_dotenv, load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from livekit.api import AccessToken, VideoGrants
import httpx
from sqlmodel import Session, select

from database import create_db_and_tables, get_session
from models import Case, CaseCreate, CaseRead, CaseUpdate

load_dotenv(find_dotenv(usecwd=True))  # DECISION: find_dotenv walks up from cwd to locate .env at project root

app = FastAPI(title="EffiGov Case Management API")

# DECISION: Allow all localhost origins so the Next.js dev server (port 3000)
# and any LiveKit frontend can reach the API without CORS errors.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/livekit-token")
async def get_livekit_token(room: str = "effigov-room", identity: str = "user") -> dict:
    """
    Generate a LiveKit access token and dispatch the agent to the room.

    DECISION: Dispatch happens server-side at token-issue time — the backend is
    already the authority on 'a call is starting'. This avoids sending API
    credentials to the browser and ensures the agent is ready before the
    caller's audio connects.
    """
    api_key = os.environ.get("LIVEKIT_API_KEY", "")
    api_secret = os.environ.get("LIVEKIT_API_SECRET", "")
    livekit_url = os.environ.get("LIVEKIT_URL", "")

    if not api_key or not api_secret:
        raise HTTPException(status_code=500, detail="LiveKit credentials not configured")

    token = (
        AccessToken(api_key, api_secret)
        .with_identity(identity)
        .with_name(identity)
        .with_grants(VideoGrants(room_join=True, room=room))
        .to_jwt()
    )

    # DECISION: Call LiveKit's Twirp HTTP API directly via httpx rather than the
    # livekit-api SDK. The SDK uses aiohttp which was silently retrying the POST on
    # connection setup, causing create_dispatch to fire twice and spawning two agents.
    # httpx has no implicit retries, making this strictly one dispatch per call.
    lk_http_url = livekit_url.replace("wss://", "https://").replace("ws://", "http://")
    dispatch_token = (
        AccessToken(api_key, api_secret)
        .with_grants(VideoGrants(room_create=True, room_admin=True))
        .to_jwt()
    )
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{lk_http_url}/twirp/livekit.AgentDispatch/CreateDispatch",
            headers={
                "Authorization": f"Bearer {dispatch_token}",
                "Content-Type": "application/json",
            },
            json={"room": room, "agentName": ""},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=500, detail=f"Agent dispatch failed: {resp.text}")

    return {"token": token, "url": livekit_url, "room": room}


@app.on_event("startup")
def on_startup() -> None:
    """Create DB tables on first run. Idempotent — safe to call on every restart."""
    create_db_and_tables()


@app.post("/cases", response_model=CaseRead, status_code=201)
def create_case(case_in: CaseCreate, session: Session = Depends(get_session)) -> Case:
    """Create a new case. Called by the voice agent after collecting caller details."""
    case = Case.model_validate(case_in)
    session.add(case)
    session.commit()
    session.refresh(case)
    return case


@app.get("/cases", response_model=List[CaseRead])
def list_cases(
    phone: Optional[str] = None,
    session: Session = Depends(get_session),
) -> List[Case]:
    """
    List all cases, newest first.
    Optional ?phone= query param lets the voice agent look up cases by caller phone number.
    """
    query = select(Case).order_by(Case.id.desc())
    all_cases = session.exec(query).all()
    if phone:
        # DECISION: Filter in Python rather than SQL. SQLite has no built-in regex,
        # and voice transcription produces inconsistent phone formats ("905 627 3349"
        # vs "905-627-3349"). Stripping non-digits and comparing is format-agnostic
        # and correct. Dataset is small enough that a full scan is not a concern.
        digits = "".join(c for c in phone if c.isdigit())
        cases = [c for c in all_cases if "".join(ch for ch in c.phone_number if ch.isdigit()) == digits]
    else:
        cases = list(all_cases)
    return cases


@app.get("/cases/{case_id}", response_model=CaseRead)
def get_case(case_id: int, session: Session = Depends(get_session)) -> Case:
    """Get a single case by ID."""
    case = session.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")
    return case


@app.patch("/cases/{case_id}", response_model=CaseRead)
def update_case(
    case_id: int,
    case_update: CaseUpdate,
    session: Session = Depends(get_session),
) -> Case:
    """
    Partially update a case. Used by both the voice agent (status updates via tool call)
    and the dashboard (staff manually updating status/notes).

    DECISION: PATCH over PUT — callers only send changed fields, reducing coupling
    between the agent tools and the full case schema.
    """
    case = session.get(Case, case_id)
    if not case:
        raise HTTPException(status_code=404, detail=f"Case {case_id} not found")

    update_data = case_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(case, field, value)

    case.updated_at = datetime.utcnow()
    session.add(case)
    session.commit()
    session.refresh(case)
    return case
