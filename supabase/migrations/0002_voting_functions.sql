-- PHASE 2: fungsi voting atomik. Semua SECURITY DEFINER; EXECUTE hanya untuk service_role
-- (server Next.js), kecuali fungsi staf yang memeriksa role sendiri.
-- Alur pemilih: start_voting_session (NKK) -> select_voter (pilih nama) -> cast_ballots (kirim suara).

-- Menyamarkan nama: kata pertama tampil 3 huruf, kata berikutnya 1 huruf. 'Ahmad Fauzi' -> 'Ahm** F****'
create function mask_name(p_nama text) returns text language sql immutable as $$
  select string_agg(
    left(w, case when i = 1 then least(3, greatest(length(w) - 1, 1)) else 1 end)
      || repeat('*', greatest(length(w) - case when i = 1 then least(3, greatest(length(w) - 1, 1)) else 1 end, 0)),
    ' ' order by i)
  from regexp_split_to_table(trim(p_nama), '\s+') with ordinality as t(w, i)
$$;

-- LANGKAH 1: pemilih memasukkan Nomor KK. Server mengirim hash KK.
-- Satu KK dapat memiliki beberapa pemilih (mis. suami dan istri), sehingga hasilnya adalah DAFTAR anggota
-- yang berhak, dengan nama tersamar. Pemilih memilih namanya di langkah 2.
create function start_voting_session(p_kk_hash text, p_neighborhood_id uuid, p_ttl interval default interval '10 minutes', p_invite_hash text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare e elections%rowtype; h households%rowtype; tok text; exp timestamptz; members jsonb;
begin
  select * into e from elections where type = 'RT' and neighborhood_id = p_neighborhood_id;
  if not found or e.status <> 'PEMILIHAN_BERLANGSUNG' or e.method is distinct from 'VOTING' then
    raise exception 'ELECTION_NOT_OPEN' using errcode = 'P0001';
  end if;
  -- KK tidak ditemukan dan KK dari RT lain sengaja memberi pesan SAMA (mencegah enumerasi KK)
  select * into h from households where kk_hash = p_kk_hash and neighborhood_id = p_neighborhood_id for update;
  if not found then raise exception 'VOTER_NOT_FOUND' using errcode = 'P0001'; end if;
  -- Faktor kedua (jika diaktifkan panitia): kode salah/kosong memberi pesan SAMA dengan KK tidak ditemukan
  if (select value from settings where key = 'rule.second_factor') = '"INVITE_CODE"'::jsonb
     and (h.invite_hash is null or p_invite_hash is distinct from h.invite_hash) then
    raise exception 'VOTER_NOT_FOUND' using errcode = 'P0001';
  end if;

  select jsonb_agg(jsonb_build_object(
           'id', v.id, 'nama_masked', mask_name(v.nama), 'jenis_kelamin', v.jenis_kelamin,
           'sudah_memilih', exists (select 1 from vote_participation p where p.voter_id = v.id and p.election_id = e.id))
         order by v.hubungan, v.nama)
    into members
    from voters v where v.household_id = h.id and v.is_active and v.has_voting_right;
  if members is null then raise exception 'NO_VOTING_RIGHT' using errcode = 'P0001'; end if;
  if not exists (select 1 from jsonb_array_elements(members) m where (m->>'sudah_memilih')::boolean = false) then
    raise exception 'ALREADY_VOTED' using errcode = 'P0001';
  end if;

  delete from voting_sessions where household_id = h.id and used_at is null;
  tok := encode(gen_random_bytes(32), 'hex');
  exp := now() + p_ttl;
  insert into voting_sessions(household_id, token_hash, expires_at)
  values (h.id, encode(digest(tok, 'sha256'), 'hex'), exp);
  return jsonb_build_object('token', tok, 'expires_at', exp, 'members', members);
end $$;

-- LANGKAH 2: pemilih memilih namanya di dalam KK. Mengembalikan identitas terbatas untuk dikonfirmasi.
create function select_voter(p_token text, p_voter_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s voting_sessions%rowtype; v voters%rowtype; nb neighborhoods%rowtype; e elections%rowtype;
begin
  select * into s from voting_sessions where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'SESSION_INVALID' using errcode = 'P0001'; end if;
  select * into v from voters where id = p_voter_id and household_id = s.household_id for update;  -- 1) pemilih
  if not found then raise exception 'VOTER_NOT_FOUND' using errcode = 'P0001'; end if;
  select * into s from voting_sessions where id = s.id for update;                                  -- 2) sesi
  if not found or s.used_at is not null then raise exception 'SESSION_INVALID' using errcode = 'P0001'; end if;
  if s.expires_at < now() then raise exception 'SESSION_EXPIRED' using errcode = 'P0001'; end if;
  if not v.is_active or not v.has_voting_right then raise exception 'NO_VOTING_RIGHT' using errcode = 'P0001'; end if;
  select * into e from elections where type = 'RT' and neighborhood_id = v.neighborhood_id;
  if exists (select 1 from vote_participation where voter_id = v.id and election_id = e.id) then
    raise exception 'ALREADY_VOTED' using errcode = 'P0001';
  end if;
  update voting_sessions set voter_id = v.id where id = s.id;
  select * into nb from neighborhoods where id = v.neighborhood_id;
  return jsonb_build_object('nama', v.nama, 'jenis_kelamin', v.jenis_kelamin, 'alamat', v.alamat, 'rt', nb.code);
end $$;

-- LANGKAH 3: kirim suara. Semua surat suara (RT + RW) dalam SATU transaksi: gagal satu = gagal semua.
-- p_ballots: [{"election_id": "...", "candidate_ids": ["...", ...]}, ...]
create function cast_ballots(p_token text, p_ballots jsonb)
returns text language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s voting_sessions%rowtype; v voters%rowtype; e elections%rowtype; b jsonb;
        ids uuid[]; n int; bid uuid; receipt text; seen uuid[] := '{}';
begin
  select * into s from voting_sessions where token_hash = encode(digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'SESSION_INVALID' using errcode = 'P0001'; end if;
  if s.voter_id is null then raise exception 'VOTER_NOT_SELECTED' using errcode = 'P0001'; end if;
  select * into v from voters where id = s.voter_id for update;      -- 1) kunci pemilih (serialisasi)
  select * into s from voting_sessions where id = s.id for update;   -- 2) lalu sesi; baca ulang setelah terkunci
  if not found or s.used_at is not null or s.voter_id is distinct from v.id then
    raise exception 'SESSION_INVALID' using errcode = 'P0001';
  end if;
  if s.expires_at < now() then raise exception 'SESSION_EXPIRED' using errcode = 'P0001'; end if;
  if not v.is_active or not v.has_voting_right then raise exception 'NO_VOTING_RIGHT' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_ballots) is distinct from 'array' or jsonb_array_length(p_ballots) = 0 then
    raise exception 'BALLOT_EMPTY' using errcode = 'P0001';
  end if;

  receipt := 'VOTE-' || upper(encode(gen_random_bytes(2), 'hex')) || '-' || upper(encode(gen_random_bytes(2), 'hex'));

  for b in select * from jsonb_array_elements(p_ballots) loop
    select * into e from elections where id = (b->>'election_id')::uuid for share;
    if not found then raise exception 'ELECTION_NOT_FOUND' using errcode = 'P0001'; end if;
    if e.id = any(seen) then raise exception 'BALLOT_DUPLICATE' using errcode = 'P0001'; end if;
    seen := seen || e.id;
    if e.status <> 'PEMILIHAN_BERLANGSUNG' then raise exception 'ELECTION_NOT_OPEN' using errcode = 'P0001'; end if;
    if e.type = 'RT' and e.neighborhood_id <> v.neighborhood_id then raise exception 'WRONG_RT' using errcode = 'P0001'; end if;
    if e.max_choices is null then raise exception 'RULE_NOT_CONFIGURED' using errcode = 'P0001'; end if;

    select array_agg(distinct x::uuid) into ids from jsonb_array_elements_text(b->'candidate_ids') x;
    n := coalesce(cardinality(ids), 0);
    if n = 0 then raise exception 'CHOICE_EMPTY' using errcode = 'P0001'; end if;
    if n > e.max_choices then raise exception 'CHOICE_TOO_MANY' using errcode = 'P0001'; end if;
    if (select count(*) from candidates c
         where c.id = any(ids) and c.election_id = e.id
           and ((e.type = 'RT' and c.status = 'CALON_TETAP')
             or (e.type <> 'RT' and c.status in ('BAKAL_CALON','CALON_TETAP')))) <> n then
      raise exception 'CANDIDATE_INVALID' using errcode = 'P0001';
    end if;

    begin
      insert into vote_participation(voter_id, election_id, channel, receipt_code)
      values (v.id, e.id, 'ONLINE', receipt);
    exception when unique_violation then
      raise exception 'ALREADY_VOTED' using errcode = 'P0001';
    end;
    insert into ballots(election_id, channel, source_neighborhood_id)
    values (e.id, 'ONLINE', v.neighborhood_id) returning id into bid;
    insert into votes(ballot_id, election_id, candidate_id) select bid, e.id, unnest(ids);
  end loop;

  update voting_sessions set used_at = now() where id = s.id;
  return receipt;
end $$;

-- ===== SUARA MANUAL (dipanggil staf login; role diperiksa di dalam) =====
create function record_manual_participation(p_voter_id uuid, p_election_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare e elections%rowtype; v voters%rowtype;
begin
  if not has_role('SUPER_ADMIN','PANITIA','OPERATOR') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into e from elections where id = p_election_id;
  select * into v from voters where id = p_voter_id;
  if e.id is null or v.id is null then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if not can_see_rt(v.neighborhood_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if e.status <> 'PEMILIHAN_BERLANGSUNG' then raise exception 'ELECTION_NOT_OPEN' using errcode = 'P0001'; end if;
  if e.type = 'RT' and e.neighborhood_id <> v.neighborhood_id then raise exception 'WRONG_RT' using errcode = 'P0001'; end if;
  if not v.is_active or not v.has_voting_right then raise exception 'NO_VOTING_RIGHT' using errcode = 'P0001'; end if;
  begin
    insert into vote_participation(voter_id, election_id, channel, recorded_by)
    values (v.id, e.id, 'MANUAL', auth.uid());
  exception when unique_violation then raise exception 'ALREADY_VOTED' using errcode = 'P0001';
  end;
  insert into audit_logs(actor, action, entity, entity_id, after_data)
  values (auth.uid(), 'MANUAL_PARTICIPATION', 'vote_participation', e.id::text, jsonb_build_object('election_id', e.id));
end $$;

-- p_entries: [{"candidate_id": "...", "votes": 12}, ...]
create function enter_manual_tally(p_election_id uuid, p_label text, p_ballot_count int, p_invalid int, p_entries jsonb, p_source_rt uuid default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare e elections%rowtype; bid uuid; it jsonb; total int := 0; src uuid;
begin
  if not has_role('SUPER_ADMIN','PANITIA','OPERATOR') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into e from elections where id = p_election_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if e.type = 'RT' and not can_see_rt(e.neighborhood_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  if e.status not in ('PEMILIHAN_BERLANGSUNG','PERHITUNGAN') then raise exception 'ELECTION_NOT_OPEN' using errcode = 'P0001'; end if;
  for it in select * from jsonb_array_elements(p_entries) loop
    total := total + (it->>'votes')::int;
  end loop;
  if total + p_invalid < p_ballot_count then raise exception 'TALLY_MISMATCH' using errcode = 'P0001'; end if;
  src := case when e.type = 'RT' then e.neighborhood_id else p_source_rt end;
  if src is null then raise exception 'SOURCE_RT_REQUIRED' using errcode = 'P0001'; end if;
  if not can_see_rt(src) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  insert into manual_batches(election_id, label, source_neighborhood_id, ballot_count, invalid_count, entered_by)
  values (e.id, p_label, src, p_ballot_count, p_invalid, auth.uid()) returning id into bid;
  for it in select * from jsonb_array_elements(p_entries) loop
    insert into manual_vote_entries(batch_id, election_id, candidate_id, votes)
    values (bid, e.id, (it->>'candidate_id')::uuid, (it->>'votes')::int);
  end loop;
  return bid;
end $$;

-- Rekonsiliasi: jumlah warga yang ditandai memilih manual harus sama dengan jumlah kertas suara manual.
create function manual_reconciliation(p_election_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare p int; c int; e elections%rowtype;
begin
  if not has_role('SUPER_ADMIN','PANITIA','OPERATOR','KOORDINATOR_RW') then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select * into e from elections where id = p_election_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  if e.type = 'RT' and not can_see_rt(e.neighborhood_id) then raise exception 'FORBIDDEN' using errcode = 'P0001'; end if;
  select count(*) into p from vote_participation where election_id = p_election_id and channel = 'MANUAL';
  select coalesce(sum(ballot_count), 0) into c from manual_batches where election_id = p_election_id;
  return jsonb_build_object('manual_participants', p, 'manual_ballots_counted', c, 'difference', p - c, 'balanced', p = c);
end $$;

-- ===== HASIL =====
create function get_election_results(p_election_id uuid)
returns table (candidate_id uuid, nomor_urut int, nama text, online_votes bigint, manual_votes bigint, total_votes bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare e elections%rowtype;
begin
  select * into e from elections where id = p_election_id;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0001'; end if;
  -- RT: staf yang berwenang pada RT itu saja. RW: hanya panitia/koordinator RW.
  if e.type = 'RT' then
    if not has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW','KOORDINATOR_RT') or not can_see_rt(e.neighborhood_id) then
      raise exception 'FORBIDDEN' using errcode = 'P0001';
    end if;
  elsif not has_role('SUPER_ADMIN','PANITIA','KOORDINATOR_RW') then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return query
    select c.id, c.nomor_urut, v.nama,
      (select count(*) from votes x where x.candidate_id = c.id),
      coalesce((select sum(m.votes) from manual_vote_entries m where m.candidate_id = c.id), 0)::bigint,
      (select count(*) from votes x where x.candidate_id = c.id)
        + coalesce((select sum(m.votes) from manual_vote_entries m where m.candidate_id = c.id), 0)::bigint
    from candidates c join voters v on v.id = c.voter_id
    where c.election_id = p_election_id
    order by 6 desc, c.nomor_urut;   -- urutan seri hanya tampilan; BUKAN penentuan pemenang
end $$;

create function get_public_results(p_election_id uuid)
returns table (nomor_urut int, nama text, total_votes bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from elections where id = p_election_id and status in ('SELESAI','DITETAPKAN')) then
    raise exception 'RESULT_NOT_PUBLISHED' using errcode = 'P0001';
  end if;
  return query
    select c.nomor_urut, v.nama,
      (select count(*) from votes x where x.candidate_id = c.id)
        + coalesce((select sum(m.votes) from manual_vote_entries m where m.candidate_id = c.id), 0)::bigint
    from candidates c join voters v on v.id = c.voter_id
    where c.election_id = p_election_id order by 3 desc, c.nomor_urut;
end $$;
