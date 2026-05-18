"use client";

/**
 * Cases dashboard — lists all cases, auto-refreshes every 3 seconds.
 *
 * DECISION: Client component with polling (3s interval) rather than SSR or
 * WebSockets for the base build. Polling is dead-simple to explain and
 * sufficient to show the dashboard updating after a voice call. WebSocket
 * upgrade is reserved for the stretch goal.
 */

import Link from "next/link";
import { useEffect, useState } from "react";

const BACKEND = "http://localhost:8000";

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

export default function DashboardPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCases = async () => {
    try {
      const res = await fetch(`${BACKEND}/cases`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Case[] = await res.json();
      setCases(data);
      setError(null);
    } catch (e) {
      setError("Cannot reach backend — is it running on port 8000?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
    // DECISION: 3-second polling interval — fast enough to show near-real-time
    // updates without overwhelming the SQLite backend.
    const interval = setInterval(fetchCases, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">EffiGov</h1>
          <p className="text-sm text-gray-500">Case Management Dashboard</p>
        </div>
        <Link
          href="/call"
          className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
        >
          Start Voice Call
        </Link>
      </header>

      <main className="px-6 py-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-800">
            All Cases{" "}
            <span className="text-gray-400 text-sm font-normal">
              ({cases.length})
            </span>
          </h2>
          <span className="text-xs text-gray-400">Auto-refreshing every 3s</span>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-gray-400 py-12 text-center">
            Loading cases…
          </div>
        ) : cases.length === 0 ? (
          <div className="text-sm text-gray-400 py-12 text-center">
            No cases yet. Start a voice call to create one.
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    #
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Caller
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Phone
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Issue Type
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Created
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cases.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{c.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.caller_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.phone_number}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">
                      {c.issue_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {c.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/cases/${c.id}`}
                        className="text-indigo-600 hover:underline text-xs"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
