import { isValidKkFormat, maskKk } from "@/lib/kk/mask";
import type { Table } from "@/lib/import/parse";

export type Hubungan = "SUAMI" | "ISTRI" | "LAINNYA";
export type ValidRow = { rowNo: number; kk: string; nama: string; jenisKelamin: "L" | "P"; hubungan: Hubungan; alamat: string; rt: string };
export type RowError = { rowNo: number; kkMasked: string; message: string };
export type ValidationResult = { valid: ValidRow[]; errors: RowError[]; warnings: string[]; fileErrors: string[] };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const HEADERS: Record<"kk" | "nama" | "jk" | "alamat" | "rt" | "hubungan", string[]> = {
  kk: ["nomor kk", "no kk", "nkk", "no kartu keluarga", "nomor kartu keluarga", "kk"],
  nama: ["nama", "nama lengkap"],
  jk: ["jenis kelamin", "jeniskelamin", "jk", "gender", "l p"],
  alamat: ["alamat"],
  rt: ["rt"],
  hubungan: ["hubungan", "hubungan keluarga", "status hubungan", "status hubungan dalam keluarga", "shdk"],
};

const LAINNYA = new Set(["anak", "lainnya", "lain lain", "menantu", "cucu", "orang tua", "mertua", "famili lain", "saudara", "keponakan", "pembantu"]);

export function normalizeGender(v: string): "L" | "P" | null {
  const n = norm(v);
  if (["l", "lk", "laki laki", "laki", "pria", "male"].includes(n)) return "L";
  if (["p", "pr", "perempuan", "wanita", "female"].includes(n)) return "P";
  return null;
}

export function normalizeRt(v: string): string | null {
  const m = norm(v).replace(/\s/g, "").match(/^(?:rt)?0*([1-6])$/);
  return m ? `RT 0${m[1]}` : null;
}

export function normalizeHubungan(v: string): Hubungan | "AMBIGU" | null {
  const n = norm(v);
  if (n === "suami") return "SUAMI";
  if (n === "istri" || n === "isteri") return "ISTRI";
  if (LAINNYA.has(n)) return "LAINNYA";
  if (n === "kepala keluarga" || n === "kk") return "AMBIGU";
  return null;
}

export function validateTable(table: Table): ValidationResult {
  const res: ValidationResult = { valid: [], errors: [], warnings: [], fileErrors: [] };
  if (table.length < 2) { res.fileErrors.push("Berkas tidak berisi data (minimal baris judul dan satu baris data)."); return res; }

  const headerCells = table[0].map((c) => norm(c.text));
  const col: Partial<Record<keyof typeof HEADERS, number>> = {};
  for (const key of Object.keys(HEADERS) as (keyof typeof HEADERS)[]) {
    const idx = headerCells.findIndex((h) => HEADERS[key].includes(h));
    if (idx >= 0) col[key] = idx;
  }
  const labels = { kk: "Nomor KK", nama: "Nama", jk: "Jenis Kelamin", alamat: "Alamat", rt: "RT", hubungan: "Hubungan" };
  const missing = (["kk", "nama", "jk", "rt", "hubungan"] as const).filter((k) => col[k] === undefined);
  if (missing.length) {
    res.fileErrors.push(`Kolom wajib tidak ditemukan: ${missing.map((k) => labels[k]).join(", ")}. Kolom "Hubungan" (Suami/Istri/Anak/Lainnya) diperlukan untuk menentukan hak suara.`);
    return res;
  }
  const get = (row: Table[number], k: keyof typeof HEADERS) => (col[k] === undefined ? undefined : row[col[k]!]);

  const seen = new Set<string>();
  const kkRt = new Map<string, string>();
  const perKk = new Map<string, { suami: number; istri: number }>();

  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    if (row.every((c) => c.text === "")) continue;
    const rowNo = i + 1; // nomor baris seperti di Excel
    const kkCell = get(row, "kk");
    const kkText = (kkCell?.text ?? "").replace(/[\s'-]/g, "");
    const err = (message: string) => res.errors.push({ rowNo, kkMasked: isValidKkFormat(kkText) ? maskKk(kkText) : "(tidak valid)", message });

    if (kkCell?.isNumber || /e\+/i.test(kkText)) { err("Nomor KK tersimpan sebagai angka sehingga digit terakhir bisa rusak. Ubah format kolom menjadi Teks lalu isi ulang."); continue; }
    if (!isValidKkFormat(kkText)) { err("Nomor KK harus 16 digit angka."); continue; }
    const nama = (get(row, "nama")?.text ?? "").replace(/\s+/g, " ").trim();
    if (!nama) { err("Nama kosong."); continue; }
    const jk = normalizeGender(get(row, "jk")?.text ?? "");
    if (!jk) { err("Jenis kelamin harus L/P (Laki-laki/Perempuan)."); continue; }
    const rt = normalizeRt(get(row, "rt")?.text ?? "");
    if (!rt) { err("RT harus 01 sampai 06."); continue; }
    const hub = normalizeHubungan(get(row, "hubungan")?.text ?? "");
    if (hub === "AMBIGU") { err('Hubungan "Kepala Keluarga" ambigu. Tuliskan Suami atau Istri.'); continue; }
    if (!hub) { err("Hubungan tidak dikenali. Gunakan: Suami, Istri, Anak, atau Lainnya."); continue; }

    const dupKey = `${kkText}|${nama.toLowerCase()}`;
    if (seen.has(dupKey)) { err("Orang yang sama muncul lebih dari sekali dalam berkas."); continue; }
    const firstRt = kkRt.get(kkText);
    if (firstRt && firstRt !== rt) { err(`Nomor KK yang sama tercatat di ${firstRt} dan ${rt}.`); continue; }

    seen.add(dupKey); kkRt.set(kkText, rt);
    const c = perKk.get(kkText) ?? { suami: 0, istri: 0 };
    if (hub === "SUAMI") c.suami++; if (hub === "ISTRI") c.istri++;
    perKk.set(kkText, c);
    res.valid.push({ rowNo, kk: kkText, nama, jenisKelamin: jk, hubungan: hub, alamat: (get(row, "alamat")?.text ?? "").trim(), rt });
  }

  let multi = 0, none = 0;
  for (const c of perKk.values()) { if (c.suami > 1 || c.istri > 1) multi++; if (c.suami + c.istri === 0) none++; }
  if (multi) res.warnings.push(`${multi} KK memiliki lebih dari satu Suami/Istri. Periksa kembali; semuanya akan diberi hak suara.`);
  if (none) res.warnings.push(`${none} KK tidak memiliki Suami/Istri sehingga tidak ada yang berhak memilih dari KK tersebut.`);
  return res;
}
