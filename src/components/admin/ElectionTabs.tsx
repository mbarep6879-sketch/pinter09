import Link from "next/link";
import type { Election } from "@/lib/elections";
import { cn } from "@/lib/utils";

export function ElectionTabs({ list, current, base }: { list: Election[]; current: string; base: string }) {
  return (
    <nav aria-label="Pilih pemilihan" className="mb-5 flex gap-2 overflow-x-auto pb-1">
      {list.map((e) => (
        <Link key={e.id} href={`${base}?e=${e.id}`} aria-current={e.id === current ? "page" : undefined}
          className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-semibold", e.id === current ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>{e.label}</Link>
      ))}
    </nav>
  );
}
