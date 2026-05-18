"use client";

/**
 * Voice call page — connects the browser to a LiveKit room where the agent is running.
 *
 * DECISION: The browser fetches a token from the backend (GET /livekit-token), then
 * uses the LiveKit React SDK to connect. API credentials never touch the browser —
 * only a short-lived JWT does.
 *
 * DECISION: Using @livekit/components-react for the audio UI. It handles mic
 * permission, audio track publishing, and agent audio playback out of the box.
 * Building this manually would cost 60+ minutes for no demo benefit.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarVisualizer,
  LiveKitRoom,
  RoomAudioRenderer,
  TrackToggle,
  useLocalParticipant,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import "@livekit/components-styles";

const BACKEND = "http://localhost:8000";

// Module-level guard — persists across re-renders and re-mounts within the same
// page session. Prevents double-dispatch if startCall fires more than once.
let callInFlight = false;

interface TokenData {
  token: string;
  url: string;
  room: string;
}

type CallState = "idle" | "connecting" | "connected" | "ended" | "error";

export default function CallPage() {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Reset the guard on every fresh mount. The module-level variable persists across
  // client-side navigations, so without this the button locks permanently after one call.
  useEffect(() => { callInFlight = false; }, []);

  const startCall = useCallback(async () => {
    // DECISION: Module-level guard prevents double-dispatch across re-renders/re-mounts.
    if (callInFlight) return;
    callInFlight = true;
    setCallState("connecting");
    try {
      // DECISION: Unique room per call prevents stale agents from a previous session
      // greeting again. Fixed room name caused duplicate hellos when the old agent
      // hadn't disconnected yet before a new dispatch arrived.
      const roomName = `effigov-${Date.now()}`;
      const res = await fetch(`${BACKEND}/livekit-token?room=${roomName}&identity=caller-${Date.now()}`);
      if (!res.ok) throw new Error(`Token request failed: HTTP ${res.status}`);
      const data: TokenData = await res.json();
      setTokenData(data);
      setCallState("connected");
    } catch (e) {
      callInFlight = false;
      setErrorMsg(e instanceof Error ? e.message : "Unknown error");
      setCallState("error");
    }
  }, []);

  const endCall = useCallback(() => {
    callInFlight = false;
    setTokenData(null);
    setCallState("ended");
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-semibold text-gray-900">Voice Call</h1>
      </header>

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4">
        {callState === "idle" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
              <span className="text-3xl">📞</span>
            </div>
            <h2 className="text-lg font-medium text-gray-900">
              Call EffiGov Services
            </h2>
            <p className="text-sm text-gray-500 max-w-xs">
              Click below to connect with our AI agent. You can report an issue
              or check the status of an existing request.
            </p>
            <button
              onClick={startCall}
              className="bg-indigo-600 text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Start Call
            </button>
          </div>
        )}

        {callState === "connecting" && (
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center mx-auto animate-pulse">
              <span className="text-3xl">📞</span>
            </div>
            <p className="text-sm text-gray-500">Connecting…</p>
          </div>
        )}

        {callState === "connected" && tokenData && (
          <LiveKitRoom
            token={tokenData.token}
            serverUrl={tokenData.url}
            connect={true}
            audio={true}
            video={false}
            onDisconnected={endCall}
            className="w-full max-w-2xl"
          >
            <RoomAudioRenderer />
            <VoiceCallUI onEnd={endCall} />
          </LiveKitRoom>
        )}

        {callState === "ended" && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <span className="text-3xl">✓</span>
            </div>
            <h2 className="text-lg font-medium text-gray-900">Call Ended</h2>
            <p className="text-sm text-gray-500">
              Your case has been filed. Check the dashboard to see it.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                href="/"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 transition-colors"
              >
                View Dashboard
              </Link>
              <button
                onClick={() => { callInFlight = false; setCallState("idle"); }}
                className="border border-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                Call Again
              </button>
            </div>
          </div>
        )}

        {callState === "error" && (
          <div className="text-center space-y-3">
            <p className="text-red-600 text-sm">{errorMsg}</p>
            <p className="text-gray-400 text-xs">
              Make sure the backend is running on port 8000.
            </p>
            <button
              onClick={() => setCallState("idle")}
              className="text-indigo-600 text-sm hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Inner component rendered inside LiveKitRoom context.
 * useVoiceAssistant and useSessionMessages both require a LiveKitRoom ancestor.
 *
 * DECISION: useSessionMessages gives us the full ordered conversation history
 * (both agent and user turns) without building a custom transcript accumulator.
 * It's the idiomatic LiveKit hook for this exact use case.
 */
function VoiceCallUI({ onEnd }: { onEnd: () => void }) {
  const { state, audioTrack } = useVoiceAssistant();
  // DECISION: useTranscriptions works within the standard LiveKitRoom context and
  // returns a flat array of TextStreamData — simpler than useSessionMessages which
  // requires a separate Session context wrapper.
  const rawTranscriptions = useTranscriptions();
  const { localParticipant } = useLocalParticipant();

  // DECISION: Deduplicate by participant+text — LiveKit emits the same utterance
  // as multiple segments (interim + final) with different stream IDs. Keying on
  // the combination of speaker identity and text content collapses them.
  const transcriptions = useMemo(() => {
    const seen = new Map<string, typeof rawTranscriptions[0]>();
    for (const t of rawTranscriptions) {
      const key = `${t.participantInfo.identity}::${t.text}`;
      seen.set(key, t);
    }
    return Array.from(seen.values());
  }, [rawTranscriptions]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptions]);

  const agentStateLabel: Record<string, string> = {
    listening: "Listening…",
    thinking: "Thinking…",
    speaking: "Speaking…",
    idle: "Idle",
    connecting: "Connecting…",
  };

  return (
    <div className="flex flex-col w-full gap-4 py-6">
      {/* Visualizer + status */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-3">
        <div className="w-full h-16">
          <BarVisualizer
            state={state}
            barCount={24}
            trackRef={audioTrack}
            className="w-full h-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              state === "speaking"
                ? "bg-indigo-500 animate-pulse"
                : state === "listening"
                ? "bg-green-500 animate-pulse"
                : state === "thinking"
                ? "bg-yellow-400 animate-pulse"
                : "bg-gray-300"
            }`}
          />
          <span className="text-sm text-gray-500">
            {agentStateLabel[state ?? "connecting"] ?? "Connecting…"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Mic mute toggle — styled to match End Call button */}
          <TrackToggle
            source={Track.Source.Microphone}
            style={{
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "9999px",
              padding: "6px 14px",
              fontSize: "12px",
              color: "#374151",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          />
          <button
            onClick={onEnd}
            className="bg-red-500 text-white px-4 py-1.5 rounded-full text-xs hover:bg-red-600 transition-colors"
          >
            End Call
          </button>
        </div>
      </div>

      {/* Live transcript */}
      <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Live Transcript
          </span>
        </div>
        <div className="flex flex-col gap-2 p-4 h-72 overflow-y-auto">
          {transcriptions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Transcript will appear here…
            </p>
          ) : (
            transcriptions.map((t) => {
              // DECISION: If the transcription's participant identity matches the
              // local participant, it's the user's speech — otherwise it's the agent.
              const isUser = t.participantInfo.identity === localParticipant.identity;
              return (
                <div
                  key={t.streamInfo.id}
                  className={`flex gap-2 ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      isUser
                        ? "bg-gray-100 text-gray-800 rounded-tr-sm"
                        : "bg-indigo-50 text-indigo-900 rounded-tl-sm"
                    }`}
                  >
                    <p className="text-[10px] font-semibold mb-0.5 opacity-60">
                      {isUser ? "You" : "EffiGov Agent"}
                    </p>
                    {t.text}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
