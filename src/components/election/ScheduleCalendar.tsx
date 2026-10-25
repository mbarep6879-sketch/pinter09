import { CalendarClock, CheckCircle2, PlayCircle } from "lucide-react";
import type { ElectionStatus } from "@/lib/constants";
import { STATUS_LABEL } from "@/lib/constants";

export type CalEvent = { date: string; label: string; status: ElectionStatus };
const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const key = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(d); // YYYY-MM-DD (WIB)

/** Kalender bulanan. Status ditandai ikon + teks (bukan hanya warna). Klik/teks acara menampilkan detail lewat label. */
export function ScheduleCalendar({ events }: { events: CalEvent[] }) {
  const base = events.length ? new Date(events.slice().sort((a, b) => a.date.localeCompare(b.date))[0].date) : new Date();
  const [y, m] = key(base).split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const byDay = new Map<number, CalEvent[]>();
  events.forEach((e) => { const [ey, em, ed] = key(new Date(e.date)).split("-").map(Number); if (ey === y && em === m) byDay.set(ed, [...(byDay.get(ed) ?? []), e]); });
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const icon = (s: ElectionStatus) => (s === "PEMILIHAN_BERLANGSUNG" || s === "PERHITUNGAN" ? PlayCircle : s === "SELESAI" || s === "DITETAPKAN" ? CheckCircle2 : CalendarClock);
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full min-w-[40rem] table-fixed text-sm">
        <caption className="p-3 text-left font-bold">{new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(first)}</caption>
        <thead><tr>{DAYS.map((d) => <th key={d} className="bg-muted p-2 text-center font-semibold">{d}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: cells.length / 7 }, (_, w) => (
            <tr key={w}>{cells.slice(w * 7, w * 7 + 7).map((d, i) => (
              <td key={i} className="h-24 border-t border-l p-1 align-top first:border-l-0">
                {d && <><span className="text-xs text-muted-foreground">{d}</span>
                  {(byDay.get(d) ?? []).map((e, j) => { const Icon = icon(e.status); return <div key={j} className="mt-1 flex items-start gap-1 rounded bg-ink-soft p-1 text-xs text-primary"><Icon className="mt-0.5 size-3 shrink-0" aria-hidden /><span><b>{e.label}</b> · {STATUS_LABEL[e.status]}</span></div>; })}</>}
              </td>))}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
