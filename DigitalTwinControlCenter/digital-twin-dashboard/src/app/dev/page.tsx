"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/dev/confirm-dialog";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001";

type SystemSummary = {
  id: string;
  name: string;
  createdAt: string;
  componentCount: number;
  hasConfig?: boolean;
  latestConfigAt?: string | null;
};

export default function Home() {
  const router = useRouter();
  const [systems, setSystems] = useState<SystemSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SystemSummary | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [fileName, setFileName] = useState("No file selected");

  useEffect(() => {
    const loadSystems = async () => {
      try {
        const response = await fetch(`${API_URL}/api/systems`);
        if (!response.ok) {
          throw new Error("Unable to load systems.");
        }
        const data = (await response.json()) as SystemSummary[];
        setSystems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load systems.");
      } finally {
        setIsLoading(false);
      }
    };

    loadSystems();
  }, []);

  const stats = useMemo(() => {
    const total = systems.length;
    const latest = systems[0]?.name ?? "None";
    return { total, latest };
  }, [systems]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    setJsonText(text);
  };

  const handleCreateSystem = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      const systemJson = JSON.parse(jsonText);
      const response = await fetch(`${API_URL}/api/systems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemJson })
      });

      if (!response.ok) {
        throw new Error("System creation failed.");
      }

      const data = (await response.json()) as { systemId: string };
      router.push(`/dev/systems/${data.systemId}/build`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "System creation failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="rounded-[28px] border border-ink/10 bg-white/90 p-6 shadow-[0_24px_60px_rgba(39,24,126,0.1)]">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-ink/50">Overview</p>
          <h1 className="mt-3 font-display text-3xl text-ink md:text-4xl">
            Digital Twin program control
          </h1>
          <p className="mt-2 max-w-xl text-sm text-ink/70">
            Track system builds, ingest new JSON models, and keep the hardware configuration
            pipeline synced between Postgres, MongoDB, and ArcML.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-ink/10 bg-mist/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Systems</p>
              <p className="mt-2 text-3xl font-semibold text-ink">{stats.total}</p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-mist/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Latest build</p>
              <p className="mt-2 text-lg font-semibold text-ink">{stats.latest}</p>
            </div>
            <div className="rounded-2xl border border-ink/10 bg-mist/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">Knowledgebase</p>
              <p className="mt-2 text-lg font-semibold text-ink">100+ variants</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="accent" size="lg">
              <Link href="/dev/systems">Launch new system build</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/dev/knowledgebase">View knowledgebase</Link>
            </Button>
          </div>
        </div>

        <Card className="border-ink/10 bg-white/95">
          <CardHeader>
            <CardTitle>Ingest new system</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="rounded-2xl border border-dashed border-ink/20 bg-mist/70 p-4 text-sm text-ink/70">
              <p className="font-semibold text-ink">Upload a system JSON</p>
              <p className="mt-1">Drag a file or choose from your device.</p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border border-ink/20 px-4 py-2 text-ink">
                <input type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
                Select JSON
              </label>
              <p className="mt-2 text-xs">{fileName}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-ink">Or paste JSON</p>
              <textarea
                className="mt-2 min-h-[160px] w-full rounded-2xl border border-ink/20 bg-white/90 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ink"
                placeholder="Paste the system JSON here"
                value={jsonText}
                onChange={(event) => setJsonText(event.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-ember">{error}</p> : null}

            <Button variant="accent" size="lg" onClick={handleCreateSystem} disabled={!jsonText || isSubmitting}>
              {isSubmitting ? "Parsing System..." : "Parse and Build"}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">Systems in progress</h2>
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/50">
            Live list
          </span>
        </div>
        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center">Loading systems...</CardContent>
          </Card>
        ) : systems.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-ink/70">
              No systems yet. Upload a JSON to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {systems.map((system) => (
              <Card key={system.id} className="border-ink/10 bg-white/90">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle>{system.name}</CardTitle>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">
                      {new Date(system.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push(`/dev/systems/${system.id}/build`)}>
                        {system.hasConfig ? "Re-Build System" : "Build System"}
                    </Button>
                    <Button
                      variant="outline"
                      className="border-ember/40 text-ember hover:border-ember"
                      onClick={() => setDeleteTarget(system)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-ink/70">
                  <span>Components: {system.componentCount}</span>
                  <span>
                    {system.hasConfig ? "Built" : "Pipeline: Ready for config"}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete system"
        description="This will permanently remove the system and its selections."
        confirmLabel="Delete system"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) {
            return;
          }
          const response = await fetch(`${API_URL}/api/systems/${deleteTarget.id}`, {
            method: "DELETE"
          });
          if (response.ok) {
            setSystems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
          }
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
