-- PHASE 4-15: operasi panitia. Semua fungsi SECURITY DEFINER dengan pemeriksaan role di dalamnya.

-- ===== RATE LIMIT & KEJADIAN KEAMANAN (hanya service_role) =====
create table rate_limits (
  key_hash text not null, window_start timestamptz not null, hits int not null default 0,
  primary key (key_hash, window_start)
);
alter table rate_limits enable row level security;

create function check_rate_limit(p_key text, p_max int, p_window interval) returns boolean
language plpgsql security definer set search_path = public, pg_temp as $$
declare w timestamptz := date_bin(p_window, now(), timestamptz '2000-01-01'); h int;
begin
  insert into rate_limits(key_hash, window_start, hits) values (p_key, w, 1)
  on conflict (key_hash, window_start) do update set hits = rate_limits.hits + 1
  returning hits into h;
  if h = p_max + 1 then   -- catat sekali per jendela waktu
    insert into audit_logs(action, entity, entity_id, after_data)
    values ('RATE_LIMIT_EXCEEDED', 'security', left(p_key, 12), jsonb_build_object('max', p_max, 'window', p_window::text));
  end if;
  if random() < 0.01 then delete from rate_limits where window_start < now() - interval '1 day'; end if;
  return h <= p_max;
end $$;

create function log_security_event(p_action text, p_actor uuid default null, p_detail jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into audit_logs(actor, action, entity, after_data) values (p_actor, p_action, 'security', p_detail)
$$;

-- ===== IMPORT PEMILIH BERTAHAP (staging -> konfirmasi -> commit) =====
create table import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid, filename text,
  status text not null default 'STAGED' check (status in ('STAGED','COMMITTED','DISCARDED')),
  total_rows int not null default 0, error_count int not null default 0,
  created_at timestamptz not null default now(), committed_at timestamptz
);
create table import_staging (
  batch_id uuid not null references import_batches(id) on delete cascade,
  row_no int not null, kk_hash text not null, kk_masked text not null,
  nama text not null, jenis_kelamin gender not null, hubungan household_role not null,
  alamat text not null default '', neighborhood_id uuid not null references neighborhoods(id),
  row_status text not null default 'NEW' check (row_status in ('NEW','EXISTS','CONFLICT')),
  primary key (batch_id, row_no)
);
alter table import_batches enable row level security;
alter table import_staging enable row level security;

-- p_rows: [{row_no, kk_hash, kk_masked, nama, jenis_kelamin, hubungan, alamat, rt}]; p_file_errors = jumlah baris ditolak di tahap berkas
create function stage_import(p_filename text, p_actor uuid, p_rows jsonb, p_file_errors int) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare bid uuid; c_new int; c_exists int; c_conf int; c_hh int;
begin
  insert into import_batches(created_by, filename, total_rows, error_count)
  values (p_actor, p_filename, jsonb_array_length(p_rows) + p_file_errors, p_file_errors) returning id into bid;

  insert into import_staging(batch_id, row_no, kk_hash, kk_masked, nama, jenis_kelamin, hubungan, alamat, neighborhood_id)
  select bid, (x->>'row_no')::int, x->>'kk_hash', x->>'kk_masked', trim(x->>'nama'),
         (x->>'jenis_kelamin')::gender, (x->>'hubungan')::household_role, coalesce(x->>'alamat',''), n.id
  from jsonb_array_elements(p_rows) x join neighborhoods n on n.code = x->>'rt';

  update import_staging s set row_status = 'CONFLICT'     -- KK sudah ada di RT yang berbeda
   where batch_id = bid and exists (select 1 from households h where h.kk_hash = s.kk_hash and h.neighborhood_id <> s.neighborhood_id);
  update import_staging s set row_status = 'EXISTS'       -- orang yang sama sudah terdaftar
   where batch_id = bid and row_status = 'NEW'
     and exists (select 1 from households h join voters v on v.household_id = h.id
                  where h.kk_hash = s.kk_hash and lower(trim(v.nama)) = lower(trim(s.nama)));

  select count(*) filter (where row_status='NEW'), count(*) filter (where row_status='EXISTS'), count(*) filter (where row_status='CONFLICT')
    into c_new, c_exists, c_conf from import_staging where batch_id = bid;
  select count(distinct kk_hash) into c_hh from import_staging s
   where batch_id = bid and row_status = 'NEW' and not exists (select 1 from households h where h.kk_hash = s.kk_hash);
  update import_batches set error_count = p_file_errors + c_conf where id = bid;
  return jsonb_build_object('batch_id', bid, 'new_voters', c_new, 'already_exists', c_exists, 'conflicts', c_conf,
                            'new_households', c_hh, 'file_errors', p_file_errors, 'total_rows', jsonb_array_length(p_rows) + p_file_errors);
end $$;

create function commit_import(p_batch uuid, p_actor uuid, p_allow_partial boolean default false) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare b import_batches%rowtype; hh int; vv int;
begin
  select * into b from import_batches where id = p_batch for update;
  if not found or b.status <> 'STAGED' then raise exception 'IMPORT_NOT_STAGED' using errcode = 'P0001'; end if;
  if b.error_count > 0 and not p_allow_partial then raise exception 'IMPORT_HAS_ERRORS' using errcode = 'P0001'; end if;

  insert into households(kk_hash, kk_masked, neighborhood_id)
  select distinct on (kk_hash) kk_hash, kk_masked, neighborhood_id from import_staging
   where batch_id = p_batch and row_status = 'NEW'
  on conflict (kk_hash) do nothing;
  get diagnostics hh = row_count;

  insert into voters(household_id, nama, jenis_kelamin, hubungan, alamat, neighborhood_id, has_voting_right)
  select h.id, s.nama, s.jenis_kelamin, s.hubungan, s.alamat, s.neighborhood_id, s.hubungan in ('SUAMI','ISTRI')
    from import_staging s join households h on h.kk_hash = s.kk_hash and h.neighborhood_id = s.neighborhood_id
   where s.batch_id = p_batch and s.row_status = 'NEW'
  on conflict (household_id, lower(trim(nama))) do nothing;
  get diagnostics vv = row_count;

  delete from import_staging where batch_id = p_batch;      -- data pribadi tidak dibiarkan menumpuk
  update import_batches set status = 'COMMITTED', committed_at = now() where id = p_batch;
  insert into audit_logs(actor, action, entity, entity_id, after_data)
  values (p_actor, 'IMPORT_VOTERS', 'import_batches', p_batch::text,
          jsonb_build_object('filename', b.filename, 'households_added', hh, 'voters_added', vv, 'partial', p_allow_partial));
  return jsonb_build_object('households_added', hh, 'voters_added', vv);
end $$;

create function discard_import(p_batch uuid, p_actor uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from import_staging where batch_id = p_batch;
  update import_batches set status = 'DISCARDED' where id = p_batch and status = 'STAGED';
  insert into audit_logs(actor, action, entity, entity_id) values (p_actor, 'IMPORT_DISCARDED', 'import_batches', p_batch::text);
end $$;

-- ===== KONTROL STATUS PEMILIHAN =====
create function set_election_status(p_election uuid, p_to election_status) returns election_status
language plpgsql security definer set search_path = public, pg_temp as $$
declare e elections%rowtype; ord text[] := array['DRAFT','TERJADWAL','PERSIAPAN','PEMILIHAN_BERLANGSUNG','PERHITUNGAN','SELESAI','DITETAPKAN'];
        i_from int; i_to int; ncand int; r jsonb;
begin
  if not has_role('SUPER_ADMIN','PANITIA') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into e from elections where id = p_election for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  i_from := array_position(ord, e.status::text); i_to := array_position(ord, p_to::text);
  if e.status = p_to then return e.status; end if;

  if e.method = 'MUSYAWARAH' then      -- musyawarah tidak memakai tahap pemungutan suara
    if p_to in ('PEMILIHAN_BERLANGSUNG','PERHITUNGAN') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    if p_to = 'SELESAI' and coalesce(e.config->'musyawarah', 'null'::jsonb) = 'null'::jsonb then
      raise exception 'PREREQUISITE_FAILED' using errcode = 'P0001', detail = 'Hasil musyawarah belum dicatat';
    end if;
    if p_to in ('SELESAI','DITETAPKAN') and e.status in ('DRAFT','TERJADWAL') then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  else
    -- maju hanya satu langkah; mundur hanya sebelum pemungutan dimulai
    if i_to > i_from + 1 then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
    if i_to < i_from and i_from > 3 then raise exception 'INVALID_TRANSITION' using errcode = 'P0001'; end if;
  end if;

  if p_to = 'PEMILIHAN_BERLANGSUNG' then
    if e.method is distinct from 'VOTING' or e.max_choices is null then
      raise exception 'PREREQUISITE_FAILED' using errcode = 'P0001', detail = 'Metode VOTING dan jumlah pilihan maksimal harus diatur';
    end if;
    select count(*) into ncand from candidates c
     where c.election_id = e.id and ((e.type = 'RT' and c.status = 'CALON_TETAP') or (e.type <> 'RT' and c.status in ('BAKAL_CALON','CALON_TETAP')));
    if ncand = 0 then raise exception 'PREREQUISITE_FAILED' using errcode = 'P0001', detail = 'Belum ada calon yang sah'; end if;
  end if;
  if p_to = 'SELESAI' and e.method = 'VOTING' then
    r := manual_reconciliation(e.id);
    if not (r->>'balanced')::boolean then raise exception 'RECONCILIATION_FAILED' using errcode = 'P0001'; end if;
  end if;

  update elections set status = p_to where id = e.id;
  return p_to;
end $$;

create function save_musyawarah(p_election uuid, p_data jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare e elections%rowtype;
begin
  if not has_role('SUPER_ADMIN','PANITIA') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into e from elections where id = p_election for update;
  if not found or e.method is distinct from 'MUSYAWARAH' then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  update elections set config = jsonb_set(config, '{musyawarah}', p_data, true) where id = e.id;
end $$;

create function add_candidate(p_election uuid, p_voter uuid, p_status candidate_status default 'BAKAL_CALON') returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare nomor int; cid uuid;
begin
  if not has_role('SUPER_ADMIN','PANITIA') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtext(p_election::text));
  select coalesce(max(nomor_urut), 0) + 1 into nomor from candidates where election_id = p_election;
  insert into candidates(election_id, voter_id, nomor_urut, status) values (p_election, p_voter, nomor, p_status) returning id into cid;
  return cid;
end $$;

-- ===== STATISTIK & DAFTAR =====
create function get_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare out jsonb; allrole boolean;
begin
  if current_app_role() is null then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  allrole := has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW','VIEWER');
  select jsonb_agg(row order by (row->>'rt')) into out from (
    select jsonb_build_object(
      'rt', n.code, 'neighborhood_id', n.id, 'election_id', e.id, 'status', e.status, 'method', e.method,
      'kk', (select count(*) from households h where h.neighborhood_id = n.id),
      'berhak_l', (select count(*) from voters v where v.neighborhood_id = n.id and v.has_voting_right and v.is_active and v.jenis_kelamin = 'L'),
      'berhak_p', (select count(*) from voters v where v.neighborhood_id = n.id and v.has_voting_right and v.is_active and v.jenis_kelamin = 'P'),
      'sudah_online', (select count(*) from vote_participation p join voters v on v.id = p.voter_id where p.election_id = e.id and p.channel = 'ONLINE'),
      'sudah_manual', (select count(*) from vote_participation p join voters v on v.id = p.voter_id where p.election_id = e.id and p.channel = 'MANUAL')
    ) as row
    from neighborhoods n join elections e on e.type = 'RT' and e.neighborhood_id = n.id
    where allrole or can_see_rt(n.id)
  ) q;
  return jsonb_build_object('rt', coalesce(out, '[]'::jsonb),
    'rw', (select jsonb_build_object('election_id', e.id, 'status', e.status,
             'sudah', (select count(*) from vote_participation p where p.election_id = e.id)) from elections e where e.type = 'RW_NOMINATION'));
end $$;

create function list_voters(p_rt uuid default null, p_status text default null, p_q text default null,
                            p_kk_hash text default null, p_limit int default 25, p_offset int default 0)
returns table (id uuid, nama text, jenis_kelamin gender, hubungan household_role, alamat text, rt text, kk_masked text,
               has_voting_right boolean, sudah_memilih boolean, channel vote_channel, total bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW','KOORDINATOR_RT','OPERATOR') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return query
  with base as (
    select v.id, v.nama, v.jenis_kelamin, v.hubungan, v.alamat, n.code as rt, h.kk_masked, v.has_voting_right,
           (p.id is not null) as sudah, p.channel
      from voters v join households h on h.id = v.household_id join neighborhoods n on n.id = v.neighborhood_id
      left join elections e on e.type = 'RT' and e.neighborhood_id = v.neighborhood_id
      left join vote_participation p on p.voter_id = v.id and p.election_id = e.id
     where can_see_rt(v.neighborhood_id)
       and (p_rt is null or v.neighborhood_id = p_rt)
       and (p_q is null or p_q = '' or v.nama ilike '%' || replace(replace(p_q, '%', ''), '_', '') || '%')
       and (p_kk_hash is null or h.kk_hash = p_kk_hash)
       and (p_status is null or (p_status = 'SUDAH' and p.id is not null) or (p_status = 'BELUM' and p.id is null and v.has_voting_right and v.is_active))
  )
  select b.id, b.nama, b.jenis_kelamin, b.hubungan, b.alamat, b.rt, b.kk_masked, b.has_voting_right, b.sudah, b.channel,
         count(*) over ()
    from base b order by b.rt, b.nama limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0);
end $$;

-- ===== OPSI SURAT SUARA (hanya untuk sesi pemilih yang valid) =====
create function get_ballot_options(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions, pg_temp as $$
declare s voting_sessions%rowtype; v voters%rowtype; rt_e elections%rowtype; rw_e elections%rowtype; rt_json jsonb; rw_json jsonb;
begin
  select * into s from voting_sessions where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if not found or s.used_at is not null or s.voter_id is null then raise exception 'SESSION_INVALID' using errcode = 'P0001'; end if;
  if s.expires_at < now() then raise exception 'SESSION_EXPIRED' using errcode = 'P0001'; end if;
  select * into v from voters where id = s.voter_id;
  select * into rt_e from elections where type = 'RT' and neighborhood_id = v.neighborhood_id;
  if rt_e.status <> 'PEMILIHAN_BERLANGSUNG' then raise exception 'ELECTION_NOT_OPEN' using errcode = 'P0001'; end if;

  select jsonb_build_object('election_id', rt_e.id, 'nama', rt_e.nama, 'max_choices', rt_e.max_choices,
    'candidates', coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nomor_urut', c.nomor_urut, 'nama', cv.nama,
       'jenis_kelamin', cv.jenis_kelamin, 'alamat', cv.alamat, 'rt', n.code) order by c.nomor_urut), '[]'::jsonb))
    into rt_json
    from candidates c join voters cv on cv.id = c.voter_id join neighborhoods n on n.id = cv.neighborhood_id
   where c.election_id = rt_e.id and c.status = 'CALON_TETAP';

  select * into rw_e from elections where type = 'RW_NOMINATION';
  if found and rw_e.status = 'PEMILIHAN_BERLANGSUNG' and rw_e.max_choices is not null
     and not exists (select 1 from vote_participation where voter_id = v.id and election_id = rw_e.id) then
    select jsonb_build_object('election_id', rw_e.id, 'nama', rw_e.nama, 'max_choices', rw_e.max_choices,
      'candidates', coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'nomor_urut', c.nomor_urut, 'nama', cv.nama,
         'jenis_kelamin', cv.jenis_kelamin, 'alamat', cv.alamat, 'rt', n.code) order by cv.nama, c.nomor_urut), '[]'::jsonb))
      into rw_json
      from candidates c join voters cv on cv.id = c.voter_id join neighborhoods n on n.id = cv.neighborhood_id
     where c.election_id = rw_e.id and c.status in ('BAKAL_CALON','CALON_TETAP');
    if jsonb_array_length(rw_json->'candidates') = 0 then rw_json := null; end if;
  end if;
  return jsonb_build_object('rt', rt_json, 'rw', rw_json);
end $$;

-- ===== REKAP RW: suara per RT asal pemilih/kertas suara =====
create function get_rw_matrix(p_election uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare out jsonb;
begin
  if not has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'candidate_id', c.id, 'nomor_urut', c.nomor_urut, 'nama', v.nama, 'jenis_kelamin', v.jenis_kelamin,
      'asal_rt', hn.code, 'alamat', v.alamat, 'status', c.status,
      'by_rt', (select coalesce(jsonb_object_agg(code, cnt), '{}'::jsonb) from (
                  select n.code, (select count(*) from votes x join ballots b on b.id = x.ballot_id
                                   where x.candidate_id = c.id and b.source_neighborhood_id = n.id)
                                + coalesce((select sum(m.votes) from manual_vote_entries m join manual_batches mb on mb.id = m.batch_id
                                   where m.candidate_id = c.id and mb.source_neighborhood_id = n.id), 0) as cnt
                    from neighborhoods n) q),
      'total', (select count(*) from votes x where x.candidate_id = c.id)
               + coalesce((select sum(m.votes) from manual_vote_entries m where m.candidate_id = c.id), 0)
    ) order by (select count(*) from votes x where x.candidate_id = c.id) + coalesce((select sum(m.votes) from manual_vote_entries m where m.candidate_id = c.id), 0) desc, c.nomor_urut), '[]'::jsonb)
  into out
  from candidates c join voters v on v.id = c.voter_id join neighborhoods hn on hn.id = v.neighborhood_id
  where c.election_id = p_election;
  return out;
end $$;

-- ===== BERITA ACARA =====
create function save_berita_acara(p_election uuid, p_meta jsonb, p_finalize boolean default false) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare e elections%rowtype; ba berita_acara%rowtype; snap jsonb; hak int; online_b int; man_b int; inv int; masuk int;
        fmt text; nomor text; rtcode text; sch election_schedules%rowtype; hasil jsonb; seq bigint;
begin
  if not has_role('SUPER_ADMIN','PANITIA') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into e from elections where id = p_election;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if e.status not in ('SELESAI','DITETAPKAN') then raise exception 'ELECTION_NOT_CLOSED' using errcode = 'P0001'; end if;
  select * into ba from berita_acara where election_id = p_election for update;
  if found and ba.locked_at is not null then raise exception 'DOCUMENT_LOCKED' using errcode = 'P0001'; end if;

  select code into rtcode from neighborhoods where id = e.neighborhood_id;
  select * into sch from election_schedules where election_id = e.id;
  select count(*) into hak from voters v where v.has_voting_right and v.is_active and (e.neighborhood_id is null or v.neighborhood_id = e.neighborhood_id);
  select count(*) into online_b from ballots where election_id = e.id;
  select coalesce(sum(ballot_count),0), coalesce(sum(invalid_count),0) into man_b, inv from manual_batches where election_id = e.id;
  masuk := online_b + man_b;
  select coalesce(jsonb_agg(jsonb_build_object('nomor_urut', r.nomor_urut, 'nama', r.nama, 'suara', r.total_votes) order by r.total_votes desc, r.nomor_urut), '[]'::jsonb)
    into hasil from (
      select c.nomor_urut, v.nama,
             (select count(*) from votes x where x.candidate_id = c.id) + coalesce((select sum(m.votes) from manual_vote_entries m where m.candidate_id = c.id), 0) as total_votes
        from candidates c join voters v on v.id = c.voter_id where c.election_id = e.id) r;

  snap := jsonb_build_object(
    'election', jsonb_build_object('nama', e.nama, 'type', e.type, 'rt', rtcode, 'method', e.method, 'status', e.status),
    'jadwal', jsonb_build_object('mulai', sch.mulai, 'selesai', sch.selesai, 'lokasi', sch.lokasi, 'penanggung_jawab', sch.penanggung_jawab),
    'counts', jsonb_build_object('hak_suara', hak, 'suara_masuk', masuk, 'online', online_b, 'manual', man_b,
              'suara_sah', masuk - inv, 'suara_tidak_sah', inv,
              'partisipasi_persen', case when hak = 0 then 0 else round(masuk::numeric * 100 / hak, 2) end),
    'hasil', hasil,
    'musyawarah', e.config->'musyawarah',
    'meta', coalesce(p_meta, '{}'::jsonb));

  seq := coalesce(ba.nomor_seq, nextval('berita_acara_seq'));
  select (value #>> '{}') into fmt from settings where key = 'doc.nomor_format';
  if found and fmt is not null then
    nomor := replace(replace(replace(replace(fmt, '{seq}', lpad(seq::text, 3, '0')),
               '{rt}', coalesce(replace(rtcode, ' ', ''), 'RW')), '{year}', to_char(now(), 'YYYY')), '{rw}', '09');
  end if;

  if ba.id is null then
    insert into berita_acara(election_id, nomor_seq, nomor_dokumen, snapshot, created_by, locked_at)
    values (e.id, seq, nomor, snap, auth.uid(), case when p_finalize then now() end) returning id into ba.id;
  else
    update berita_acara set snapshot = snap, nomor_dokumen = coalesce(nomor, nomor_dokumen),
           locked_at = case when p_finalize then now() end where id = ba.id;
  end if;
  return ba.id;
end $$;

-- ===== KODE UNDANGAN (faktor kedua opsional) =====
create function list_households_for_codes(p_rt uuid default null, p_only_missing boolean default true)
returns table (household_id uuid, rt text, kk_masked text, alamat text, anggota text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not has_role('SUPER_ADMIN','PANITIA') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  return query
    select h.id, n.code, h.kk_masked, max(v.alamat), string_agg(v.nama, ' & ' order by v.hubungan, v.nama)
      from households h join neighborhoods n on n.id = h.neighborhood_id
      join voters v on v.household_id = h.id and v.has_voting_right and v.is_active
     where (p_rt is null or h.neighborhood_id = p_rt) and (not p_only_missing or h.invite_hash is null)
     group by h.id, n.code, h.kk_masked order by n.code, max(v.alamat);
end $$;

create function set_invite_codes(p_items jsonb, p_actor uuid) returns int
language plpgsql security definer set search_path = public, pg_temp as $$
declare n int;
begin
  update households h set invite_hash = x.hash
    from jsonb_to_recordset(p_items) as x(household_id uuid, hash text) where h.id = x.household_id;
  get diagnostics n = row_count;
  insert into audit_logs(actor, action, entity, after_data) values (p_actor, 'INVITE_CODES_GENERATED', 'households', jsonb_build_object('count', n));
  return n;
end $$;

-- ===== PENGATURAN (hanya Super Admin; kunci dibatasi) =====
create function save_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not has_role('SUPER_ADMIN') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if p_key not in ('rule.second_factor','doc.nomor_format','rule.rw_selection_method','rule.tie_break','rule.invalid_vote_policy','rule.rw_top_n_from_rt') then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into settings(key, value, updated_by, updated_at) values (p_key, coalesce(p_value, 'null'::jsonb), auth.uid(), now())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
end $$;

-- ===== HAK AKSES =====
revoke all on function check_rate_limit(text,int,interval), log_security_event(text,uuid,jsonb), stage_import(text,uuid,jsonb,int),
  commit_import(uuid,uuid,boolean), discard_import(uuid,uuid), get_ballot_options(text), set_invite_codes(jsonb,uuid) from public, anon, authenticated;
grant execute on function check_rate_limit(text,int,interval), log_security_event(text,uuid,jsonb), stage_import(text,uuid,jsonb,int),
  commit_import(uuid,uuid,boolean), discard_import(uuid,uuid), get_ballot_options(text), set_invite_codes(jsonb,uuid) to service_role;

revoke all on function set_election_status(uuid, election_status), save_musyawarah(uuid, jsonb), add_candidate(uuid, uuid, candidate_status),
  get_dashboard_stats(), list_voters(uuid,text,text,text,int,int), get_rw_matrix(uuid), save_berita_acara(uuid, jsonb, boolean),
  list_households_for_codes(uuid, boolean), mask_name(text), save_setting(text, jsonb) from public, anon, authenticated;
grant execute on function set_election_status(uuid, election_status), save_musyawarah(uuid, jsonb), add_candidate(uuid, uuid, candidate_status),
  get_dashboard_stats(), list_voters(uuid,text,text,text,int,int), get_rw_matrix(uuid), save_berita_acara(uuid, jsonb, boolean),
  list_households_for_codes(uuid, boolean), save_setting(text, jsonb) to authenticated;
grant execute on function mask_name(text) to service_role;
grant all on all tables in schema public to service_role;

-- Objek baru di Supabase otomatis dibuka ke anon/authenticated: tutup eksplisit (pertahanan berlapis di atas RLS).
revoke all on table rate_limits, import_batches, import_staging from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;   -- tidak ada kolom serial yang diisi langsung oleh klien
