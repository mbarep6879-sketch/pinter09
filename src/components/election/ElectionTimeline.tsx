import { Check, Circle, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

export type TimelineStep = { label: string; state: "done" | "active" | "todo" };

const TEXT = { done: "Selesai", active: "Berlangsung", todo: "Belum" } as const;

/** Alur RT 01 → RW 09. Urutan memang berurutan, jadi penomoran/alur layak dipakai. */
export function ElectionTimeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="flex gap-2 overflow-x-auto pb-1" aria-label="Tahapan pemilihan">
      {steps.map((s) => {
        const Icon = s.state === "done" ? Check : s.state === "active" ? CircleDot : Circle;
        return (
          <li
            key={s.label}
            className={cn(
              "flex min-w-24 flex-1 flex-col items-center gap-1 rounded-md border px-3 py-3 text-center",
              s.state === "done" && "bg-success-soft text-success",
              s.state === "active" && "border-primary bg-ink-soft text-primary",
              s.state === "todo" && "text-muted-foreground",
            )}
          >
            <Icon className="size-5" aria-hidden />
            <span className="text-sm font-semibold">{s.label}</span>
            <span className="text-xs">{TEXT[s.state]}</span>
          </li>
        );
      })}
    </ol>
  );
}
