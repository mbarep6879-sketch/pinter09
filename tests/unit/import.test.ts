import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseCsv, detectDelimiter } from "../../src/lib/import/csv";
import { parseUpload } from "../../src/lib/import/parse";
import { normalizeGender, normalizeHubungan, normalizeRt, validateTable } from "../../src/lib/import/validate";

const header = "Nomor KK;Nama;Jenis Kelamin;Alamat;RT;Hubungan";
const t = (csv: string) => validateTable(parseCsv(csv).map((r) => r.map((x) => ({ text: x.trim(), isNumber: false }))));

describe("CSV", () => {
  it("mendeteksi titik koma (Excel Indonesia)", () => expect(detectDelimiter(header)).toBe(";"));
  it("kutip ganda dan koma di dalam sel", () => expect(parseCsv('a,b\n"x, y","z ""q"""')[1]).toEqual(["x, y", 'z "q"']));
  it("BOM dan CRLF", () => expect(parseCsv("\uFEFFa;b\r\n1;2\r\n")).toEqual([["a", "b"], ["1", "2"]]));
});

describe("normalisasi", () => {
  it("RT", () => { expect(normalizeRt("RT 03")).toBe("RT 03"); expect(normalizeRt("3")).toBe("RT 03"); expect(normalizeRt("RT.06")).toBe("RT 06"); expect(normalizeRt("07")).toBeNull(); });
  it("jenis kelamin", () => { expect(normalizeGender("Laki-laki")).toBe("L"); expect(normalizeGender("PR")).toBe("P"); expect(normalizeGender("x")).toBeNull(); });
  it("hubungan: kepala keluarga ambigu", () => { expect(normalizeHubungan("Kepala Keluarga")).toBe("AMBIGU"); expect(normalizeHubungan("Isteri")).toBe("ISTRI"); expect(normalizeHubungan("Anak")).toBe("LAINNYA"); expect(normalizeHubungan("???")).toBeNull(); });
});

describe("validasi berkas", () => {
  it("baris sah + hak suara dari hubungan", () => {
    const r = t(`${header}\n3573123456780001;Ahmad Fauzi;Laki-laki;Jl. A;RT 03;Suami\n3573123456780001;Siti;Perempuan;Jl. A;3;Istri\n3573123456780001;Budi;L;Jl. A;03;Anak`);
    expect(r.errors).toEqual([]); expect(r.valid).toHaveLength(3); expect(r.valid.map((v) => v.hubungan)).toEqual(["SUAMI", "ISTRI", "LAINNYA"]);
  });
  it("kolom hubungan wajib", () => expect(t("Nomor KK;Nama;Jenis Kelamin;RT\n1;a;L;1").fileErrors[0]).toContain("Hubungan"));
  it("KK bukan 16 digit", () => expect(t(`${header}\n123;A;L;-;1;Suami`).errors[0].message).toContain("16 digit"));
  it("KK notasi ilmiah (rusak oleh Excel)", () => expect(t(`${header}\n3,57312E+15;A;L;-;1;Suami`).errors[0].message).toContain("Teks"));
  it("RT di luar 01-06", () => expect(t(`${header}\n3573123456780001;A;L;-;9;Suami`).errors[0].message).toContain("RT"));
  it("duplikat orang dalam berkas", () => expect(t(`${header}\n3573123456780001;Ani;P;-;1;Istri\n3573123456780001;ANI;P;-;1;Istri`).errors[0].message).toContain("lebih dari sekali"));
  it("KK sama di dua RT", () => expect(t(`${header}\n3573123456780001;A;L;-;1;Suami\n3573123456780001;B;P;-;2;Istri`).errors[0].message).toContain("RT 01 dan RT 02"));
  it("kepala keluarga ditolak dengan petunjuk", () => expect(t(`${header}\n3573123456780001;A;L;-;1;Kepala Keluarga`).errors[0].message).toContain("Suami atau Istri"));
  it("error tidak membocorkan KK utuh", () => { const e = t(`${header}\n3573123456780001;;L;-;1;Suami`).errors[0]; expect(e.kkMasked).toBe("3573********0001"); expect(JSON.stringify(e)).not.toContain("3573123456780001"); });
  it("peringatan KK tanpa suami/istri", () => expect(t(`${header}\n3573123456780001;Anak;L;-;1;Anak`).warnings.join()).toContain("tidak memiliki Suami/Istri"));
  it("baris kosong dilewati", () => expect(t(`${header}\n;;;;;\n3573123456780001;A;L;-;1;Suami`).valid).toHaveLength(1));
});

describe("berkas Excel", () => {
  async function xlsx(kkValue: string | number) {
    const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Data");
    ws.addRow(["Nomor KK", "Nama", "Jenis Kelamin", "Alamat", "RT", "Hubungan"]);
    ws.addRow([kkValue, "Ahmad Fauzi", "Laki-laki", "Jl. A", "RT 03", "Suami"]);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
  it("KK bertipe teks lolos", async () => { const r = validateTable(await parseUpload(await xlsx("3573123456780001"), "a.xlsx")); expect(r.errors).toEqual([]); expect(r.valid[0].kk).toBe("3573123456780001"); });
  it("KK bertipe angka DITOLAK (Excel merusak digit terakhir)", async () => { const r = validateTable(await parseUpload(await xlsx(3573123456780001), "a.xlsx")); expect(r.valid).toHaveLength(0); expect(r.errors[0].message).toContain("Teks"); });
  it("ekstensi tidak didukung", async () => { await expect(parseUpload(Buffer.from("x"), "a.exe")).rejects.toThrow(".xlsx atau .csv"); });
  it("berkas rusak", async () => { await expect(parseUpload(Buffer.from("bukan excel"), "a.xlsx")).rejects.toThrow("tidak dapat dibaca"); });
  it("berkas kosong", async () => { await expect(parseUpload(Buffer.alloc(0), "a.csv")).rejects.toThrow("kosong"); });
});
