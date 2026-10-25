import Link from "next/link";
import { LogOut } from "lucide-react";
import { APP } from "@/lib/constants";
import { NAV, ROLE_LABEL, canAccess } from "@/lib/auth/roles";
import type { Staff } from "@/lib/auth/session";
import { signOut } from "@/server/actions/auth";

export function AdminShell({ staff, children }: { staff: Staff; children: React.ReactNode }) {
  const items = NAV.filter((n) => canAccess(staff.role, n.section));
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="no-print border-b bg-card md:min-h-dvh md:border-b-0 md:border-r">
        <div className="px-5 py-4">
          <p className="text-sm font-bold text-primary">{APP.name}</p>
          <p className="text-xs text-muted-foreground">{staff.nama} · {ROLE_LABEL[staff.role]}</p>
        </div>
        <nav aria-label="Menu panitia" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible">
          {items.map(({ href, label }) => (
            <Link key={href} href={href} className="shrink-0 rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">{label}</Link>
          ))}
          <form action={signOut} className="md:mt-4">
            <button className="flex w-full shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted">
              <LogOut className="size-4" aria-hidden /> Keluar
            </button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 p-4 sm:p-8">{children}</main>
    </div>
  );
}
