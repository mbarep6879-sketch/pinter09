import ExcelJS from "exceljs";
import { parseCsv } from "@/lib/import/csv";

export type Cell = { text: string; isNumber: boolean };
export type Table = Cell[][];

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 5000;

function cellText(v: ExcelJS.CellValue): { text: string; isNumber: boolean } {
  if (v === null || v === undefined) return { text: "", isNumber: false };
  if (typeof v === "number") return { text: String(v), isNumber: true };
  if (typeof v === "string") return { text: v.trim(), isNumber: false };
  if (typeof v === "boolean") return { text: v ? "TRUE" : "FALSE", isNumber: false };
  if (v instanceof Date) return { text: v.toISOString(), isNumber: false };
  const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
  if (o.richText) return { text: o.richText.map((r) => r.text).join("").trim(), isNumber: false };
  if (typeof o.text === "string") return { text: o.text.trim(), isNumber: false };
  if (typeof o.result === "number") return { text: String(o.result), isNumber: true };
  if (typeof o.result === "string") return { text: o.result.trim(), isNumber: false };
  return { text: "", isNumber: false };
}

/** Membaca berkas .xlsx atau .csv menjadi tabel sel. Melempar Error berpesan manusiawi bila berkas tidak sah. */
export async function parseUpload(buffer: Buffer, filename: string): Promise<Table> {
  if (buffer.byteLength === 0) throw new Error("Berkas kosong.");
  if (buffer.byteLength > MAX_BYTES) throw new Error("Ukuran berkas melebihi 5 MB.");
  const lower = filename.toLowerCase();
  let table: Table;
  if (lower.endsWith(".csv")) {
    table = parseCsv(buffer.toString("utf8")).map((r) => r.map((t) => ({ text: t.trim(), isNumber: false })));
  } else if (lower.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } catch {
      throw new Error("Berkas Excel tidak dapat dibaca. Pastikan formatnya .xlsx yang valid.");
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new Error("Berkas Excel tidak berisi lembar kerja.");
    table = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: Cell[] = [];
      for (let c = 1; c <= ws.columnCount; c++) cells.push(cellText(row.getCell(c).value));
      table.push(cells);
    });
  } else {
    throw new Error("Format berkas harus .xlsx atau .csv.");
  }
  if (table.length - 1 > MAX_ROWS) throw new Error(`Jumlah baris melebihi batas ${MAX_ROWS}. Pecah berkas menjadi beberapa bagian.`);
  return table;
}
