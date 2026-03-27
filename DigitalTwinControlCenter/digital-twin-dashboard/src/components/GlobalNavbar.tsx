"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Settings } from "lucide-react";

export function GlobalNavbar({ children, className = "" }: { children?: ReactNode, className?: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const isHome = pathname === "/";
    const isDev = pathname?.startsWith("/dev");

    return (
        <header className={`sticky top-0 z-40 w-full border-b border-ink/10 bg-white/95 backdrop-blur ${className}`}>
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
                <div className="flex items-center gap-4">
                    {!isHome && !isDev && (
                        <button
                            onClick={() => router.back()}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-mist text-ink hover:bg-mist/80 transition"
                            title="Go Back"
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </button>
                    )}
                    <Link href="/" className="font-display text-2xl text-ink hover:opacity-80 transition">
                        Digital Twin Control Center
                    </Link>
                </div>

                <div className="flex items-center gap-4">
                    {!isDev && (
                        <Link
                            href="/dev"
                            className="inline-flex h-10 items-center rounded-full border border-haze bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink/40"
                        >
                            Development Dashboard
                        </Link>
                    )}
                    {isDev && (
                        <Link
                            href="/"
                            className="inline-flex h-10 items-center rounded-full border border-haze bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink/40"
                        >
                            Runtime Dashboard
                        </Link>
                    )}

                    {children}

                    {isHome && (
                        <Link
                            href="/runtime-setup"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-haze bg-white text-ink transition hover:border-ink/40"
                            title="Runtime Setup"
                        >
                            <Settings className="h-4 w-4" />
                        </Link>
                    )}
                </div>
            </div>
        </header>
    );
}
