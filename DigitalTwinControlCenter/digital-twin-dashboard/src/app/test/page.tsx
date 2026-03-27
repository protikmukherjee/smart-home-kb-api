"use client";

import { useState, useCallback } from "react";
import { FirebaseService } from "@/lib/firebaseService";
import {
  runFaultCheck,
  runFaultCheckAll,
  fetchReplacementSuggestions,
  type FaultCheckResult,
  type ReplacementSuggestion,
} from "@/lib/faultEngine";
import { FIREBASE_URL_CONFIGS } from "@/config/firebaseUrlConfig";

// Known Firebase config for the IoT systems
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAXbDT1MNnABBfmqSOFLuLatkYZzIYj6A4",
  authDomain: "iot-archm-kb.firebaseapp.com",
  databaseURL: "https://iot-archm-kb-default-rtdb.firebaseio.com",
  projectId: "iot-archm-kb",
  storageBucket: "iot-archm-kb.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:000000000000",
};

const ALL_SYSTEMS = Object.keys(FIREBASE_URL_CONFIGS);

export default function FaultEngineTestPage() {
  const [initialized, setInitialized] = useState(false);
  const [results, setResults] = useState<FaultCheckResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<string>("all");
  const [kbResults, setKbResults] = useState<Record<string, ReplacementSuggestion[]>>({});
  const [kbLoading, setKbLoading] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  const initFirebase = useCallback(() => {
    try {
      FirebaseService.initialize(FIREBASE_CONFIG);
      setInitialized(true);
      addLog("Firebase initialized with iot-archm-kb database");
    } catch (err) {
      addLog(`Firebase init error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [addLog]);

  const runTest = useCallback(async () => {
    if (!initialized) {
      addLog("Firebase not initialized — click 'Initialize Firebase' first");
      return;
    }

    setLoading(true);
    setResults([]);
    const systemsToCheck =
      selectedSystem === "all" ? ALL_SYSTEMS : [selectedSystem];

    addLog(`Running fault checks for: ${systemsToCheck.join(", ")}`);

    try {
      const checkResults = await runFaultCheckAll(systemsToCheck);
      setResults(checkResults);

      for (const r of checkResults) {
        if (r.healthy) {
          addLog(`✅ ${r.systemName}: HEALTHY (${Object.keys(r.snapshot).length} properties checked)`);
        } else {
          addLog(
            `⚠️ ${r.systemName}: ${r.faults.length} fault(s) detected`
          );
          for (const f of r.faults) {
            addLog(`   [${f.severity}] ${f.code} — ${f.detail}`);
          }
        }
      }

      const totalFaults = checkResults.reduce((s, r) => s + r.faults.length, 0);
      const healthyCount = checkResults.filter((r) => r.healthy).length;
      addLog(
        `\nSummary: ${healthyCount}/${checkResults.length} systems healthy, ${totalFaults} total fault(s)`
      );
    } catch (err) {
      addLog(`Fault check error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [initialized, selectedSystem, addLog]);

  const lookupReplacement = useCallback(
    async (componentName: string) => {
      setKbLoading(componentName);
      addLog(`Looking up KB replacements for "${componentName}"...`);
      try {
        const suggestions = await fetchReplacementSuggestions(componentName);
        setKbResults((prev) => ({ ...prev, [componentName]: suggestions }));
        if (suggestions.length === 0) {
          addLog(`   No KB suggestions found for "${componentName}"`);
        } else {
          addLog(`   Found ${suggestions.length} replacement(s):`);
          for (const s of suggestions) {
            addLog(`   • ${s.title} — $${s.price ?? "N/A"} (score: ${s.score})`);
          }
        }
      } catch (err) {
        addLog(`KB lookup error: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setKbLoading(null);
      }
    },
    [addLog]
  );

  const severityColor: Record<string, string> = {
    CRIT: "bg-red-100 text-red-800 border-red-300",
    WARN: "bg-yellow-100 text-yellow-800 border-yellow-300",
    INFO: "bg-blue-100 text-blue-800 border-blue-300",
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Fault Engine Integration Test
        </h1>
        <p className="text-gray-600">
          This page directly tests the TypeScript fault engine against live
          Firebase data — no backend needed.
        </p>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-white p-4 shadow-sm">
          <button
            onClick={initFirebase}
            disabled={initialized}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              initialized
                ? "bg-green-100 text-green-700 cursor-default"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {initialized ? "✓ Firebase Connected" : "1. Initialize Firebase"}
          </button>

          <select
            value={selectedSystem}
            onChange={(e) => setSelectedSystem(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">All Systems ({ALL_SYSTEMS.length})</option>
            {ALL_SYSTEMS.map((sys) => (
              <option key={sys} value={sys}>
                {sys}
              </option>
            ))}
          </select>

          <button
            onClick={runTest}
            disabled={!initialized || loading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? "Running..." : "2. Run Fault Check"}
          </button>
        </div>

        {/* Results grid */}
        {results.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Results</h2>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {results.map((r) => (
                <div
                  key={r.systemName}
                  className={`rounded-xl border p-3 text-center ${
                    r.healthy
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }`}
                >
                  <div className="text-sm font-medium truncate">
                    {r.systemName.replace(/System$/, "")}
                  </div>
                  <div
                    className={`mt-1 text-lg font-bold ${
                      r.healthy ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {r.healthy ? "Healthy" : `${r.faults.length} fault(s)`}
                  </div>
                  <div className="text-xs text-gray-500">
                    {Object.keys(r.snapshot).length} props checked
                  </div>
                </div>
              ))}
            </div>

            {/* Detailed faults */}
            {results
              .filter((r) => !r.healthy)
              .map((r) => (
                <div key={r.systemName} className="rounded-xl border bg-white p-4 shadow-sm">
                  <h3 className="mb-3 text-lg font-semibold text-gray-800">
                    {r.systemName}
                  </h3>
                  <div className="space-y-2">
                    {r.faults.map((f, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-3 ${severityColor[f.severity] ?? "bg-gray-100"}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded px-2 py-0.5 text-xs font-bold">
                            {f.severity}
                          </span>
                          <span className="font-mono text-sm font-semibold">
                            {f.code}
                          </span>
                        </div>
                        <div className="mt-1 text-sm">{f.detail}</div>
                        <div className="mt-1 text-xs text-gray-600">
                          Component: {f.componentName} / Property: {f.propertyName}
                        </div>
                        {/* KB Replacement button */}
                        <div className="mt-2">
                          <button
                            onClick={() => lookupReplacement(f.componentName)}
                            disabled={kbLoading === f.componentName}
                            className="rounded bg-violet-100 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-200 disabled:opacity-50"
                          >
                            {kbLoading === f.componentName
                              ? "Looking up..."
                              : "Find KB Replacement"}
                          </button>
                          {kbResults[f.componentName] && (
                            <div className="mt-2 space-y-1">
                              {kbResults[f.componentName].length === 0 ? (
                                <div className="text-xs text-gray-500">
                                  No replacements found in KB
                                </div>
                              ) : (
                                kbResults[f.componentName].map((s, j) => (
                                  <div
                                    key={j}
                                    className="flex items-center gap-2 rounded bg-white/70 px-2 py-1 text-xs"
                                  >
                                    <span className="font-medium">{s.title}</span>
                                    {s.price != null && (
                                      <span className="text-green-700">${s.price}</span>
                                    )}
                                    <span className="text-gray-400">
                                      score: {s.score}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Snapshot */}
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                      Raw snapshot ({Object.keys(r.snapshot).length} values)
                    </summary>
                    <pre className="mt-1 max-h-48 overflow-auto rounded bg-gray-100 p-2 text-xs">
                      {JSON.stringify(r.snapshot, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
          </div>
        )}

        {/* Console log */}
        <div className="rounded-xl border bg-gray-900 p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-300">Console Log</h2>
            <button
              onClick={() => setLog([])}
              className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              Clear
            </button>
          </div>
          <pre className="max-h-64 overflow-auto font-mono text-xs leading-relaxed text-green-400">
            {log.length === 0
              ? "Waiting for commands..."
              : log.join("\n")}
          </pre>
        </div>
      </div>
    </div>
  );
}
