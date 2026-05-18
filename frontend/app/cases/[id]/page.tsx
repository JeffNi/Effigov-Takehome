"use client";

/**
 * Case detail page — shows all case fields and lets staff update status and notes.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { use } from "react";

const BACKEND = "http://localhost:8000";

const STATUS_OPTIONS = ["open", "in_progress", "resolved"];

const STATUS_COLORS: Record<string, string> = {
  open: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
};

interface Case {
  id: number;
  caller_name: string;
  phone_number: string;
  issue_type: string;
  description: string;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [status, setStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${BACKEND}/cases/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: Case) => {
        setCaseData(data);
        setStatus(data.status);
        setNotes(data.notes);
      })
      .catch(() => setError("Case not found or backend unreachable."));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${BACKEND}/cases/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: Case = await res.json();
      setCaseData(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600 text-sm">{error}</div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/" className="text-sm text-indigo-600 hover:underline">
          ← All Cases
        </Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-base font-semibold text-gray-900">
          Case #{caseData.id}
        </h1>
      </header>

      <main className="px-6 py-6 max-w-2xl mx-auto space-y-6">
        {/* Read-only fields from the voice agent */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Caller Information
          </h2>
          <Field label="Name" value={caseData.caller_name} />
          <Field label="Phone" value={caseData.phone_number} />
          <Field
            label="Issue Type"
            value={caseData.issue_type.replace(/_/g, " ")}
          />
          <Field label="Description" value={caseData.description} />
          <div className="flex gap-8 text-xs text-gray-400 pt-1">
            <span>
              Created: {new Date(caseData.created_at).toLocaleString()}
            </span>
            <span>
              Updated: {new Date(caseData.updated_at).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Editable fields for staff */}
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Case Management
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    status === s
                      ? STATUS_COLORS[s] + " border-transparent"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  {s.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              placeholder="Add notes…"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {saved && (
              <span className="text-green-600 text-sm">Saved ✓</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  );
}
