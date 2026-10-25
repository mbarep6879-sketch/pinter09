import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const S = {
  info: { icon: Info, cls: "bg-ink-soft text-primary" },
  success: { icon: CheckCircle2, cls: "bg-success-soft text-success" },
  warning: { icon: AlertTriangle, cls: "bg-warning-soft text-warning" },
  error: { icon: XCircle, cls: "bg-danger-soft text-danger" },
} as const;

/** Ikon + teks: status tidak bergantung pada warna saja. */
export function Alert({ kind = "info", children, className }: { kind?: keyof typeof S; children: React.ReactNode; className?: string }) {
  const { icon: Icon, cls } = S[kind];
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-md p-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="space-y-1">{children}</div>
    </div>
  );
}
