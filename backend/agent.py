"""
LiveKit voice agent for EffiGov case intake.

Pipeline:
  Deepgram STT  →  Claude LLM (with tool use)  →  Cartesia TTS

The agent handles two intents:
  1. Report a new issue → collects details → creates a case via POST /cases
  2. Check case status  → collects phone number → looks up via GET /cases?phone=

DECISION: Single-agent, single-session design. The spec asks for "one clean voice flow"
and a narrow scope. Multi-agent orchestration would add complexity with no demo benefit.

DECISION: Using livekit-agents v1.x AgentSession + Agent pattern (not the deprecated
VoicePipelineAgent from v0.x). v1.x separates session config (STT/LLM/TTS) from agent
logic (instructions + tools), which is cleaner and the current recommended approach.
"""

import asyncio
import logging
from typing import Optional

import httpx
from dotenv import find_dotenv, load_dotenv
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.llm import function_tool
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import anthropic, cartesia, deepgram, silero

load_dotenv(find_dotenv(usecwd=True))  # DECISION: find_dotenv walks up from cwd to locate .env at project root

logger = logging.getLogger("effigov-agent")

# DECISION: Backend URL as a constant rather than a config value — this is a
# localhost-only demo and the URL will not change. Easy to extract if needed.
BACKEND_URL = "http://127.0.0.1:8000"


# ---------------------------------------------------------------------------
# Agent subclass — carries per-session state so we don't refetch the same case.
# DECISION: Subclassing Agent instead of module-level functions keeps the case
# cache scoped to the current call. Module-level globals would leak across rooms.
# ---------------------------------------------------------------------------

class EffiGovAgent(Agent):
    """Stateful voice agent that remembers the current case across turns."""

    def __init__(self) -> None:
        super().__init__(instructions=SYSTEM_PROMPT)
        # DECISION: Dict instead of a typed object to avoid coupling the agent
        # to the backend Pydantic schema. We only need id + a few fields.
        self.current_case: Optional[dict] = None

    @function_tool
    async def create_case(
        self,
        caller_name: str,
        phone_number: str,
        issue_type: str,
        description: str,
    ) -> str:
        """
        Create a new service request case in the backend database.
        Call this after collecting the caller's name, phone number, issue type, and description.

        Args:
            caller_name: Full name of the caller.
            phone_number: Caller's phone number for follow-up.
            issue_type: Category of issue: 'missed_service', 'billing', or 'other'.
            description: Brief description of the issue in the caller's words.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    f"{BACKEND_URL}/cases",
                    json={
                        "caller_name": caller_name,
                        "phone_number": phone_number,
                        "issue_type": issue_type,
                        "description": description,
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                case = response.json()
                self.current_case = case  # DECISION: cache so follow-up edits don't re-fetch
                return f"Case #{case['id']} created successfully for {caller_name}."
            except Exception as e:
                logger.error(f"Failed to create case: {e}")
                return "I was unable to create the case due to a technical issue. Please try again."

    @function_tool
    async def get_case_by_phone(self, phone_number: str) -> str:
        """
        Look up existing service request cases for a caller by their phone number.
        Call this when the caller wants to check the status of an existing request.
        Returns a summary of ALL cases so you can tell the caller about each one.

        Args:
            phone_number: The caller's phone number to search by.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{BACKEND_URL}/cases",
                    params={"phone": phone_number},
                    timeout=10.0,
                )
                response.raise_for_status()
                cases = response.json()
                if not cases:
                    self.current_case = None
                    return f"No cases found for phone number {phone_number}."
                # DECISION: Cache most recent as the default active case.
                # Caller can switch to an older one via select_case_by_id.
                self.current_case = cases[0]
                # Return a one-line summary per case so the LLM can describe all of them.
                summaries = "; ".join(
                    f"Case #{c['id']} ({c['issue_type']}, {c['status']}, filed {c['created_at'][:10]})"
                    for c in cases
                )
                return f"Found {len(cases)} case(s): {summaries}. Currently selected: Case #{cases[0]['id']}."
            except Exception as e:
                logger.error(f"Failed to look up cases: {e}")
                return "I was unable to look up cases due to a technical issue."

    @function_tool
    async def select_case_by_id(self, case_id: int) -> str:
        """
        Set the active case to a specific case by its ID.
        Call this when the caller refers to a case other than the most recently looked up one.

        Args:
            case_id: The numeric ID of the case to select.
        """
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    f"{BACKEND_URL}/cases/{case_id}",
                    timeout=10.0,
                )
                response.raise_for_status()
                case = response.json()
                self.current_case = case
                return (
                    f"Selected Case #{case['id']} — "
                    f"Issue: {case['issue_type']}, "
                    f"Description: {case['description']}, "
                    f"Status: {case['status']}, "
                    f"Filed: {case['created_at'][:10]}."
                )
            except Exception as e:
                logger.error(f"Failed to select case {case_id}: {e}")
                return f"I was unable to find case #{case_id}. Please check the case number and try again."

    @function_tool
    async def update_current_case(self, field: str, value: str) -> str:
        """
        Update a single field on the currently selected case.
        Call this when the caller wants to change something on a case already looked up or created.

        Args:
            field: The field to update — one of 'description', 'status', or 'notes'.
            value: The new value for that field.
        """
        if self.current_case is None:
            return "No case is currently selected. Please look up a case by phone number first."

        # DECISION: Whitelist fields the agent is allowed to change. Prevents
        # accidental mutation of read-only fields like id or created_at.
        allowed = {"description", "status", "notes"}
        if field not in allowed:
            return f"'{field}' is not a field I can update. Choose one of: description, status, or notes."

        case_id = self.current_case["id"]
        async with httpx.AsyncClient() as client:
            try:
                response = await client.patch(
                    f"{BACKEND_URL}/cases/{case_id}",
                    json={field: value},
                    timeout=10.0,
                )
                response.raise_for_status()
                self.current_case = response.json()  # refresh cache with latest data
                return f"Case #{case_id} updated: {field} set to '{value}'."
            except Exception as e:
                logger.error(f"Failed to update case {case_id}: {e}")
                return "I was unable to update the case due to a technical issue."


# ---------------------------------------------------------------------------
# Agent entrypoint
# ---------------------------------------------------------------------------

# DECISION: System prompt is explicit and narrow — tells Claude exactly what
# data to collect and in what order. This prevents the agent from going off-topic
# and makes the demo flow predictable and repeatable.
SYSTEM_PROMPT = """You are a professional customer service agent for EffiGov,
a government services platform. You help residents report service issues, check
the status of existing requests, and make changes to them.

When a resident calls:
1. Greet them warmly and ask how you can help.
2. If they want to REPORT AN ISSUE:
   - Ask for their full name
   - Ask for their phone number (for follow-up)
   - Ask what type of issue: missed service, billing question, or other
   - Ask for a brief description of the issue
   - Use the create_case tool to file the request
   - Confirm the case number to the caller
3. If they want to CHECK STATUS of an existing request:
   - Ask for their phone number
   - Use the get_case_by_phone tool to look up their cases
   - Read back all case summaries to the caller
   - If the caller asks about a specific older or other case, you already have all the case IDs from the lookup — call select_case_by_id directly. Do NOT ask the caller for the case number; you already have it.
4. If they want to CHANGE an existing request:
   - Make sure you have already looked up their case (use get_case_by_phone if needed)
   - Ask what they would like to change: description, status, or notes
   - Use the update_current_case tool to apply the change
   - Confirm the update

Keep responses concise and professional. Collect one piece of information at a time.
Do not make up case numbers or statuses — always use the tools.
Do not use markdown, bullet points, bold text, or emojis. Your responses are spoken aloud."""


async def entrypoint(ctx: JobContext) -> None:
    """
    Called by the LiveKit worker when a new room participant connects.
    Sets up the voice pipeline and starts the agent session.
    """
    await ctx.connect()

    # DECISION: Wait for a human participant before starting the pipeline. Without this,
    # the STT WebSocket connects before the caller's mic track is published, so Deepgram
    # never receives audio.
    await ctx.wait_for_participant()

    # DECISION: Brief pause after participant joins to ensure the browser has finished
    # publishing its mic track. The participant joins before the track is subscribed,
    # so without this the STT pipeline subscribes to an empty stream.
    await asyncio.sleep(1)

    # DECISION: AgentSession holds the STT/LLM/TTS config; Agent holds instructions
    # and tools. This separation lets you swap models without touching agent logic.
    session = AgentSession(
        # DECISION: Silero VAD with lowered activation_threshold (0.5 → 0.3).
        # Browser microphones often have lower audio levels than phone inputs.
        # The default threshold caused VAD to never trigger, so Deepgram never
        # received audio frames.
        vad=silero.VAD.load(activation_threshold=0.3),
        stt=deepgram.STT(model="nova-2"),
        # DECISION: claude-haiku-4-5 for speed — fast turn-around matters more
        # than raw intelligence for a structured intake flow.
        # DECISION: caching="ephemeral" enables Anthropic prompt caching for the system
        # prompt and tool schemas. With 4 tools in strict JSON schema format, the input
        # token count is large enough that caching meaningfully reduces LLM latency.
        llm=anthropic.LLM(model="claude-haiku-4-5-20251001", caching="ephemeral"),
        # DECISION: Cartesia "Sonic" voice (sonic-english model, neutral voice).
        # This voice ID is the Cartesia default "British Reading Lady" — clear and professional.
        tts=cartesia.TTS(voice="79a125e8-cd45-4c13-8a67-188112f4dd22"),
        # DECISION: filter_markdown strips **, *, #, etc. before text reaches TTS.
        # Claude sometimes uses markdown in responses which sounds wrong when spoken.
        tts_text_transforms=["filter_markdown", "filter_emoji"],
    )

    agent = EffiGovAgent()

    await session.start(agent, room=ctx.room)

    # DECISION: 2s delay after start lets Deepgram STT and Cartesia TTS WebSocket
    # connections fully establish before the agent speaks. Without this, generate_reply
    # fires before the TTS channel is ready and the audio is silently dropped.
    await asyncio.sleep(2)

    # DECISION: session.say() sends a fixed string directly to TTS, bypassing the LLM.
    # This gives a consistent, markdown-free greeting every time. generate_reply
    # was producing verbose responses with markdown symbols that read poorly aloud.
    await session.say("Hello, thank you for calling EffiGov. How can I help you today?")


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
