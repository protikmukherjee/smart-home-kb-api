import type { Metadata } from "next";
import AppShell from "@/components/dev/app-shell";

export const metadata: Metadata = {
  title: "Digital Twin Development Dashboard",
  description: "Configure digital twin systems and generate hardware configs."
};

export default function DevLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
