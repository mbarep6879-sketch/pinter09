import { describe, expect, it } from "vitest";
import { safeCell, toCsv } from "../../src/lib/export";
import { fmtDateTime, toLocalInput } from "../../src/lib/format";
import { hasTie, totals, stepState, type RtStat } from "../../src/lib/stats";

describe("ekspor aman", () => {
  it("menetralkan formula injection", () => { for (const x of ["=1+1", "+cmd", "-2", "@SUM(A1)"]) expect(safeCell(x)).toBe(`'${x}`); expect(safeCell("Budi")).toBe("Budi"); expect(safeCell(5)).toBe(5); });
  it("CSV memberi tanda kutip dan BOM", () => { const c = toCsv(["a", "b"], [["x,y", '"q"']]); expect(c.startsWith("\uFEFF")).toBe(true); expect(c).toContain('"x,y"'); expect(c).toContain('"""q"""'); });
});
describe("format waktu WIB", () => {
  it("datetime-local <-> ISO", () => { expect(toLocalInput("2026-11-01T01:00:00.000Z")).toBe("2026-11-01T08:00"); expect(fmtDateTime("2026-11-01T01:00:00.000Z")).toContain("08.00"); });
});
describe("statistik", () => {
  const rows = [{ kk: 5, berhak_l: 4, berhak_p: 2, sudah_online: 3, sudah_manual: 1 }, { kk: 2, berhak_l: 1, berhak_p: 1, sudah_online: 0, sudah_manual: 0 }] as RtStat[];
  it("total", () => expect(totals(rows)).toMatchObject({ kk: 7, total: 8, voted: 4, belum: 4 }));
  it("tahap timeline", () => { expect(stepState("DRAFT")).toBe("todo"); expect(stepState("PEMILIHAN_BERLANGSUNG")).toBe("active"); expect(stepState("DITETAPKAN")).toBe("done"); });
});

describe("seri", () => {
  it("mendeteksi perolehan sama", () => expect(hasTie([{ total_votes: 5 }, { total_votes: 3 }, { total_votes: 5 }])).toBe(true));
  it("tidak ada seri", () => expect(hasTie([{ total_votes: 5 }, { total_votes: 3 }])).toBe(false));
  it("dua calon 0 suara bukan seri", () => expect(hasTie([{ total_votes: 0 }, { total_votes: 0 }])).toBe(false));
});
