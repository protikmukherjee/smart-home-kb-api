"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const API_URL = process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001";

type BuildSummary = {
  id: string;
  name: string;
  createdAt: string;
  componentCount: number;
  hasConfig: boolean;
  latestConfigAt?: string | null;
};

const buildStages = [
  {
    title: "Ingest",
    detail: "JSON uploaded and parsed",
    status: "Synced"
  },
  {
    title: "Selection",
    detail: "Variants locked",
    status: "Pending"
  },
  {
    title: "Config",
    detail: "ArcML output generated",
    status: "Pending"
  }
];

export default function BuildsPage() {
  const [builds, setBuilds] = useState<BuildSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");
      setIsLoading(true);
      try {
        const response = await fetch(`${API_URL}/api/systems`);
        if (!response.ok) {
          throw new Error("Unable to load builds.");
        }
        const data = (await response.json()) as BuildSummary[];
        setBuilds(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load builds.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const recentBuilds = useMemo(
    () =>
      [...builds]
        .filter((build) => build.latestConfigAt)
        .sort((a, b) =>
          new Date(b.latestConfigAt ?? b.createdAt).getTime() -
          new Date(a.latestConfigAt ?? a.createdAt).getTime()
        ),
    [builds]
  );

  const activeCount = recentBuilds.length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">Builds</p>
          <h1 className="font-display text-2xl text-ink">Configuration pipeline</h1>
        </div>
        <span className="rounded-full border border-ink/10 bg-mist/80 px-3 py-2 text-xs font-semibold text-ink/70">
          {isLoading ? "Loading builds..." : `${activeCount} recent builds`}
        </span>
      </header>

      {error ? (
        <div className="rounded-2xl border border-ember/30 bg-white px-4 py-3 text-sm text-ember">
          {error}
        </div>
      ) : null}

      <Card className="border-ink/10 bg-white/90">
        <CardHeader>
          <CardTitle>Pipeline stages</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {buildStages.map((stage) => (
            <div key={stage.title} className="rounded-2xl border border-ink/10 bg-mist/70 p-4 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/50">{stage.title}</p>
              <p className="mt-2 font-semibold text-ink">{stage.detail}</p>
              <p className="mt-1 text-xs text-ink/70">Status: {stage.status}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-ink/10 bg-white/95">
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {isLoading ? (
            <div className="rounded-2xl border border-ink/10 bg-mist/70 p-4 text-sm text-ink/70">
              Fetching latest builds...
            </div>
          ) : recentBuilds.length === 0 ? (
            <div className="rounded-2xl border border-ink/10 bg-mist/70 p-4 text-sm text-ink/70">
              No builds have been generated yet. Generate a config to populate this view.
            </div>
          ) : (
            recentBuilds.map((build) => (
              <div
                key={build.id}
                className="grid gap-3 rounded-2xl border border-ink/10 bg-white/90 p-4 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{build.name}</p>
                  <p className="mt-1 text-xs text-ink/60">{build.componentCount} components</p>
                </div>
                <div className="text-xs text-ink/70">
                  <p className="font-semibold text-ink">Built</p>
                  <p className="mt-1">
                    {build.latestConfigAt
                      ? new Date(build.latestConfigAt).toLocaleString()
                      : "Not generated"}
                  </p>
                </div>
                <div className="text-xs text-ink/70">
                  <p className="font-semibold text-ink">Created</p>
                  <p className="mt-1">{new Date(build.createdAt).toLocaleString()}</p>
                </div>
                <div className="text-xs text-ink/70">
                  <p className="font-semibold text-ink">Status</p>
                  <p className="mt-1">{build.hasConfig ? "Config ready" : "Pending"}</p>
                </div>
                <div className="flex items-center justify-end">
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/dev/systems/${build.id}/build`}>View build</a>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
