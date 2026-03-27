"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { SystemSelector } from "@/components/SystemSelector";
import { Dashboard } from "@/components/Dashboard";
import { ModeToggle } from "@/components/ModeToggle";
import { GlobalNavbar } from "@/components/GlobalNavbar";
import { useRuntimeSystems } from "@/hooks/useRuntimeSystems";

const API_URL = process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001";

export default function Home() {
  const [selectedSystems, setSelectedSystems] = useState<string[]>([]);
  const [mode, setMode] = useState<"real" | "simulated">("real");
  const [hasAutoSelected, setHasAutoSelected] = useState(false);
  const { systems, activeSystems, isLoading, error } = useRuntimeSystems();

  useEffect(() => {
    if (isLoading || hasAutoSelected) return;

    if (activeSystems && activeSystems.length > 0) {
      setSelectedSystems(activeSystems);
    }
    setHasAutoSelected(true);
  }, [activeSystems, hasAutoSelected, isLoading]);

  return (
    <div className="min-h-screen bg-mist/70">
      <GlobalNavbar>
        <ModeToggle mode={mode} onModeChange={setMode} />
      </GlobalNavbar>

      <main className="mx-auto w-full max-w-7xl px-6 py-8">
        {selectedSystems.length === 0 ? (
          <div>
            <div className="mb-10 rounded-[24px] border border-ink/10 bg-white/90 px-8 py-10 text-center shadow-[0_18px_45px_rgba(39,24,126,0.08)]">
              <h2 className="font-display text-4xl text-ink">
                Digital Twin Control Center
              </h2>
              <p className="mx-auto mt-4 max-w-4xl text-base leading-relaxed text-ink/70">
                Experience next-generation digital twin technology with real-time monitoring,
                advanced analytics, and intelligent reasoning. Control smart systems in real-time
                or simulate complex behaviors with our statechart engine.
              </p>

              <div className="mx-auto mt-8 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-3">
                <div className="rounded-2xl border border-haze bg-mist/80 p-6">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cobalt/15">
                    <div className="h-5 w-5 rounded-full bg-cobalt"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-ink">Real-time Monitoring</h3>
                  <p className="mt-2 text-sm text-ink/60">Live system status and component health tracking</p>
                </div>

                <div className="rounded-2xl border border-haze bg-mist/80 p-6">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cobalt/15">
                    <div className="h-5 w-5 rounded-full bg-cobalt"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-ink">Advanced Analytics</h3>
                  <p className="mt-2 text-sm text-ink/60">Power usage trends and system performance insights</p>
                </div>

                <div className="rounded-2xl border border-haze bg-mist/80 p-6">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cobalt/15">
                    <div className="h-5 w-5 rounded-full bg-cobalt"></div>
                  </div>
                  <h3 className="text-lg font-semibold text-ink">Intelligent Reasoning</h3>
                  <p className="mt-2 text-sm text-ink/60">AI-powered alerts and system optimization</p>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-ink/10 bg-white/90 p-8 shadow-[0_18px_45px_rgba(39,24,126,0.08)]">
              {isLoading ? (
                <p className="text-center text-sm text-ink/70">Loading deployed runtime systems...</p>
              ) : error ? (
                <p className="text-center text-sm text-ember">{error}</p>
              ) : systems.length === 0 ? (
                <p className="text-center text-sm text-ink/70">
                  No deployed systems yet. Deploy a system from the development dashboard first.
                </p>
              ) : (
                <SystemSelector
                  onSystemsSelected={async (selections) => {
                    setSelectedSystems(selections);
                    try {
                      await fetch(`${API_URL}/api/runtime/setup`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ activeSystems: selections })
                      });
                    } catch (e) {
                      console.error("Failed to save active systems", e);
                    }
                  }}
                  mode={mode}
                  systems={systems}
                />
              )}
            </div>
          </div>
        ) : (
          <div>
            <Dashboard
              selectedSystems={selectedSystems}
              mode={mode}
              onBackToSelection={() => setSelectedSystems([])}
              systems={systems}
            />
          </div>
        )}
      </main>
    </div>
  );
}
