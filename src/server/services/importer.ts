import type { SupabaseClient } from "@supabase/supabase-js";
import { hmacKk } from "@/lib/kk/hash";
import { maskKk } from "@/lib/kk/mask";
import { parseUpload } from "@/lib/import/parse";
import { validateTable, type RowError } from "@/lib/import/validate";
import { failFrom, ok, type Result } from "@/server/services/result";

export type ImportPreview = {
  batchId: string;
  summary: { totalRows: number; newVoters: number; newHouseholds: number; alreadyExists: number; conflicts: number; fileErrors: number };
  errors: RowError[];
  warnings: string[];
  sample: { rowNo: number; kkMasked: string; nama: string; jk: string; rt: string; hubungan: string; status: string }[];
};

/** Tahap 1: baca berkas, validasi, simpan ke staging. Nomor KK mentah hanya ada di memori fungsi ini. */
export async function previewImport(admin: SupabaseClient, actor: string, file: { name: string; buffer: Buffer }, hashKey?: string): Promise<Result<ImportPreview> | { ok: false; code: "FILE"; message: string }> {
  let table;
  try { table = await parseUpload(file.buffer, file.name); } catch (e) { return { ok: false, code: "FILE", message: (e as Error).message }; }
  const v = validateTable(table);
  if (v.fileErrors.length) return { ok: false, code: "FILE", message: v.fileErrors[0] };

  const rows = v.valid.map((r) => ({
    row_no: r.rowNo, kk_hash: hmacKk(r.kk, hashKey), kk_masked: maskKk(r.kk), nama: r.nama,
    jenis_kelamin: r.jenisKelamin, hubungan: r.hubungan, alamat: r.alamat, rt: r.rt,
  }));
  const { data, error } = await admin.rpc("stage_import", { p_filename: file.name.slice(0, 200), p_actor: actor, p_rows: rows, p_file_errors: v.errors.length });
  if (error) return failFrom(error);

  const { data: sample } = await admin.from("import_staging").select("row_no, kk_masked, nama, jenis_kelamin, hubungan, row_status, neighborhoods(code)")
    .eq("batch_id", data.batch_id).order("row_no").limit(30);
  type S = { row_no: number; kk_masked: string; nama: string; jenis_kelamin: string; hubungan: string; row_status: string; neighborhoods: { code: string } | { code: string }[] | null };
  return ok({
    batchId: data.batch_id,
    summary: { totalRows: data.total_rows, newVoters: data.new_voters, newHouseholds: data.new_households, alreadyExists: data.already_exists, conflicts: data.conflicts, fileErrors: data.file_errors },
    errors: v.errors.slice(0, 200), warnings: v.warnings,
    sample: ((sample ?? []) as unknown as S[]).map((s) => ({ rowNo: s.row_no, kkMasked: s.kk_masked, nama: s.nama, jk: s.jenis_kelamin, rt: (Array.isArray(s.neighborhoods) ? s.neighborhoods[0] : s.neighborhoods)?.code ?? "", hubungan: s.hubungan, status: s.row_status })),
  });
}

export async function commitImport(admin: SupabaseClient, actor: string, batchId: string, allowPartial: boolean): Promise<Result<{ households_added: number; voters_added: number }>> {
  const { data, error } = await admin.rpc("commit_import", { p_batch: batchId, p_actor: actor, p_allow_partial: allowPartial });
  return error ? failFrom(error) : ok(data);
}

export async function discardImport(admin: SupabaseClient, actor: string, batchId: string): Promise<Result<null>> {
  const { error } = await admin.rpc("discard_import", { p_batch: batchId, p_actor: actor });
  return error ? failFrom(error) : ok(null);
}
