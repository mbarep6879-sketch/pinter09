\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ===== A. INTEGRITAS VOTING (alur: NKK -> pilih nama -> kirim) =====
do $t$
declare s jsonb; tok text; tok2 text; rc text; n int; rt3 uuid := (select id from neighborhoods where code='RT 03');
begin
  set local role service_role;
  -- A1: langkah 1 - NKK menghasilkan DAFTAR anggota berhak dengan nama tersamar
  s := start_voting_session('kk_AB', rt3);
  tok := s->>'token';
  perform t.ok(jsonb_array_length(s->'members') = 2, 'A1 hanya suami & istri yang berhak (anak tidak ikut terdaftar)');
  perform t.ok(s::text like '%Ahm** F****%' and s::text not like '%Ahmad Fauzi%' and s::text not like '%Zahra%', 'A1b nama anggota tersamar, nama lengkap tidak bocor');
  perform t.ok(not (s::text ~ '\d{16}') and s::text not like '%kk_AB%', 'A1c respons tidak memuat nomor KK / hash');
  perform t.err(format('select cast_ballots(%L, ''[]''::jsonb)', tok), 'VOTER_NOT_SELECTED', 'A1d tidak bisa memilih sebelum memilih nama');
  perform t.err(format('select select_voter(%L, %L)', tok, t.id('vC')), 'VOTER_NOT_FOUND', 'A1e tidak bisa memilih nama dari KK lain');
  perform t.err(format('select select_voter(%L, %L)', tok, t.id('vZ')), 'NO_VOTING_RIGHT', 'A1f anggota tanpa hak suara ditolak');
  -- langkah 2: identitas lengkap hanya muncul setelah memilih nama
  s := select_voter(tok, t.id('vA'));
  perform t.ok(s->>'nama' = 'Ahmad Fauzi' and s->>'rt' = 'RT 03', 'A1g identitas terbatas ditampilkan setelah memilih nama');
  rc := cast_ballots(tok, jsonb_build_array(
        jsonb_build_object('election_id', t.id('eRT3'), 'candidate_ids', jsonb_build_array(t.id('cC'), t.id('cE'))),
        jsonb_build_object('election_id', t.id('eRW'),  'candidate_ids', jsonb_build_array(t.id('rwA')))));
  perform t.ok(rc ~ '^VOTE-[0-9A-F]{4}-[0-9A-F]{4}$', 'A2 kode bukti partisipasi berformat benar');
  perform t.err(format('select cast_ballots(%L, ''[]''::jsonb)', tok), 'SESSION_INVALID', 'A3 token tidak bisa dipakai ulang');

  -- A4: pasangan dalam KK sama masih bisa memilih; yang sudah memilih tidak bisa lagi
  s := start_voting_session('kk_AB', rt3); tok2 := s->>'token';
  perform t.ok((select count(*) from jsonb_array_elements(s->'members') m where (m->>'sudah_memilih')::boolean) = 1, 'A4 daftar menandai anggota yang sudah memilih');
  perform t.err(format('select select_voter(%L, %L)', tok2, t.id('vA')), 'ALREADY_VOTED', 'A4b suami tidak bisa memilih dua kali lewat KK yang sama');

  -- A5: KK tak terdaftar dan KK dari RT lain -> pesan SAMA
  perform t.err(format('select start_voting_session(%L, %L)', 'kk_ZZZ', rt3), 'VOTER_NOT_FOUND', 'A5 KK tidak terdaftar');
  perform t.err(format('select start_voting_session(%L, %L)', 'kk_X', rt3), 'VOTER_NOT_FOUND', 'A5b KK dari RT lain');

  -- A6-A11: validasi pilihan (istri memilih)
  perform select_voter(tok2, t.id('vB')); tok := tok2;
  perform t.err(format('select cast_ballots(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('election_id', t.id('eRT3'), 'candidate_ids', jsonb_build_array()))), 'CHOICE_EMPTY', 'A6 pilihan kosong ditolak');
  perform t.err(format('select cast_ballots(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('election_id', t.id('eRT3'), 'candidate_ids', jsonb_build_array(t.id('cC'), t.id('cD'), t.id('cE'))))), 'CHOICE_TOO_MANY', 'A7 melebihi max_choices ditolak');
  perform t.err(format('select cast_ballots(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('election_id', t.id('eRT3'), 'candidate_ids', jsonb_build_array(t.id('rwX'))))), 'CANDIDATE_INVALID', 'A8 calon dari pemilihan lain ditolak');
  perform t.err(format('select cast_ballots(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('election_id', t.id('eRT4'), 'candidate_ids', jsonb_build_array(t.id('rwX'))))), 'WRONG_RT', 'A9 surat suara RT lain ditolak');
  perform t.err(format('select cast_ballots(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('election_id', t.id('eRT5'), 'candidate_ids', jsonb_build_array(t.id('rwX'))))), 'ELECTION_NOT_OPEN', 'A10 pemilihan belum dibuka ditolak');
  select count(*) into n from vote_participation where voter_id = t.id('vB');
  perform t.ok(n = 0, 'A11 percobaan gagal tidak mencatat partisipasi (atomik)');

  -- A12: nama kembar tetap terpisah lewat candidate_id
  rc := cast_ballots(tok, jsonb_build_array(
        jsonb_build_object('election_id', t.id('eRT3'), 'candidate_ids', jsonb_build_array(t.id('cD'))),
        jsonb_build_object('election_id', t.id('eRW'),  'candidate_ids', jsonb_build_array(t.id('rwX')))));
  perform t.ok((select count(*) from votes where candidate_id = t.id('cC')) = 1
           and (select count(*) from votes where candidate_id = t.id('cD')) = 1, 'A12 dua calon bernama sama dihitung terpisah');
  perform t.err(format('select start_voting_session(%L, %L)', 'kk_AB', rt3), 'ALREADY_VOTED', 'A12b setelah suami & istri memilih, KK tidak bisa dipakai lagi');

  -- A13: aturan belum dikonfigurasi -> tidak mengarang
  s := start_voting_session('kk_X', (select id from neighborhoods where code='RT 04')); tok := s->>'token';
  perform select_voter(tok, t.id('vX'));
  perform t.err(format('select cast_ballots(%L, %L::jsonb)', tok, jsonb_build_array(jsonb_build_object('election_id', t.id('eRT4'), 'candidate_ids', jsonb_build_array((select id from candidates where election_id=t.id('eRT4')))))), 'RULE_NOT_CONFIGURED', 'A13 max_choices kosong -> voting ditolak');

  -- A14: sesi kedaluwarsa
  s := start_voting_session('kk_F', rt3, interval '-1 minute'); tok := s->>'token';
  perform t.err(format('select select_voter(%L, %L)', tok, t.id('vF')), 'SESSION_EXPIRED', 'A14 sesi kedaluwarsa ditolak');
  reset role;
end $t$;

-- ===== B. PRIVASI & IMMUTABILITY =====
do $t$
begin
  perform t.ok(not exists (select 1 from information_schema.columns where table_name in ('ballots','votes') and column_name in ('voter_id','household_id','created_at')), 'B1 ballots/votes tanpa voter_id & timestamp');
  perform t.ok(not exists (select 1 from information_schema.columns where table_schema='public' and column_name ilike '%nik%'), 'B9 tidak ada kolom NIK di database');
  perform t.err('update ballots set channel = ''MANUAL''', 'IMMUTABLE_RECORD', 'B2 surat suara tidak bisa diubah');
  perform t.err('delete from votes', 'IMMUTABLE_RECORD', 'B3 suara tidak bisa dihapus');
  perform t.err('delete from vote_participation', 'IMMUTABLE_RECORD', 'B4 partisipasi tidak bisa dihapus');
  perform t.err('update audit_logs set action = ''x''', 'IMMUTABLE_RECORD', 'B5 audit log tidak bisa diubah');
  perform t.err('truncate audit_logs', 'IMMUTABLE_RECORD', 'B6 audit log tidak bisa dikosongkan');
  perform t.err('truncate votes', 'IMMUTABLE_RECORD', 'B7 votes tidak bisa dikosongkan');
  perform t.err('insert into vote_participation(voter_id, election_id, channel) values (t.id(''vA''), t.id(''eRT3''), ''MANUAL'')', 'duplicate key', 'B8 UNIQUE(voter, election) di level DB');
  perform t.err('insert into voters(household_id, nama, jenis_kelamin, neighborhood_id) select household_id, upper(nama), jenis_kelamin, neighborhood_id from voters where id = t.id(''vA'')', 'duplicate key', 'B10 nama ganda dalam satu KK ditolak');
end $t$;

-- ===== C. RLS & ROLE =====
do $t$
declare n bigint;
begin
  -- anon
  set local role anon;
  perform t.err('select count(*) from voters', 'permission denied', 'C1 anon tidak bisa baca voters');
  perform t.err('select count(*) from votes', 'permission denied', 'C2 anon tidak bisa baca votes');
  perform t.err('select count(*) from vote_participation', 'permission denied', 'C3 anon tidak bisa baca partisipasi');
  execute 'select count(*) from elections' into n;
  perform t.ok(n = 3, 'C4b anon melihat tepat 3 pemilihan non-draft');
  perform t.err('select * from get_public_results(t.id(''eRT3''))', 'RESULT_NOT_PUBLISHED', 'C5 hasil belum diumumkan tidak bisa dilihat publik');
  perform t.err('select start_voting_session(''kk_F'', t.id(''eRT3''))', 'permission denied', 'C5b anon tidak bisa memanggil start_voting_session');
  perform t.err('select cast_ballots(''x'', ''[]''::jsonb)', 'permission denied', 'C5c anon tidak bisa memanggil cast_ballots');
  perform t.err('select select_voter(''x'', t.id(''vF''))', 'permission denied', 'C5f anon tidak bisa memanggil select_voter');
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  perform t.err('select cast_ballots(''x'', ''[]''::jsonb)', 'permission denied', 'C5d staf login tidak bisa memanggil cast_ballots');
  perform t.err('select start_voting_session(''kk_F'', t.id(''eRT3''))', 'permission denied', 'C5e staf login tidak bisa memanggil start_voting_session');
  reset role;

  -- staf
  perform set_config('request.jwt.claim.sub', t.id('viewer')::text, true);
  set local role authenticated;
  perform t.err('select kk_hash from households', 'permission denied', 'C6 klien tidak bisa membaca hash KK');
  perform t.err('select count(*) from votes', 'permission denied', 'C7 staf tidak bisa membaca votes');
  perform t.err('select count(*) from ballots', 'permission denied', 'C7b staf tidak bisa membaca ballots');
  execute 'select count(*) from voters' into n; perform t.ok(n = 0, 'C8 VIEWER tidak melihat data pemilih');
  perform t.err('insert into candidates(election_id, voter_id, nomor_urut) values (t.id(''eRT5''), t.id(''vY''), 1)', 'row-level security', 'C9 VIEWER tidak bisa tambah calon (RLS)');
  reset role;

  perform set_config('request.jwt.claim.sub', t.id('krt3')::text, true);
  set local role authenticated;
  execute 'select count(*) from voters' into n; perform t.ok(n = 9, 'C10 Koord. RT 03 hanya melihat 9 pemilih RT 03');
  execute 'select count(*) from voters where neighborhood_id <> (select id from neighborhoods where code=''RT 03'')' into n; perform t.ok(n = 0, 'C11 tidak ada pemilih RT lain');
  perform t.err('select record_manual_participation(t.id(''vG''), t.id(''eRT3''))', 'FORBIDDEN', 'C12 Koord. RT tidak bisa input manual');
  update profiles set role = 'SUPER_ADMIN' where id = auth.uid();
  perform t.ok((select role from profiles where id = auth.uid()) = 'KOORDINATOR_RT', 'C13 tidak bisa menaikkan role sendiri (role tetap)');
  reset role;

  perform set_config('request.jwt.claim.sub', t.id('op4')::text, true);
  set local role authenticated;
  execute 'select count(*) from voters' into n; perform t.ok(n = 1, 'C14 Operator RT 04 hanya melihat RT 04');
  perform t.err('select record_manual_participation(t.id(''vG''), t.id(''eRT3''))', 'FORBIDDEN', 'C15 Operator RT 04 tidak bisa input RT 03');
  reset role;

  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  execute 'select count(*) from voters' into n; perform t.ok(n = 11, 'C16 Panitia melihat semua pemilih');
  perform t.err('insert into audit_logs(action) values (''palsu'')', 'permission denied', 'C17 tidak bisa menulis audit log langsung');
  perform t.err('insert into candidates(election_id, voter_id, nomor_urut, status) values (t.id(''eRT3''), t.id(''vX''), 9, ''BAKAL_CALON'')', 'ELECTION_LOCKED', 'C18 tidak bisa tambah calon saat pemilihan berlangsung');
  -- jalur sah: panitia menambah calon pada pemilihan yang masih DRAFT
  perform t.err('insert into candidates(election_id, voter_id, nomor_urut) values (t.id(''eRT5''), t.id(''vX''), 1)', 'CANDIDATE_WRONG_RT', 'C19 calon RT harus warga RT yang sama');
  insert into candidates(election_id, voter_id, nomor_urut) values (t.id('eRT5'), t.id('vY'), 1);
  perform t.ok((select count(*) from candidates where election_id = t.id('eRT5')) = 1, 'C20 panitia dapat menambah calon yang sah');
  reset role;
end $t$;

-- ===== D. SUARA MANUAL =====
do $t$
declare r jsonb; b uuid;
begin
  perform set_config('request.jwt.claim.sub', t.id('opall')::text, true);
  set local role authenticated;
  perform record_manual_participation(t.id('vG'), t.id('eRT3'));
  perform record_manual_participation(t.id('vH'), t.id('eRT3'));
  perform t.err('select record_manual_participation(t.id(''vG''), t.id(''eRT3''))', 'ALREADY_VOTED', 'D1 manual: tidak bisa dihitung dua kali');
  perform t.err('select record_manual_participation(t.id(''vA''), t.id(''eRT3''))', 'ALREADY_VOTED', 'D2 pemilih online tidak bisa dicatat manual lagi');
  perform t.err('select record_manual_participation(t.id(''vX''), t.id(''eRT3''))', 'WRONG_RT', 'D3 manual: RT harus sesuai');
  r := manual_reconciliation(t.id('eRT3'));
  perform t.ok((r->>'manual_participants')::int = 2 and (r->>'balanced')::boolean = false, 'D4 rekonsiliasi mendeteksi kertas suara belum dimasukkan');
  perform t.err(format('select enter_manual_tally(%L, ''Batch 1'', 2, 0, %L::jsonb)', t.id('eRT3'), jsonb_build_array(jsonb_build_object('candidate_id', t.id('cC'), 'votes', 0))), 'TALLY_MISMATCH', 'D5 jumlah suara < jumlah kertas ditolak');
  b := enter_manual_tally(t.id('eRT3'), 'Batch 1', 2, 0, jsonb_build_array(jsonb_build_object('candidate_id', t.id('cC'), 'votes', 1), jsonb_build_object('candidate_id', t.id('cE'), 'votes', 1)));
  r := manual_reconciliation(t.id('eRT3'));
  perform t.ok((r->>'balanced')::boolean, 'D6 rekonsiliasi seimbang setelah rekap dimasukkan');
  perform t.err('update manual_batches set ballot_count = 99', 'permission denied', 'D7 klien tidak bisa ubah rekap manual');
  reset role;
  perform t.err('update manual_batches set ballot_count = 99', 'IMMUTABLE_RECORD', 'D7b rekap manual immutable di DB');
end $t$;

-- ===== E. HASIL, PENGUNCIAN, AUDIT =====
do $t$
declare r record; n int;
begin
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  select * into r from get_election_results(t.id('eRT3')) where candidate_id = t.id('cC');
  perform t.ok(r.online_votes = 1 and r.manual_votes = 1 and r.total_votes = 2, 'E1 hasil menggabungkan online + manual');
  select count(*) into n from get_election_results(t.id('eRT3'));
  perform t.ok(n = 3, 'E2 hasil memuat semua calon');
  reset role;

  update elections set status = 'PERHITUNGAN' where id = t.id('eRT3');
  perform t.err(format('select start_voting_session(%L, %L)', 'kk_F', (select id from neighborhoods where code='RT 03')), 'ELECTION_NOT_OPEN', 'E3 voting ditolak setelah ditutup');
  update elections set status = 'SELESAI' where id = t.id('eRT3');
  perform t.ok((select locked_at is not null from elections where id = t.id('eRT3')), 'E4 locked_at terisi saat SELESAI');
  perform t.err(format('update elections set status = ''PEMILIHAN_BERLANGSUNG'' where id = %L', t.id('eRT3')), 'ELECTION_LOCKED', 'E5 hasil terkunci tidak bisa dibuka lagi');
  perform t.err(format('update elections set max_choices = 5 where id = %L', t.id('eRT3')), 'ELECTION_LOCKED', 'E6 konfigurasi terkunci');

  set local role anon;
  select count(*) into n from get_public_results(t.id('eRT3'));
  perform t.ok(n = 3, 'E7 hasil publik tersedia setelah SELESAI (tanpa identitas pemilih)');
  reset role;

  perform t.ok(exists (select 1 from audit_logs where entity = 'elections' and action = 'UPDATE' and after_data->>'status' = 'SELESAI'), 'E8 perubahan status tercatat di audit');
  perform t.ok(exists (select 1 from audit_logs where action = 'MANUAL_PARTICIPATION' and actor = t.id('opall')), 'E9 input manual tercatat dengan pelaku');
  perform t.ok(not exists (select 1 from audit_logs where before_data ? 'kk_hash' or after_data ? 'kk_hash'), 'E10 audit tidak memuat hash KK');
  perform t.err(format('insert into correction_requests(election_id, target_table, reason, requested_by, approved_by) values (%L, ''x'', ''salah'', %L, %L)', t.id('eRT3'), t.id('panitia'), t.id('panitia')), 'check constraint', 'E11 pemohon tidak boleh menyetujui koreksinya sendiri');
end $t$;
