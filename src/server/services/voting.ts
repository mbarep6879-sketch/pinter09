import type { SupabaseClient } from "@supabase/supabase-js";
import { failFrom, ok, type Result } from "@/server/services/result";

export type Member = { id: string; nama_masked: string; jenis_kelamin: "L" | "P"; sudah_memilih: boolean };
export type Candidate = { id: string; nomor_urut: number; nama: string; jenis_kelamin: "L" | "P"; alamat: string; rt: string };
export type BallotSection = { election_id: string; nama: string; max_choices: number; candidates: Candidate[] };
export type BallotOptions = { rt: BallotSection | null; rw: BallotSection | null };
export type Identity = { nama: string; jenis_kelamin: "L" | "P"; alamat: string; rt: string };

export async function rtIdByCode(admin: SupabaseClient, code: string): Promise<string | null> {
  const { data } = await admin.from("neighborhoods").select("id").eq("code", code).maybeSingle();
  return data?.id ?? null;
}

export async function startSession(admin: SupabaseClient, p: { rtId: string; kkHash: string; inviteHash?: string | null }): Promise<Result<{ token: string; expires_at: string; members: Member[] }>> {
  const { data, error } = await admin.rpc("start_voting_session", { p_kk_hash: p.kkHash, p_neighborhood_id: p.rtId, p_invite_hash: p.inviteHash ?? null });
  return error ? failFrom(error) : ok(data);
}

export async function chooseVoter(admin: SupabaseClient, token: string, voterId: string): Promise<Result<Identity>> {
  const { data, error } = await admin.rpc("select_voter", { p_token: token, p_voter_id: voterId });
  return error ? failFrom(error) : ok(data);
}

export async function ballotOptions(admin: SupabaseClient, token: string): Promise<Result<BallotOptions>> {
  const { data, error } = await admin.rpc("get_ballot_options", { p_token: token });
  return error ? failFrom(error) : ok(data);
}

export type BallotInput = { election_id: string; candidate_ids: string[] };

export async function submitBallots(admin: SupabaseClient, token: string, ballots: BallotInput[]): Promise<Result<{ receipt: string }>> {
  const { data, error } = await admin.rpc("cast_ballots", { p_token: token, p_ballots: ballots });
  return error ? failFrom(error) : ok({ receipt: data as string });
}
