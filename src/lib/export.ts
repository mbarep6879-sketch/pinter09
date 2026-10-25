import ExcelJS from "exceljs";

/** Mencegah formula injection saat berkas dibuka di Excel: sel teks berawalan = + - @ diberi apostrof. */
export function safeCell(v: unknown): string | number {
  if (typeof v === "number") return v;
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const esc = (v: unknown) => { const s = String(safeCell(v)); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "\uFEFF" + [headers, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

export async function toXlsx(sheet: string, headers: string[], rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet.slice(0, 31));
  ws.addRow(headers).font = { bold: true };
  rows.forEach((r) => ws.addRow(r.map(safeCell)));
  ws.columns.forEach((c) => { c.width = 22; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function fileResponse(body: BodyInit, filename: string, type: string) {
  return new Response(body, { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store" } });
}
export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Menolak permintaan lintas-situs pada endpoint POST (lapisan tambahan di atas cookie SameSite). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return new URL(origin).host === host; } catch { return false; }
}
