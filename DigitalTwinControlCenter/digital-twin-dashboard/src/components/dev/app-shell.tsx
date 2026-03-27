"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { GlobalNavbar } from "@/components/GlobalNavbar";

const navItems = [
  { label: "Overview", href: "/dev" },
  { label: "Systems", href: "/dev/systems" },
  { label: "Knowledgebase", href: "/dev/knowledgebase" },
  { label: "Builds", href: "/dev/builds" }
];

const shortcutItems = [
  { label: "New System", href: "/dev/systems" },
  { label: "Import JSON", href: "/dev" }
];

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-mist/30 flex flex-col">
      <GlobalNavbar />
      <div className="flex flex-1 items-start">
        <aside className="sticky top-[73px] z-30 hidden h-[calc(100vh-73px)] w-64 min-w-[256px] flex-col gap-6 border-r border-haze bg-white px-5 py-6 md:flex">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">Digital Twin</p>
              <h1 className="font-display text-xl text-ink">Control Deck</h1>
            </div>
            <span className="rounded-full border border-haze bg-white px-2 py-1 text-[10px] font-semibold text-ink/70">
              v1.0
            </span>
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const isOverview = item.href === "/dev";
              const isActive = isOverview
                ? pathname === "/dev"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${isActive
                    ? "border-ink bg-ink text-white shadow-[0_12px_30px_rgba(39,24,126,0.2)]"
                    : "border-transparent text-ink/70 hover:border-ink/10 hover:bg-mist"
                    }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="rounded-2xl border border-haze bg-mist p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">Shortcuts</p>
            <div className="mt-3 flex flex-col gap-2">
              {shortcutItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-xl border border-haze bg-white px-3 py-2 text-xs font-semibold text-ink/80 transition hover:border-ink/30"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* <div className="mt-auto rounded-2xl border border-haze bg-mist p-4 text-xs text-ink/70">
            <p className="text-sm font-semibold text-ink">Base Account</p>
            <p className="mt-1">Synced to PostgreSQL + MongoDB</p>
            <p className="mt-3">Runtime: Node 18+</p>
          </div> */}
        </aside>

        <main className="flex-1 w-full min-w-0 px-5 pb-12 pt-6 md:px-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink/60">Digital Twin</p>
              <h2 className="font-display text-2xl text-ink">Development Dashboard</h2>
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <div className="rounded-full border border-haze bg-white px-3 py-2 text-xs font-semibold text-ink/70 shadow-sm">
                Operations sync: Active
              </div>
              <div className="flex items-center gap-2 rounded-full border border-haze bg-white px-3 py-2 text-xs font-semibold text-ink/70 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-ember"></span>
                Live data link ready
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-haze bg-white p-6 shadow-[0_18px_40px_rgba(17,24,39,0.08)]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
