"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DEFAULT_REASONING_CONFIG } from "@/config/reasoningConfig";
import { GlobalNavbar } from "@/components/GlobalNavbar";

const API_URL = process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001";

type RuntimeSetupPayload = {
  realtime?: {
    firebaseConfig?: {
      apiKey?: string;
      authDomain?: string;
      databaseURL?: string;
      projectId?: string;
      storageBucket?: string;
      messagingSenderId?: string;
      appId?: string;
    };
  };
  simulation?: {
    apiUrl?: string;
    timeout?: number;
  };
  reasoning?: {
    models?: Array<{
      id?: string;
      name?: string;
      enabled?: boolean;
      apiUrl?: string;
    }>;
  };
};

type RuntimeSetupState = {
  realtime: {
    firebaseConfig: {
      apiKey: string;
      authDomain: string;
      databaseURL: string;
      projectId: string;
      storageBucket: string;
      messagingSenderId: string;
      appId: string;
    };
  };
  simulation: {
    apiUrl: string;
    timeout: number;
  };
  reasoning: {
    models: Array<{
      id: string;
      name: string;
      enabled: boolean;
      apiUrl: string;
    }>;
  };
};

export default function RuntimeSetupPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const [setup, setSetup] = useState<RuntimeSetupState>({
    realtime: {
      firebaseConfig: {
        apiKey: "",
        authDomain: "",
        databaseURL: "",
        projectId: "",
        storageBucket: "",
        messagingSenderId: "",
        appId: ""
      }
    },
    simulation: {
      apiUrl: "http://localhost:8080",
      timeout: 5000
    },
    reasoning: {
      models: DEFAULT_REASONING_CONFIG.models.map((model) => ({
        id: model.id,
        name: model.name,
        enabled: model.enabled,
        apiUrl: model.apiUrl
      }))
    }
  });

  useEffect(() => {
    const loadSetup = async () => {
      try {
        setError("");
        const response = await fetch(`${API_URL}/api/runtime/setup`);
        if (!response.ok) {
          throw new Error("Unable to load runtime setup.");
        }

        const data = (await response.json()) as RuntimeSetupPayload;
        setSetup({
          realtime: {
            firebaseConfig: {
              apiKey: data.realtime?.firebaseConfig?.apiKey ?? "",
              authDomain: data.realtime?.firebaseConfig?.authDomain ?? "",
              databaseURL: data.realtime?.firebaseConfig?.databaseURL ?? "",
              projectId: data.realtime?.firebaseConfig?.projectId ?? "",
              storageBucket: data.realtime?.firebaseConfig?.storageBucket ?? "",
              messagingSenderId: data.realtime?.firebaseConfig?.messagingSenderId ?? "",
              appId: data.realtime?.firebaseConfig?.appId ?? ""
            }
          },
          simulation: {
            apiUrl: data.simulation?.apiUrl ?? "http://localhost:8080",
            timeout: data.simulation?.timeout ?? 5000
          },
          reasoning: {
            models: DEFAULT_REASONING_CONFIG.models.map((defaultModel) => {
              const savedModel = data.reasoning?.models?.find((m) => m.id === defaultModel.id);
              return {
                id: defaultModel.id,
                name: defaultModel.name,
                enabled: savedModel?.enabled ?? defaultModel.enabled,
                apiUrl: savedModel?.apiUrl ?? defaultModel.apiUrl
              };
            })
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load runtime setup.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSetup();
  }, []);

  const handleSave = async () => {
    try {
      setError("");
      setSavedMessage("");
      setIsSaving(true);

      const response = await fetch(`${API_URL}/api/runtime/setup`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(setup)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? "Unable to save runtime setup.");
      }

      setSavedMessage("Runtime setup saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save runtime setup.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-6 text-sm text-ink/70">Loading runtime setup...</div>;
  }

  return (
    <div className="min-h-screen bg-mist/70">
      <GlobalNavbar />
      <div className="px-6 py-8 mx-auto flex w-full max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between rounded-2xl border border-ink/10 bg-white/90 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">Runtime</p>
            <h1 className="font-display text-2xl text-ink">Configure realtime & simulation setup</h1>
          </div>
        </div>

        {error ? <p className="text-sm text-ember">{error}</p> : null}
        {savedMessage ? <p className="text-sm text-cobalt">{savedMessage}</p> : null}

        <section className="rounded-2xl border border-ink/10 bg-white/95 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">Firebase config</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm" placeholder="API Key" value={setup.realtime.firebaseConfig.apiKey}
              onChange={(event) => setSetup((prev) => ({ ...prev, realtime: { firebaseConfig: { ...prev.realtime.firebaseConfig, apiKey: event.target.value } } }))} />
            <input className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm" placeholder="Auth Domain" value={setup.realtime.firebaseConfig.authDomain}
              onChange={(event) => setSetup((prev) => ({ ...prev, realtime: { firebaseConfig: { ...prev.realtime.firebaseConfig, authDomain: event.target.value } } }))} />
            <input className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm sm:col-span-2" placeholder="Database URL" value={setup.realtime.firebaseConfig.databaseURL}
              onChange={(event) => setSetup((prev) => ({ ...prev, realtime: { firebaseConfig: { ...prev.realtime.firebaseConfig, databaseURL: event.target.value } } }))} />
            <input className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm" placeholder="Project ID" value={setup.realtime.firebaseConfig.projectId}
              onChange={(event) => setSetup((prev) => ({ ...prev, realtime: { firebaseConfig: { ...prev.realtime.firebaseConfig, projectId: event.target.value } } }))} />
            <input className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm" placeholder="Storage Bucket" value={setup.realtime.firebaseConfig.storageBucket}
              onChange={(event) => setSetup((prev) => ({ ...prev, realtime: { firebaseConfig: { ...prev.realtime.firebaseConfig, storageBucket: event.target.value } } }))} />
            <input className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm" placeholder="Messaging Sender ID" value={setup.realtime.firebaseConfig.messagingSenderId}
              onChange={(event) => setSetup((prev) => ({ ...prev, realtime: { firebaseConfig: { ...prev.realtime.firebaseConfig, messagingSenderId: event.target.value } } }))} />
            <input className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm" placeholder="App ID" value={setup.realtime.firebaseConfig.appId}
              onChange={(event) => setSetup((prev) => ({ ...prev, realtime: { firebaseConfig: { ...prev.realtime.firebaseConfig, appId: event.target.value } } }))} />
          </div>
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white/95 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">Simulation config</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm sm:col-span-2" placeholder="Simulation API URL"
              value={setup.simulation.apiUrl}
              onChange={(event) => setSetup((prev) => ({ ...prev, simulation: { ...prev.simulation, apiUrl: event.target.value } }))}
            />
            <input className="rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm" placeholder="Timeout (ms)" type="number"
              value={setup.simulation.timeout}
              onChange={(event) => setSetup((prev) => ({ ...prev, simulation: { ...prev.simulation, timeout: Number(event.target.value) || 5000 } }))}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-ink/10 bg-white/95 p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-ink/60">Reasoning config</h2>
          <div className="flex flex-col gap-4">
            {setup.reasoning.models.map((model, index) => (
              <div key={model.id} className="grid items-center gap-3 sm:grid-cols-[auto_1fr]">
                <label className="flex items-center gap-2 text-sm font-medium text-ink w-48">
                  <input
                    type="checkbox"
                    className="rounded border-ink/20"
                    checked={model.enabled}
                    onChange={(event) => {
                      const nextModels = [...setup.reasoning.models];
                      nextModels[index] = { ...model, enabled: event.target.checked };
                      setSetup((prev) => ({ ...prev, reasoning: { ...prev.reasoning, models: nextModels } }));
                    }}
                  />
                  {model.name}
                </label>
                <input
                  className="w-full rounded-2xl border border-ink/20 bg-white/90 px-3 py-2 text-sm"
                  placeholder={`${model.name} API URL`}
                  value={model.apiUrl}
                  onChange={(event) => {
                    const nextModels = [...setup.reasoning.models];
                    nextModels[index] = { ...model, apiUrl: event.target.value };
                    setSetup((prev) => ({ ...prev, reasoning: { ...prev.reasoning, models: nextModels } }));
                  }}
                  disabled={!model.enabled}
                />
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex h-11 items-center rounded-full bg-cobalt px-6 text-sm font-semibold text-white transition hover:bg-cobalt/90 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Runtime Setup"}
          </button>
        </div>
      </div>
    </div>
  );
}
