import { createServerSupabase } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth/session";
import { canWrite } from "@/lib/auth/roles";
import { loadElections } from "@/lib/elections";
import { PageHeader } from "@/components/admin/PageHeader";
import { ActionForm } from "@/components/admin/ActionForm";
import { ElectionStatusBadge } from "@/components/election/ElectionStatusBadge";
import { ScheduleCalendar } from "@/components/election/ScheduleCalendar";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { fmtDate, toLocalInput } from "@/lib/format";
import { saveScheduleAction } from "@/server/actions/admin";

export default async function Jadwal() {
  const staff = await requireStaff("jadwal");
  const sb = await createServerSupabase();
  const [elections, { data: sch }] = await Promise.all([loadElections(sb), sb.from("election_schedules").select("*")]);
  const by = new Map((sch ?? []).map((s) => [s.election_id as string, s]));
  const write = canWrite(staff.role, "jadwal");
  const events = elections.flatMap((e) => { const s = by.get(e.id); return s?.mulai ? [{ date: s.mulai as string, label: e.label, status: e.status }] : []; });
  return (
    <div className="space-y-6">
      <PageHeader title="Jadwal pemilihan" subtitle="Setiap RT memiliki jadwal, lokasi, dan metode sendiri. Waktu dalam WIB." />
      <ScheduleCalendar events={events} />
      <div className="grid gap-4 lg:grid-cols-2">
        {elections.map((e) => {
          const s = by.get(e.id);
          return (
            <Card key={e.id}>
              <div className="mb-3 flex items-center justify-between gap-2"><h2 className="font-bold">{e.label}</h2><ElectionStatusBadge status={e.status} /></div>
              {s?.mulai && <p className="mb-2 text-sm text-muted-foreground">{fmtDate(s.mulai)}</p>}
              <ActionForm action={saveScheduleAction} submit={write ? "Simpan jadwal" : undefined} className="space-y-3">
                <input type="hidden" name="election_id" value={e.id} />
                <fieldset disabled={!write} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Mulai"><Input type="datetime-local" name="mulai" defaultValue={toLocalInput(s?.mulai)} /></Field>
                    <Field label="Selesai"><Input type="datetime-local" name="selesai" defaultValue={toLocalInput(s?.selesai)} /></Field>
                  </div>
                  <Field label="Lokasi"><Input name="lokasi" defaultValue={s?.lokasi ?? ""} placeholder="Contoh: Balai RW 09" /></Field>
                  <Field label="Penanggung jawab"><Input name="penanggung_jawab" defaultValue={s?.penanggung_jawab ?? ""} /></Field>
                  <Field label="Catatan"><Textarea name="catatan" defaultValue={s?.catatan ?? ""} /></Field>
                </fieldset>
              </ActionForm>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
