import { beforeAll, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { PEPPER, STAFF, anonClient, serviceClient, staffClient } from "./harness";
import { hmacKk } from "../../src/lib/kk/hash";
import { commitImport, discardImport, previewImport } from "../../src/server/services/importer";
import { ballotOptions, chooseVoter, rtIdByCode, startSession, submitBallots } from "../../src/server/services/voting";

const admin = serviceClient();
const panitia = staffClient(STAFF.panitia);
const kk = (n: number) => `35730000000000${String(n).padStart(2, "0")}`;

async function xlsx(rows: (string | number)[][]) {
  const wb = new ExcelJS.Workbook(); const ws = wb.addWorksheet("Data");
  ws.addRow(["Nomor KK", "Nama", "Jenis Kelamin", "Alamat", "RT", "Hubungan"]); rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
const unwrap = <T,>(r: { ok: boolean } & Record<string, unknown>): T => { if (!r.ok) throw new Error(JSON.stringify(r)); return (r as unknown as { data: T }).data; };

let rt3: string; let eRT3: string; let eRW: string; let cands: string[]; let rwCands: string[];

describe("import -> konfigurasi -> pemungutan suara (via API)", () => {
  beforeAll(async () => {
    rt3 = (await rtIdByCode(admin, "RT 03"))!;
  });

  it("I1 pratinjau import tidak memasukkan data dan tidak membocorkan KK utuh", async () => {
    const file = await xlsx([
      [kk(1), "Ahmad Fauzi", "Laki-laki", "Jl. A 1", "RT 03", "Suami"], [kk(1), "Siti Aminah", "Perempuan", "Jl. A 1", "RT 03", "Istri"],
      [kk(1), "Zahra", "Perempuan", "Jl. A 1", "RT 03", "Anak"],
      [kk(2), "Budi Santoso", "L", "Jl. B 2", "3", "Suami"], [kk(3), "Budi Santoso", "L", "Jl. C 3", "3", "Suami"],
      [kk(4), "Dewi Lestari", "P", "Jl. D 4", "RT 03", "Istri"], [kk(5), "Fajar", "L", "Jl. F 5", "RT 03", "Suami"],
      [kk(6), "Bermasalah", "L", "-", "RT 09", "Suami"],
    ]);
    const r = await previewImport(admin, STAFF.panitia, { name: "uji.xlsx", buffer: file }, PEPPER);
    const d = unwrap<Awaited<ReturnType<typeof previewImport>> extends infer R ? R extends { data: infer D } ? D : never : never>(r as never) as any;
    expect(d.summary).toMatchObject({ newVoters: 7, newHouseholds: 5, conflicts: 0, fileErrors: 1 });
    expect(d.errors[0].message).toContain("RT");
    expect(JSON.stringify(d)).not.toContain(kk(1));
    const { count } = await admin.from("voters").select("*", { count: "exact", head: true });
    expect(count).toBe(0);
    // lanjutkan: tolak tanpa persetujuan, terima dengan persetujuan sebagian
    const blocked = await commitImport(admin, STAFF.panitia, d.batchId, false);
    expect(blocked).toMatchObject({ ok: false, code: "IMPORT_HAS_ERRORS" });
    const done = unwrap<{ voters_added: number; households_added: number }>(await commitImport(admin, STAFF.panitia, d.batchId, true) as never);
    expect(done).toEqual({ voters_added: 7, households_added: 5 });
  });

  it("I2 impor ulang berkas yang sama tidak menggandakan data", async () => {
    const file = await xlsx([[kk(1), "Ahmad Fauzi", "Laki-laki", "Jl. A 1", "RT 03", "Suami"]]);
    const r = unwrap<any>(await previewImport(admin, STAFF.panitia, { name: "ulang.xlsx", buffer: file }, PEPPER) as never);
    expect(r.summary).toMatchObject({ newVoters: 0, alreadyExists: 1 });
    expect((await discardImport(admin, STAFF.panitia, r.batchId)).ok).toBe(true);
    const { count } = await admin.from("import_staging").select("*", { count: "exact", head: true });
    expect(count).toBe(0);
  });

  it("I3 panitia menyiapkan pemilihan lewat API (calon, metode, status) tanpa jalan pintas", async () => {
    const { data: e } = await admin.from("elections").select("id").eq("neighborhood_id", rt3).single(); eRT3 = e!.id;
    const { data: w } = await admin.from("elections").select("id").eq("type", "RW_NOMINATION").single(); eRW = w!.id;
    // status tidak boleh diubah langsung
    const direct = await panitia.from("elections").update({ status: "PEMILIHAN_BERLANGSUNG" }).eq("id", eRT3);
    expect(direct.error?.message).toMatch(/permission denied/);
    expect((await panitia.from("elections").update({ method: "VOTING", max_choices: 2 }).eq("id", eRT3)).error).toBeNull();
    expect((await panitia.from("elections").update({ method: "VOTING", max_choices: 1 }).eq("id", eRW)).error).toBeNull();
    const { data: vs } = await panitia.rpc("list_voters", { p_rt: rt3, p_q: "Budi", p_limit: 10, p_offset: 0 });
    expect(vs).toHaveLength(2);
    expect(vs[0].kk_masked).toMatch(/^\d{4}\*{8}\d{4}$/);
    cands = [];
    for (const v of vs) { const { data, error } = await panitia.rpc("add_candidate", { p_election: eRT3, p_voter: v.id }); expect(error).toBeNull(); cands.push(data); }
    expect((await panitia.from("candidates").update({ status: "CALON_TETAP" }).eq("election_id", eRT3)).error).toBeNull();
    const { data: rw } = await panitia.rpc("list_voters", { p_q: "Ahmad", p_limit: 5, p_offset: 0 });
    const r1 = await panitia.rpc("add_candidate", { p_election: eRW, p_voter: rw[0].id }); expect(r1.error).toBeNull(); rwCands = [r1.data];
    for (const [id, steps] of [[eRT3, ["TERJADWAL", "PERSIAPAN", "PEMILIHAN_BERLANGSUNG"]], [eRW, ["TERJADWAL", "PERSIAPAN", "PEMILIHAN_BERLANGSUNG"]]] as const)
      for (const s of steps) { const { error } = await panitia.rpc("set_election_status", { p_election: id, p_to: s }); expect(error, s).toBeNull(); }
    expect((await staffClient(STAFF.viewer).rpc("set_election_status", { p_election: eRT3, p_to: "PERHITUNGAN" })).error?.message).toContain("FORBIDDEN");
  });

  it("I4 alur pemilih lengkap: NKK -> pilih nama -> surat suara -> kirim; pasangan satu KK memilih bergantian", async () => {
    const s1 = unwrap<any>(await startSession(admin, { rtId: rt3, kkHash: hmacKk(kk(1), PEPPER) }) as never);
    expect(s1.members).toHaveLength(2);                                   // anak tidak ikut
    expect(JSON.stringify(s1)).not.toContain("Ahmad Fauzi");              // nama tersamar
    const ahmad = s1.members.find((m: any) => m.nama_masked.startsWith("Ahm"));
    const before = await ballotOptions(admin, s1.token);
    expect(before).toMatchObject({ ok: false, code: "SESSION_INVALID" }); // belum memilih nama
    const id = unwrap<any>(await chooseVoter(admin, s1.token, ahmad.id) as never);
    expect(id).toEqual({ nama: "Ahmad Fauzi", jenis_kelamin: "L", alamat: "Jl. A 1", rt: "RT 03" });
    const opt = unwrap<any>(await ballotOptions(admin, s1.token) as never);
    expect(opt.rt.candidates).toHaveLength(2); expect(opt.rt.max_choices).toBe(2); expect(opt.rw.candidates).toHaveLength(1);
    expect(JSON.stringify(opt)).not.toMatch(/kk_|hash|\d{16}/);
    const tooMany = await submitBallots(admin, s1.token, [{ election_id: opt.rt.election_id, candidate_ids: [cands[0], rwCands[0]] }]);
    expect(tooMany).toMatchObject({ ok: false, code: "CANDIDATE_INVALID" });
    const sent = unwrap<{ receipt: string }>(await submitBallots(admin, s1.token, [
      { election_id: opt.rt.election_id, candidate_ids: [cands[0]] }, { election_id: opt.rw.election_id, candidate_ids: [rwCands[0]] }]) as never);
    expect(sent.receipt).toMatch(/^VOTE-[0-9A-F]{4}-[0-9A-F]{4}$/);
    expect(await submitBallots(admin, s1.token, [{ election_id: opt.rt.election_id, candidate_ids: [cands[0]] }])).toMatchObject({ ok: false, code: "SESSION_INVALID" });

    const s2 = unwrap<any>(await startSession(admin, { rtId: rt3, kkHash: hmacKk(kk(1), PEPPER) }) as never);
    expect(s2.members.filter((m: any) => m.sudah_memilih)).toHaveLength(1);
    const again = await chooseVoter(admin, s2.token, ahmad.id);
    expect(again).toMatchObject({ ok: false, code: "ALREADY_VOTED", message: "Hak suara Anda telah digunakan." });
    const siti = s2.members.find((m: any) => !m.sudah_memilih);
    unwrap(await chooseVoter(admin, s2.token, siti.id) as never);
    unwrap(await submitBallots(admin, s2.token, [{ election_id: opt.rt.election_id, candidate_ids: [cands[1]] }]) as never);
    expect(await startSession(admin, { rtId: rt3, kkHash: hmacKk(kk(1), PEPPER) })).toMatchObject({ ok: false, code: "ALREADY_VOTED" });
  });

  it("I5 NKK tidak dikenal dan NKK dari RT lain menghasilkan pesan yang SAMA (mencegah penebakan)", async () => {
    // siapkan RT 04 yang benar-benar terbuka dengan satu KK
    const file = await xlsx([[kk(7), "Rina Wulandari", "Perempuan", "Jl. R 7", "RT 04", "Istri"], [kk(8), "Rudi Hartono", "L", "Jl. R 8", "RT 04", "Suami"]]);
    const p = unwrap<any>(await previewImport(admin, STAFF.panitia, { name: "rt4.xlsx", buffer: file }, PEPPER) as never);
    unwrap(await commitImport(admin, STAFF.panitia, p.batchId, false) as never);
    const rt4 = (await rtIdByCode(admin, "RT 04"))!;
    const { data: e4 } = await admin.from("elections").select("id").eq("neighborhood_id", rt4).single();
    expect((await panitia.from("elections").update({ method: "VOTING", max_choices: 1 }).eq("id", e4!.id)).error).toBeNull();
    const { data: vs } = await panitia.rpc("list_voters", { p_rt: rt4, p_limit: 10, p_offset: 0 });
    await panitia.rpc("add_candidate", { p_election: e4!.id, p_voter: vs[0].id });
    await panitia.from("candidates").update({ status: "CALON_TETAP" }).eq("election_id", e4!.id);
    for (const st of ["TERJADWAL", "PERSIAPAN", "PEMILIHAN_BERLANGSUNG"]) expect((await panitia.rpc("set_election_status", { p_election: e4!.id, p_to: st })).error).toBeNull();

    const unknown = await startSession(admin, { rtId: rt3, kkHash: hmacKk("9999999999999999", PEPPER) });
    const wrongRt = await startSession(admin, { rtId: rt3, kkHash: hmacKk(kk(7), PEPPER) });   // KK ada, tetapi di RT 04
    expect(unknown).toMatchObject({ ok: false, code: "VOTER_NOT_FOUND" });
    expect(wrongRt).toEqual(unknown);
    expect((await startSession(admin, { rtId: rt4, kkHash: hmacKk(kk(7), PEPPER) })).ok).toBe(true);   // di RT yang benar tetap berhasil
  });

  it("I6 20 perangkat serentak memakai satu pemilih: tepat satu suara tercatat", async () => {
    const attempt = async () => {
      const s = await startSession(admin, { rtId: rt3, kkHash: hmacKk(kk(5), PEPPER) });
      if (!s.ok) return s.code;
      const m = s.data.members[0];
      const c = await chooseVoter(admin, s.data.token, m.id); if (!c.ok) return c.code;
      const r = await submitBallots(admin, s.data.token, [{ election_id: eRT3, candidate_ids: [cands[0]] }]);
      return r.ok ? "OK" : r.code;
    };
    const out = await Promise.all(Array.from({ length: 20 }, attempt));
    expect(out.filter((x) => x === "OK")).toHaveLength(1);
    expect(out.filter((x) => x === "OK" || x === "ALREADY_VOTED" || x === "SESSION_INVALID").length).toBe(20);
    const { count } = await admin.from("vote_participation").select("*", { count: "exact", head: true }).eq("election_id", eRT3);
    expect(count).toBe(3);                                                // Ahmad, Siti, Fajar
  });

  it("I7 hak akses lewat API: klien tidak melihat suara, hash KK, maupun data pemilih tanpa role", async () => {
    const anon = anonClient(), viewer = staffClient(STAFF.viewer);
    expect((await anon.from("votes").select("*")).error?.message).toMatch(/permission denied/);
    expect((await panitia.from("votes").select("*")).error?.message).toMatch(/permission denied/);
    expect((await panitia.from("ballots").select("*")).error?.message).toMatch(/permission denied/);
    expect((await panitia.from("households").select("kk_hash")).error?.message).toMatch(/permission denied/);
    expect((await anon.rpc("cast_ballots", { p_token: "x", p_ballots: [] })).error?.message).toMatch(/permission denied/);
    expect((await viewer.from("voters").select("id")).data).toEqual([]);
    expect((await anon.from("voters").select("id")).error?.message).toMatch(/permission denied/);
  });

  it("I8 statistik dashboard dan rekap hasil sesuai suara yang masuk", async () => {
    const { data: st, error } = await panitia.rpc("get_dashboard_stats"); expect(error).toBeNull();
    const rt = st.rt.find((x: any) => x.rt === "RT 03");
    expect(rt).toMatchObject({ kk: 5, berhak_l: 4, berhak_p: 2, sudah_online: 3, sudah_manual: 0, status: "PEMILIHAN_BERLANGSUNG" });
    const { data: res } = await panitia.rpc("get_election_results", { p_election_id: eRT3 });
    expect(res.reduce((a: number, r: any) => a + Number(r.total_votes), 0)).toBe(3);   // Ahmad, Siti, Fajar masing-masing satu pilihan
  });
});
