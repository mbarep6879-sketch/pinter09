import type { Metadata } from "next";
import { AdminShell } from "@/components/layout/AdminShell";
import { requireStaff } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Panel panitia" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const staff = await requireStaff("dashboard");
  return <AdminShell staff={staff}>{children}</AdminShell>;
}
