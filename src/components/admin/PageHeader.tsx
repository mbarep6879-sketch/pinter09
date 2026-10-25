export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-2xl font-extrabold">{title}</h1>{subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}</div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
export function Table({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-max text-left text-sm">{caption && <caption className="sr-only">{caption}</caption>}{children}</table>
    </div>
  );
}
export const th = "bg-muted px-3 py-2 font-semibold";
export const td = "border-t px-3 py-2";
