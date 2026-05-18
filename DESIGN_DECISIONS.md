# Design Decisions

Key architectural and implementation decisions made during the build, with reasoning. Written for interview readability.

---

## Backend

### SQLite over PostgreSQL
**Decision:** Use SQLite as the database.  
**Reason:** Zero setup, file-based, no separate process required. Sufficient for a localhost demo with no concurrent write load. A production system would use PostgreSQL — the swap is a one-line change in `database.py` (the SQLModel/SQLAlchemy layer abstracts the engine).

### Server-side token + dispatch
**Decision:** The frontend never talks to LiveKit Cloud directly. It calls `GET /livekit-token`, which generates the JWT and dispatches the agent.  
**Reason:** API credentials stay server-side. The browser only ever receives a short-lived JWT. This is the correct security model even for a demo.

### httpx for agent dispatch instead of livekit-api SDK
**Decision:** Use `httpx` to POST directly to LiveKit's Twirp API (`/twirp/livekit.AgentDispatch/CreateDispatch`) instead of the `livekit-api` Python SDK.  
**Reason:** The `livekit-api` SDK uses `aiohttp` internally. On first use, aiohttp retries the POST while establishing its connection pool — a known aiohttp behavior. Since `CreateDispatch` is non-idempotent, this retry created two dispatch requests, spawning two agents per call. `httpx` has no implicit retries, making the dispatch strictly one-shot. This was diagnosed by observing two distinct dispatch IDs (`AD_...`) in the agent logs for a single token request.

### Four focused CRUD endpoints
**Decision:** `POST /cases`, `GET /cases`, `GET /cases/{id}`, `PATCH /cases/{id}` — nothing more.  
**Reason:** Exactly matches the spec. No auth, no pagination — both explicitly out of scope. Every additional endpoint is surface area to explain and test.

### find_dotenv for environment loading
**Decision:** `load_dotenv(find_dotenv(usecwd=True))` in both `main.py` and `agent.py`.  
**Reason:** Both processes run from `backend/` but the `.env` lives at the project root. `find_dotenv` walks up the directory tree to locate it, rather than requiring a hardcoded relative path that breaks depending on working directory.

---

## Voice Agent

### Silero VAD (requires Python 3.12+)
**Decision:** Use `silero.VAD.load()` for voice activity detection.  
**Reason:** Without VAD, the agent has no mechanism to detect when speech starts or ends, so the STT pipeline never activates. Silero requires `onnxruntime`, which dropped Python 3.10 support in v1.24+. Upgraded to Python 3.12 to unblock this.

### session.say() for the greeting instead of generate_reply()
**Decision:** The opening greeting uses `session.say("Hello, thank you for calling EffiGov. How can I help you today?")` rather than `session.generate_reply(instructions=...)`.  
**Reason:** `generate_reply` routes through the LLM, which produced verbose, markdown-formatted responses that sounded wrong when spoken aloud (e.g. `**Report a service issue**`). `session.say()` sends a fixed string directly to TTS — consistent, fast, no markdown.

### No markdown rule in system prompt + tts_text_transforms
**Decision:** Added `"Do not use markdown, bullet points, bold text, or emojis"` to the system prompt, and `tts_text_transforms=["filter_markdown", "filter_emoji"]` to the AgentSession.  
**Reason:** Two-layer defense. The prompt instructs the LLM; the transform strips any markdown that slips through before it reaches TTS. Belt and suspenders.

### asyncio.sleep(2) before greeting
**Decision:** Wait 2 seconds after `session.start()` before calling `session.say()`.  
**Reason:** Deepgram STT and Cartesia TTS establish WebSocket connections asynchronously after `session.start()` returns. Without the delay, `session.say()` fires before the TTS channel is ready and the audio is silently dropped.

### Claude Haiku over Sonnet/Opus
**Decision:** `claude-haiku-4-5-20251001` as the LLM.  
**Reason:** Speed matters more than reasoning depth for a structured intake flow with two fixed intents (report issue, check status). Haiku's latency is significantly lower, making the conversation feel more natural.

### @function_tool for case tools
**Decision:** `create_case` and `get_case_by_phone` are exposed as `@function_tool` decorated async functions.  
**Reason:** This is the idiomatic livekit-agents v1.x pattern. The decorator handles JSON schema generation and LLM tool-call routing automatically. The tools call the FastAPI backend over HTTP rather than the database directly — keeping the agent stateless and the backend as the single source of truth.

---

## Frontend

### Polling over WebSockets for dashboard
**Decision:** Dashboard auto-refreshes with `setInterval` every 3 seconds.  
**Reason:** Sufficient to show cases appearing after a voice call without the complexity of a WebSocket connection. WebSocket upgrade is a stretch goal — adding it without a clear need would be gold-plating.

### useTranscriptions over useSessionMessages
**Decision:** Used `useTranscriptions()` for the live transcript panel.  
**Reason:** `useSessionMessages` requires a separate `Session` context provider that isn't included in `LiveKitRoom`. `useTranscriptions` works directly within the `LiveKitRoom` context. Discovered via runtime error: `"No session provided, make sure you are inside a Session context"`.

### Unique room name per call
**Decision:** Each call generates a room name of `effigov-${Date.now()}`.  
**Reason:** A fixed room name (`effigov-room`) caused stale agents from previous sessions to still be present when a new call started, resulting in duplicate greetings. A unique room per call guarantees a clean slate.

### reactStrictMode: false
**Decision:** Disabled React StrictMode in `next.config.ts`.  
**Reason:** StrictMode double-invokes effects and callbacks in development to surface side-effects. This caused `startCall` to fire twice, which (before the httpx fix) dispatched two agents. Disabled to match production behavior during the demo.

### Token endpoint called once per call (module-level guard)
**Decision:** A module-level `callInFlight` boolean gates `startCall`.  
**Reason:** React component re-mounts reset `useRef` values, making ref-based guards ineffective across remounts. A module-level variable persists for the lifetime of the page session.
