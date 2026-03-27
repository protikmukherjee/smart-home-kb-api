"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ConfirmDialog from "@/components/dev/confirm-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const API_URL = process.env.NEXT_PUBLIC_DEV_API_URL ?? "http://localhost:4001";

type SystemSummary = {
  id: string;
  name: string;
  createdAt: string;
  componentCount: number;
  hasConfig?: boolean;
  latestConfigAt?: string | null;
  isDeployed?: boolean;
  deployedAt?: string | null;
};

export default function SystemsPage() {
  const router = useRouter();
  const [systems, setSystems] = useState<SystemSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SystemSummary | null>(null);

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

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">Systems</p>
          <h1 className="font-display text-2xl text-ink">Fleet overview</h1>
        </div>
        <Button variant="accent" onClick={() => router.push("/dev")}>New system</Button>
      </header>

      {error ? <p className="text-sm text-ember">{error}</p> : null}

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
        <div className="grid gap-4 lg:grid-cols-2">
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
                    Build System
                  </Button>
                  <Button variant="accent" onClick={() => router.push(`/dev/systems/${system.id}/deploy`)}>
                    {system.isDeployed ? "Update Deploy" : "Deploy System"}
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
                  {system.isDeployed
                    ? `Deployed${system.deployedAt ? ` · ${new Date(system.deployedAt).toLocaleString()}` : ""}`
                    : system.hasConfig
                      ? "Built"
                      : "State: Ready"}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

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
