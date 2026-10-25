"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { CheckCircle2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Field, Input } from "@/components/ui/input";
import { ballotAction, selectVoterAction, submitVoteAction, verifyKkAction } from "@/server/actions/voting";
import type { BallotOptions, Identity, Member } from "@/server/services/voting";
import { VotingProgress } from "./VotingProgress";
import { CandidateSelector } from "./CandidateSelector";
import { CandidateSearch } from "./CandidateSearch";
import { VoteConfirmation } from "./VoteConfirmation";
import { Turnstile } from "./Turnstile";
import { useOnline } from "./useOnline";

type Step = "kk" | "pick" | "identity" | "ballot" | "review" | "done";
const JK = { L: "Laki-laki", P: "Perempuan" } as const;
const OFFLINE = "Koneksi internet diperlukan untuk proses pemberian suara.";
const RESTART_CODES = ["SESSION_INVALID", "SESSION_EXPIRED", "ALREADY_VOTED", "ELECTION_NOT_OPEN"];

export function VotingFlow({ rt, turnstileSiteKey }: { rt: string; turnstileSiteKey?: string }) {
  const online = useOnline();
  const [step, setStep] = useState<Step>("kk");
  const [kk, setKk] = useState("");
  const [invite, setInvite] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [token, setToken] = useState("");           // hanya di memori halaman; tidak ke URL/localStorage
  const [members, setMembers] = useState<Member[]>([]);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [options, setOptions] = useState<BallotOptions | null>(null);
  const [rtIds, setRtIds] = useState<string[]>([]);
  const [rwIds, setRwIds] = useState<string[]>([]);
  const [receipt, setReceipt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onToken = useCallback((t: string) => setCaptcha(t), []);

  function reset(msg = "") {
    setStep("kk"); setKk(""); setInvite(""); setToken(""); setMembers([]); setIdentity(null); setOptions(null);
    setRtIds([]); setRwIds([]); setError(msg);
  }
  function fail(r: { message: string; code?: string }) {
    if (r.code && RESTART_CODES.includes(r.code) && step !== "kk" && step !== "pick") { reset(r.message); return; }
    setError(r.message);
  }

  async function submitKk(e: React.FormEvent) {
    e.preventDefault();
    if (!online) return setError(OFFLINE);
    setBusy(true); setError("");
    const r = await verifyKkAction({ rt, kk, invite, turnstile: captcha });
    setBusy(false);
    if (!r.ok) { window.turnstile?.reset(); setCaptcha(""); return setError(r.message); }
    setKk(""); setInvite("");                       // buang nomor KK dari memori segera
    setToken(r.data.token); setMembers(r.data.members); setStep("pick");
  }

  async function pickMember(m: Member) {
    if (!online) return setError(OFFLINE);
    setBusy(true); setError("");
    const r = await selectVoterAction({ token, voterId: m.id });
    setBusy(false);
    if (!r.ok) return fail(r);
    setIdentity(r.data); setStep("identity");
  }

  async function toBallot() {
    if (!online) return setError(OFFLINE);
    setBusy(true); setError("");
    const r = await ballotAction({ token });
    setBusy(false);
    if (!r.ok) return fail(r);
    setOptions(r.data); setStep("ballot");
  }

  async function send() {
    if (!options?.rt) return;
    if (!online) return setError(OFFLINE);
    setBusy(true); setError("");
    const ballots = [{ election_id: options.rt.election_id, candidate_ids: rtIds }];
    if (options.rw) ballots.push({ election_id: options.rw.election_id, candidate_ids: rwIds });
    const r = await submitVoteAction({ token, ballots });
    setBusy(false);
    if (!r.ok) { if (r.code && RESTART_CODES.includes(r.code)) return reset(r.message); setStep("review"); return setError(r.message); }
    setReceipt(r.data.receipt); setToken(""); setRtIds([]); setRwIds([]); setStep("done");
  }

  const progress = step === "kk" || step === "pick" || step === "identity" ? 0 : step === "ballot" ? 1 : step === "review" ? 2 : 3;
  const ballotReady = !!options?.rt && rtIds.length >= 1 && (!options.rw || rwIds.length >= 1);

  return (
    <div>
      <VotingProgress current={progress} />
      {!online && <Alert kind="warning" className="mb-4"><span className="flex items-center gap-2"><WifiOff className="size-4" aria-hidden />{OFFLINE}</span></Alert>}
      {error && <Alert kind="error" className="mb-4">{error}</Alert>}

      {step === "kk" && (
        <form onSubmit={submitKk} className="space-y-4" autoComplete="off">
          <h2 className="text-xl font-extrabold">Verifikasi pemilih {rt}</h2>
          <Field label="Nomor Kartu Keluarga (16 digit)" hint="Lihat di Kartu Keluarga Anda.">
            <Input value={kk} onChange={(e) => setKk(e.target.value)} inputMode="numeric" autoComplete="off" required placeholder="3573 xxxx xxxx xxxx" aria-label="Nomor Kartu Keluarga" />
          </Field>
          <Field label="Kode undangan (jika Anda menerimanya dari panitia)">
            <Input value={invite} onChange={(e) => setInvite(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="XXXX-XXXX" />
          </Field>
          <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />
          <Button type="submit" size="lg" className="w-full" disabled={busy || !online || (!!turnstileSiteKey && !captcha)}>{busy ? "Memeriksa..." : "Lanjutkan"}</Button>
          <p className="text-center text-xs text-muted-foreground">Nomor KK hanya dipakai untuk verifikasi dan tidak disimpan di perangkat Anda.</p>
        </form>
      )}

      {step === "pick" && (
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold">Siapa yang akan memilih?</h2>
          <p className="text-sm text-muted-foreground">Pilih nama Anda sendiri. Setiap orang hanya dapat memilih atas namanya sendiri.</p>
          <ul className="space-y-3">
            {members.map((m) => (
              <li key={m.id}>
                <Button variant="outline" size="lg" className="h-auto w-full justify-between py-4 text-left" disabled={busy || m.sudah_memilih} onClick={() => pickMember(m)}>
                  <span><span className="block text-lg font-bold">{m.nama_masked}</span><span className="block text-sm font-normal text-muted-foreground">{JK[m.jenis_kelamin]}</span></span>
                  {m.sudah_memilih && <span className="text-sm font-semibold text-success">Hak suara telah digunakan</span>}
                </Button>
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={() => reset()}>Kembali</Button>
        </div>
      )}

      {step === "identity" && identity && (
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold">Pastikan data Anda benar sebelum melanjutkan.</h2>
          <dl className="space-y-3 rounded-lg border bg-card p-4">
            <div><dt className="text-xs text-muted-foreground">Nama lengkap</dt><dd className="text-lg font-bold">{identity.nama}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Jenis kelamin</dt><dd>{JK[identity.jenis_kelamin]}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Alamat</dt><dd>{identity.alamat || "-"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">RT</dt><dd>{identity.rt}</dd></div>
          </dl>
          <Button size="lg" className="w-full" onClick={toBallot} disabled={busy || !online}>{busy ? "Memuat..." : "Data benar, lanjutkan"}</Button>
          <Alert kind="info">Data tidak sesuai? <strong>Hubungi panitia</strong> di lokasi pemilihan sebelum melanjutkan.</Alert>
          <Button variant="ghost" onClick={() => setStep("pick")}>Bukan saya, kembali</Button>
        </div>
      )}

      {step === "ballot" && options && (
        <div className="space-y-8">
          {options.rt && (
            <section>
              <h2 className="mb-3 text-xl font-extrabold">Calon Pengurus {rt}</h2>
              <CandidateSelector candidates={options.rt.candidates} max={options.rt.max_choices} selected={rtIds} onChange={setRtIds} />
            </section>
          )}
          {options.rw && (
            <section>
              <h2 className="mb-3 text-xl font-extrabold">Bakal Calon Pengurus RW 09</h2>
              <CandidateSearch candidates={options.rw.candidates} max={options.rw.max_choices} selected={rwIds} onChange={setRwIds} />
            </section>
          )}
          {!ballotReady && <p className="text-sm text-muted-foreground">Lengkapi pilihan {options.rw ? "RT dan RW" : "RT"} untuk melanjutkan.</p>}
          <Button size="lg" className="w-full" disabled={!ballotReady} onClick={() => { setError(""); setStep("review"); }}>Lanjutkan</Button>
        </div>
      )}

      {step === "review" && options && (
        <VoteConfirmation options={options} rtIds={rtIds} rwIds={rwIds} busy={busy} disabled={!online} onBack={() => { setError(""); setStep("ballot"); }} onConfirm={send} />
      )}

      {step === "done" && (
        <div className="space-y-5 text-center">
          <CheckCircle2 className="mx-auto size-16 text-success" aria-hidden />
          <h2 className="text-2xl font-extrabold">Terima kasih.</h2>
          <p className="text-lg">Hak suara Anda telah tercatat.</p>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-xs text-muted-foreground">Bukti partisipasi</p>
            <p className="font-mono text-2xl font-bold tracking-wider">{receipt}</p>
            <p className="mt-2 text-xs text-muted-foreground">Kode ini hanya bukti bahwa hak suara telah digunakan, bukan penanda pilihan Anda.</p>
          </div>
          <Button size="lg" variant="outline" className="w-full" onClick={() => { setReceipt(""); reset(); }}>Anggota keluarga lain di KK ini</Button>
          <Button size="lg" className="w-full" asChild><Link href="/">Selesai</Link></Button>
        </div>
      )}
    </div>
  );
}
