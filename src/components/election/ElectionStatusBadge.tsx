import { CalendarClock, CheckCircle2, CircleDashed, FileCheck2, Hourglass, PlayCircle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type ElectionStatus } from "@/lib/constants";

const STYLE: Record<ElectionStatus, { icon: typeof CircleDashed; cls: string }> = {
  DRAFT: { icon: CircleDashed, cls: "bg-muted text-muted-foreground" },
  TERJADWAL: { icon: CalendarClock, cls: "bg-ink-soft text-primary" },
  PERSIAPAN: { icon: Wrench, cls: "bg-warning-soft text-warning" },
  PEMILIHAN_BERLANGSUNG: { icon: PlayCircle, cls: "bg-success-soft text-success" },
  PERHITUNGAN: { icon: Hourglass, cls: "bg-warning-soft text-warning" },
  SELESAI: { icon: CheckCircle2, cls: "bg-muted text-foreground" },
  DITETAPKAN: { icon: FileCheck2, cls: "bg-primary text-primary-foreground" },
};

/** Status selalu memakai ikon + teks, tidak hanya warna (aksesibilitas). */
export function ElectionStatusBadge({ status, className }: { status: ElectionStatus; className?: string }) {
  const { icon: Icon, cls } = STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", cls, className)}>
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}
