-- PHASE 2: RLS, hak akses, data referensi (non-personal)

do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;
revoke all on all functions in schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;

-- Fungsi sensitif: hanya server (service_role)
grant execute on function start_voting_session(text, uuid, interval, text), select_voter(text, uuid), cast_ballots(text, jsonb) to service_role;
-- Fungsi staf (memeriksa role sendiri)
grant execute on function record_manual_participation(uuid, uuid), enter_manual_tally(uuid, text, int, int, jsonb, uuid),
  manual_reconciliation(uuid), get_election_results(uuid) to authenticated;
grant execute on function get_public_results(uuid) to anon, authenticated;
-- Helper dipakai di policy
grant execute on function current_app_role(), current_app_rt(), has_role(variadic app_role[]), can_see_rt(uuid) to anon, authenticated;
grant all on all tables in schema public to service_role;

-- neighborhoods: publik
grant select on neighborhoods to anon, authenticated;
create policy nb_read on neighborhoods for select using (true);

-- voters: kolom terbatas. Nomor KK asli tidak ada di database; hash KK tidak dapat dibaca klien.
grant select (id, household_id, nama, jenis_kelamin, hubungan, alamat, neighborhood_id, is_active, has_voting_right, no_urut, created_at)
  on voters to authenticated;
create policy voters_read on voters for select to authenticated using (can_see_rt(neighborhood_id));

grant select (id, kk_masked, neighborhood_id) on households to authenticated;
create policy hh_read on households for select to authenticated using (can_see_rt(neighborhood_id));

-- profiles
grant select, insert, update, delete on profiles to authenticated;
create policy prof_self on profiles for select to authenticated using (id = auth.uid() or has_role('SUPER_ADMIN'));
create policy prof_admin_w on profiles for all to authenticated using (has_role('SUPER_ADMIN')) with check (has_role('SUPER_ADMIN'));

-- elections & jadwal
grant select on elections, election_schedules to anon;
grant select, insert, delete on elections to authenticated;
-- status HANYA lewat set_election_status() (memeriksa prasyarat & alur); kolom lain boleh diedit panitia
grant update (nama, method, max_choices, config) on elections to authenticated;
grant select, insert, update, delete on election_schedules, candidates, candidate_profiles to authenticated;
create policy el_public on elections for select to anon, authenticated using (status <> 'DRAFT');
create policy el_staff on elections for select to authenticated using (
  has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW','VIEWER') or can_see_rt(neighborhood_id));
create policy el_write on elections for all to authenticated using (has_role('SUPER_ADMIN','PANITIA')) with check (has_role('SUPER_ADMIN','PANITIA'));
create policy sch_public on election_schedules for select to anon, authenticated
  using (exists (select 1 from elections e where e.id = election_id and e.status <> 'DRAFT'));
create policy sch_staff on election_schedules for select to authenticated using (has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW','KOORDINATOR_RT','OPERATOR'));
create policy sch_write on election_schedules for all to authenticated using (has_role('SUPER_ADMIN','PANITIA')) with check (has_role('SUPER_ADMIN','PANITIA'));

-- calon: staf saja (warga melihat calon lewat server)
create policy cand_read on candidates for select to authenticated using (
  has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW') or
  exists (select 1 from elections e where e.id = election_id and can_see_rt(e.neighborhood_id)));
create policy cand_write on candidates for all to authenticated using (has_role('SUPER_ADMIN','PANITIA')) with check (has_role('SUPER_ADMIN','PANITIA'));
create policy candp_read on candidate_profiles for select to authenticated using (has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW','KOORDINATOR_RT','OPERATOR'));
create policy candp_write on candidate_profiles for all to authenticated using (has_role('SUPER_ADMIN','PANITIA')) with check (has_role('SUPER_ADMIN','PANITIA'));

-- partisipasi (siapa sudah memilih, bukan pilihannya)
grant select (id, voter_id, election_id, channel, created_at) on vote_participation to authenticated;
create policy part_read on vote_participation for select to authenticated
  using (can_see_rt((select v.neighborhood_id from voters v where v.id = voter_id)));

-- voting_sessions, ballots, votes, manual_*: TIDAK ada policy & grant ke klien (hanya fungsi)

-- dokumen, koreksi, pengumuman, pengaturan, audit
grant select, insert, update on berita_acara to authenticated;
create policy ba_read on berita_acara for select to authenticated using (has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW'));
create policy ba_write on berita_acara for insert to authenticated with check (has_role('SUPER_ADMIN','PANITIA'));
create policy ba_upd on berita_acara for update to authenticated using (has_role('SUPER_ADMIN','PANITIA') and locked_at is null);

grant select, insert, update on correction_requests to authenticated;
create policy cr_read on correction_requests for select to authenticated using (has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW') or requested_by = auth.uid());
create policy cr_ins on correction_requests for insert to authenticated with check (has_role('SUPER_ADMIN','PANITIA','OPERATOR') and requested_by = auth.uid());
create policy cr_upd on correction_requests for update to authenticated using (has_role('SUPER_ADMIN','PANITIA')) with check (has_role('SUPER_ADMIN','PANITIA'));

grant select on announcements to anon;
grant select, insert, update, delete on announcements, settings to authenticated;
create policy ann_pub on announcements for select to anon, authenticated using (is_published);
create policy ann_staff on announcements for select to authenticated using (has_role('SUPER_ADMIN','PANITIA'));
create policy ann_write on announcements for all to authenticated using (has_role('SUPER_ADMIN','PANITIA')) with check (has_role('SUPER_ADMIN','PANITIA'));
create policy set_read on settings for select to authenticated using (has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW','OPERATOR'));
create policy set_write on settings for all to authenticated using (has_role('SUPER_ADMIN')) with check (has_role('SUPER_ADMIN'));

grant select on audit_logs to authenticated;
create policy audit_read on audit_logs for select to authenticated using (has_role('SUPER_ADMIN','PANITIA'));

-- ===== DATA REFERENSI (bukan data pribadi) =====
insert into neighborhoods(code) values ('RT 01'),('RT 02'),('RT 03'),('RT 04'),('RT 05'),('RT 06');
insert into elections(type, neighborhood_id, nama)
  select 'RT', id, 'Pemilihan Pengurus ' || code || ' RW 09' from neighborhoods;
insert into elections(type, nama) values ('RW_NOMINATION', 'Penjaringan Bakal Calon Pengurus RW 09');
-- RW_FINAL dibuat panitia setelah metode RW ditetapkan.

-- Aturan yang BELUM ditetapkan: sengaja null, tidak ada default tersembunyi.
insert into settings(key, value) values
  ('rule.rw_selection_method','null'),('rule.tie_break','null'),('rule.rw_top_n_from_rt','null'),
  ('rule.invalid_vote_policy','null'),('rule.second_factor','null'),('doc.nomor_format','null');
