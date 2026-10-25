\set ON_ERROR_STOP on
set client_min_messages = notice;

-- ===== F. IMPORT BERTAHAP =====
do $t$
declare r jsonb; b uuid; rows1 jsonb; rt06 uuid := (select id from neighborhoods where code='RT 06');
begin
  rows1 := jsonb_build_array(
    jsonb_build_object('row_no',2,'kk_hash','kk_I1','kk_masked','3573********0001','nama','Imam Hidayat','jenis_kelamin','L','hubungan','SUAMI','alamat','Jl. Mawar 1','rt','RT 06'),
    jsonb_build_object('row_no',3,'kk_hash','kk_I1','kk_masked','3573********0001','nama','Intan Sari','jenis_kelamin','P','hubungan','ISTRI','alamat','Jl. Mawar 1','rt','RT 06'),
    jsonb_build_object('row_no',4,'kk_hash','kk_I1','kk_masked','3573********0001','nama','Ilham Hidayat','jenis_kelamin','L','hubungan','LAINNYA','alamat','Jl. Mawar 1','rt','RT 06'),
    jsonb_build_object('row_no',5,'kk_hash','kk_I2','kk_masked','3573********0002','nama','Joko Widodo','jenis_kelamin','L','hubungan','SUAMI','alamat','Jl. Melati 2','rt','RT 06'));
  set local role service_role;
  r := stage_import('uji.xlsx', t.id('admin'), rows1, 0);
  perform t.ok((r->>'new_voters')::int = 4 and (r->>'new_households')::int = 2 and (r->>'conflicts')::int = 0, 'F1 pratinjau: 4 pemilih baru, 2 KK baru, tanpa konflik');
  perform t.ok((select count(*) from voters where neighborhood_id = rt06) = 0, 'F2 pratinjau belum memasukkan data ke database');
  r := commit_import((r->>'batch_id')::uuid, t.id('admin'));
  perform t.ok((r->>'voters_added')::int = 4 and (r->>'households_added')::int = 2, 'F3 konfirmasi memasukkan data');
  perform t.ok((select count(*) from voters where neighborhood_id = rt06 and has_voting_right) = 3, 'F4 hak suara: suami+istri+suami = 3, anak tidak berhak');
  perform t.ok((select count(*) from import_staging) = 0, 'F5 data staging dibersihkan setelah commit');

  r := stage_import('uji-ulang.xlsx', t.id('admin'), rows1, 0);
  perform t.ok((r->>'already_exists')::int = 4 and (r->>'new_voters')::int = 0, 'F6 impor ulang terdeteksi sebagai sudah ada');
  r := commit_import((r->>'batch_id')::uuid, t.id('admin'));
  perform t.ok((r->>'voters_added')::int = 0, 'F7 impor ulang tidak menggandakan data');

  r := stage_import('konflik.xlsx', t.id('admin'), jsonb_build_array(
        jsonb_build_object('row_no',2,'kk_hash','kk_I1','kk_masked','3573********0001','nama','Orang Lain','jenis_kelamin','L','hubungan','SUAMI','alamat','-','rt','RT 05'),
        jsonb_build_object('row_no',3,'kk_hash','kk_I3','kk_masked','3573********0003','nama','Kartika Dewi','jenis_kelamin','P','hubungan','ISTRI','alamat','Jl. Kenanga 3','rt','RT 06')), 0);
  b := (r->>'batch_id')::uuid;
  perform t.ok((r->>'conflicts')::int = 1 and (r->>'new_voters')::int = 1, 'F8 KK yang sudah ada di RT lain ditandai konflik');
  perform t.err(format('select commit_import(%L, %L)', b, t.id('admin')), 'IMPORT_HAS_ERRORS', 'F9 konfirmasi ditolak bila ada error (tanpa persetujuan eksplisit)');
  r := commit_import(b, t.id('admin'), true);
  perform t.ok((r->>'voters_added')::int = 1, 'F10 impor sebagian hanya memasukkan baris valid');
  perform t.err(format('select commit_import(%L, %L)', b, t.id('admin')), 'IMPORT_NOT_STAGED', 'F11 batch tidak bisa dikonfirmasi dua kali');
  perform t.ok(exists (select 1 from audit_logs where action = 'IMPORT_VOTERS' and actor = t.id('admin')), 'F12 import tercatat di audit');
  reset role;
  set local role authenticated;
  perform t.err('select stage_import(''x'', null, ''[]''::jsonb, 0)', 'permission denied', 'F13 klien browser tidak bisa memanggil import');
  reset role;
end $t$;

-- ===== G. RATE LIMIT =====
do $t$
declare a boolean; b boolean; c boolean; d boolean;
begin
  set local role service_role;
  a := check_rate_limit('uji-kunci-rahasia', 3, interval '1 minute'); b := check_rate_limit('uji-kunci-rahasia', 3, interval '1 minute');
  c := check_rate_limit('uji-kunci-rahasia', 3, interval '1 minute'); d := check_rate_limit('uji-kunci-rahasia', 3, interval '1 minute');
  perform t.ok(a and b and c and not d, 'G1 batas percobaan: 3 diizinkan, ke-4 ditolak');
  perform t.ok(exists (select 1 from audit_logs where action = 'RATE_LIMIT_EXCEEDED'), 'G2 pelampauan batas tercatat sebagai kejadian keamanan');
  perform t.ok(check_rate_limit('kunci-lain', 3, interval '1 minute'), 'G3 kunci lain tidak terpengaruh');
  reset role;
end $t$;

-- ===== H. KONTROL STATUS, CALON, FAKTOR KEDUA, SURAT SUARA =====
do $t$
declare rt06 uuid := (select id from neighborhoods where code='RT 06'); e6 uuid; s jsonb; tok text; o jsonb; rc text; c1 uuid; c2 uuid; nums int[];
begin
  select id into e6 from elections where neighborhood_id = rt06;
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  perform t.err(format('update elections set status = ''PEMILIHAN_BERLANGSUNG'' where id = %L', e6), 'permission denied', 'H1 status tidak bisa diubah langsung, hanya lewat fungsi');
  perform t.err(format('select set_election_status(%L, ''PEMILIHAN_BERLANGSUNG'')', e6), 'INVALID_TRANSITION', 'H2 tidak boleh melompati tahap');
  perform set_election_status(e6, 'TERJADWAL'); perform set_election_status(e6, 'PERSIAPAN');
  perform t.err(format('select set_election_status(%L, ''PEMILIHAN_BERLANGSUNG'')', e6), 'PREREQUISITE_FAILED', 'H3 tidak bisa dibuka tanpa metode/jumlah pilihan/calon');
  update elections set method = 'VOTING', max_choices = 1 where id = e6;
  perform t.err(format('select set_election_status(%L, ''PEMILIHAN_BERLANGSUNG'')', e6), 'PREREQUISITE_FAILED', 'H4 tidak bisa dibuka tanpa calon');
  c1 := add_candidate(e6, (select id from voters where nama = 'Imam Hidayat'));
  c2 := add_candidate(e6, (select id from voters where nama = 'Joko Widodo'));
  perform t.ok((select array_agg(nomor_urut order by nomor_urut) from candidates where election_id = e6) = array[1,2], 'H5 nomor calon otomatis berurutan');
  perform t.err(format('select set_election_status(%L, ''PEMILIHAN_BERLANGSUNG'')', e6), 'PREREQUISITE_FAILED', 'H6 bakal calon belum sah memilih (harus calon tetap)');
  update candidates set status = 'CALON_TETAP' where election_id = e6;
  reset role;

  perform set_config('request.jwt.claim.sub', t.id('viewer')::text, true);
  set local role authenticated;
  perform t.err(format('select set_election_status(%L, ''PEMILIHAN_BERLANGSUNG'')', e6), 'FORBIDDEN', 'H7 VIEWER tidak berwenang mengubah status');
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  perform t.ok(set_election_status(e6, 'PEMILIHAN_BERLANGSUNG') = 'PEMILIHAN_BERLANGSUNG', 'H8 pemilihan dibuka setelah prasyarat terpenuhi');
  reset role;

  -- faktor kedua
  update settings set value = '"INVITE_CODE"' where key = 'rule.second_factor';
  set local role service_role;
  perform t.err(format('select start_voting_session(%L, %L)', 'kk_I1', rt06), 'VOTER_NOT_FOUND', 'H9 tanpa kode undangan ditolak (pesan sama dengan KK tidak ditemukan)');
  perform set_invite_codes(jsonb_build_array(jsonb_build_object('household_id', (select id from households where kk_hash='kk_I1'), 'hash', 'hash_I1')), t.id('admin'));
  perform t.err(format('select start_voting_session(%L, %L, interval ''10 minutes'', %L)', 'kk_I1', rt06, 'salah'), 'VOTER_NOT_FOUND', 'H10 kode undangan salah ditolak');
  s := start_voting_session('kk_I1', rt06, interval '10 minutes', 'hash_I1'); tok := s->>'token';
  perform t.ok(jsonb_array_length(s->'members') = 2, 'H11 kode benar: daftar anggota berhak (anak tidak termasuk)');
  perform t.err(format('select get_ballot_options(%L)', tok), 'SESSION_INVALID', 'H12 surat suara tidak tersedia sebelum memilih nama');
  perform select_voter(tok, (select id from voters where nama = 'Imam Hidayat'));
  o := get_ballot_options(tok);
  perform t.ok(jsonb_array_length(o->'rt'->'candidates') = 2 and (o->'rt'->>'max_choices')::int = 1, 'H13 opsi surat suara RT sesuai RT pemilih');
  perform t.ok(o->'rw' is not null and jsonb_array_length(o->'rw'->'candidates') = 2, 'H14 opsi penjaringan RW tersedia');
  perform t.ok(o::text !~ '\d{16}' and o::text not like '%kk_%' and o::text not like '%hash%', 'H15 opsi surat suara tidak memuat data KK');
  rc := cast_ballots(tok, jsonb_build_array(
        jsonb_build_object('election_id', o->'rt'->>'election_id', 'candidate_ids', jsonb_build_array(c1)),
        jsonb_build_object('election_id', o->'rw'->>'election_id', 'candidate_ids', jsonb_build_array(t.id('rwA')))));
  perform t.ok(rc like 'VOTE-%', 'H16 suara RT + RW terkirim');
  reset role;
  update settings set value = 'null' where key = 'rule.second_factor';
  set local role service_role;
  s := start_voting_session('kk_I2', rt06);
  perform t.err(format('select get_ballot_options(%L)', s->>'token'), 'SESSION_INVALID', 'H17 faktor kedua nonaktif: alur normal, opsi tetap butuh pemilihan nama');
  reset role;
end $t$;

-- ===== I. STATISTIK & DAFTAR =====
do $t$
declare st jsonb; row3 jsonb; n int; tot bigint;
begin
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  st := get_dashboard_stats();
  perform t.ok(jsonb_array_length(st->'rt') = 6, 'I1 dashboard memuat 6 RT');
  select x into row3 from jsonb_array_elements(st->'rt') x where x->>'rt' = 'RT 03';
  perform t.ok((row3->>'kk')::int = 7 and (row3->>'berhak_l')::int = 5 and (row3->>'berhak_p')::int = 3, 'I2 rekap RT 03: 7 KK, 5 laki-laki, 3 perempuan (anak tidak dihitung)');
  perform t.ok((row3->>'sudah_online')::int = 2 and (row3->>'sudah_manual')::int = 2, 'I3 partisipasi dipisah online / manual');
  select count(*), max(total) into n, tot from list_voters(null, 'SUDAH', null, null, 50, 0) where rt = 'RT 03';
  perform t.ok(n = 4, 'I4 filter sudah memilih RT 03 = 4 orang');
  select count(*) into n from list_voters((select id from neighborhoods where code='RT 03'), 'BELUM', null, null, 50, 0);
  perform t.ok(n = 4, 'I5 filter belum memilih RT 03 = 4 orang (yang tidak berhak tidak dihitung)');
  select count(*) into n from list_voters(null, null, null, 'kk_AB', 50, 0);
  perform t.ok(n = 3, 'I6 pencarian per KK (hash) menampilkan seluruh anggota KK');
  select count(*) into n from list_voters(null, null, 'budi', null, 50, 0);
  perform t.ok(n = 2, 'I7 pencarian nama (dua orang bernama sama tetap terpisah)');
  perform t.ok(not exists (select 1 from list_voters(null,null,null,null,200,0) where kk_masked !~ '^\d{4}\*{8}\d{4}$'), 'I8 daftar hanya menampilkan KK tersamar');
  perform t.ok((select count(*) from list_voters(null,null,null,null,3,0)) = 3 and (select max(total) from list_voters(null,null,null,null,3,0)) > 3, 'I9 paginasi: batas halaman dihormati, total tetap dilaporkan');
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('krt3')::text, true);
  set local role authenticated;
  perform t.ok(jsonb_array_length(get_dashboard_stats()->'rt') = 1, 'I10 Koord. RT 03 hanya melihat statistik RT 03');
  perform t.ok((select count(*) from list_voters((select id from neighborhoods where code='RT 04'), null, null, null, 50, 0)) = 0, 'I11 Koord. RT tidak bisa melihat daftar RT lain');
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('viewer')::text, true);
  set local role authenticated;
  perform t.ok(jsonb_array_length(get_dashboard_stats()->'rt') = 6, 'I12 VIEWER melihat agregat semua RT');
  perform t.err('select * from list_voters()', 'FORBIDDEN', 'I13 VIEWER tidak melihat daftar individu');
  reset role;
  set local role anon;
  perform t.err('select get_dashboard_stats()', 'permission denied', 'I14 anon tidak bisa memanggil statistik');
  reset role;
end $t$;

-- ===== J. SUARA MANUAL RW & REKAP MATRIKS =====
do $t$
declare m jsonb; a jsonb; x jsonb; rt3 uuid := (select id from neighborhoods where code='RT 03');
begin
  perform set_config('request.jwt.claim.sub', t.id('opall')::text, true);
  set local role authenticated;
  perform t.err(format('select enter_manual_tally(%L, ''RW-B1'', 1, 0, %L::jsonb)', t.id('eRW'), jsonb_build_array(jsonb_build_object('candidate_id', t.id('rwA'), 'votes', 1))), 'SOURCE_RT_REQUIRED', 'J1 rekap manual RW wajib menyebut RT asal');
  perform enter_manual_tally(t.id('eRW'), 'RW-B1', 1, 0, jsonb_build_array(jsonb_build_object('candidate_id', t.id('rwA'), 'votes', 1)), rt3);
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('op4')::text, true);
  set local role authenticated;
  perform t.err(format('select enter_manual_tally(%L, ''RW-B2'', 1, 0, %L::jsonb, %L)', t.id('eRW'), jsonb_build_array(jsonb_build_object('candidate_id', t.id('rwA'), 'votes', 1)), rt3), 'FORBIDDEN', 'J2 Operator RT 04 tidak bisa memasukkan rekap RT 03');
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  m := get_rw_matrix(t.id('eRW'));
  a := m->0; x := m->1;
  perform t.ok(a->>'nama' = 'Ahmad Fauzi' and (a->>'total')::int = 3, 'J3 peringkat RW: calon teratas 3 suara');
  perform t.ok((a->'by_rt'->>'RT 03')::int = 2 and (a->'by_rt'->>'RT 06')::int = 1 and (a->'by_rt'->>'RT 01')::int = 0, 'J4 rincian per RT: RT 03 = 1 online + 1 manual, RT 06 = 1');
  perform t.ok(x->>'asal_rt' = 'RT 04' and (x->>'total')::int = 1, 'J5 asal RT calon tampil (calon dari RT 04)');
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('viewer')::text, true);
  set local role authenticated;
  perform t.err(format('select get_rw_matrix(%L)', t.id('eRW')), 'FORBIDDEN', 'J6 VIEWER tidak melihat rekap RW detail');
  reset role;
end $t$;

-- ===== K. BERITA ACARA =====
do $t$
declare id1 uuid; snap jsonb;
begin
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  perform t.err(format('select save_berita_acara(%L, ''{}''::jsonb)', t.id('eRT4')), 'ELECTION_NOT_CLOSED', 'K1 Berita Acara hanya untuk pemilihan yang sudah selesai');
  id1 := save_berita_acara(t.id('eRT3'), '{"ketua":"Bapak Contoh"}'::jsonb);
  select snapshot into snap from berita_acara where id = id1;
  perform t.ok((snap->'counts'->>'hak_suara')::int = 8 and (snap->'counts'->>'suara_masuk')::int = 4, 'K2 jumlah hak suara 8 dan suara masuk 4 terisi otomatis dari database');
  perform t.ok((snap->'counts'->>'suara_sah')::int = 4 and (snap->'counts'->>'suara_tidak_sah')::int = 0 and (snap->'counts'->>'partisipasi_persen')::numeric = 50.00, 'K3 suara sah/tidak sah dan partisipasi 50%');
  perform t.ok(jsonb_array_length(snap->'hasil') = 3 and (snap->'hasil'->0->>'suara')::int = 2 and (snap->'hasil'->1->>'suara')::int = 2, 'K4 hasil memuat perolehan sama (dua calon 2 suara); tidak ada pemenang otomatis');
  perform t.ok(snap->'meta'->>'ketua' = 'Bapak Contoh' and (select nomor_dokumen from berita_acara where id = id1) is null, 'K5 nomor dokumen kosong selama format belum ditetapkan panitia');
  reset role;
  update settings set value = '"{seq}/BA/{rt}/RW{rw}/{year}"' where key = 'doc.nomor_format';
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  perform save_berita_acara(t.id('eRT3'), '{"ketua":"Bapak Contoh"}'::jsonb, true);
  perform t.ok((select nomor_dokumen from berita_acara where id = id1) ~ '^001/BA/RT03/RW09/\d{4}$', 'K6 nomor dokumen otomatis sesuai format yang ditetapkan');
  perform t.err(format('select save_berita_acara(%L, ''{}''::jsonb)', t.id('eRT3')), 'DOCUMENT_LOCKED', 'K7 Berita Acara final terkunci');
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('opall')::text, true);
  set local role authenticated;
  perform t.err(format('select save_berita_acara(%L, ''{}''::jsonb)', t.id('eRT3')), 'FORBIDDEN', 'K8 Operator tidak berwenang membuat Berita Acara');
  reset role;
  update settings set value = 'null' where key = 'doc.nomor_format';
end $t$;

-- ===== L. PENUTUPAN PEMILIHAN & MUSYAWARAH =====
do $t$
declare e6 uuid := (select id from elections where neighborhood_id = (select id from neighborhoods where code='RT 06')); e5 uuid := t.id('eRT5'); c1 uuid;
begin
  select id into c1 from candidates where election_id = e6 and nomor_urut = 1;
  perform set_config('request.jwt.claim.sub', t.id('opall')::text, true);
  set local role authenticated;
  perform record_manual_participation((select id from voters where nama = 'Intan Sari'), e6);
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  perform set_election_status(e6, 'PERHITUNGAN');
  perform t.err(format('select set_election_status(%L, ''PEMILIHAN_BERLANGSUNG'')', e6), 'INVALID_TRANSITION', 'L1 pemilihan yang sudah ditutup tidak bisa dibuka kembali');
  perform t.err(format('select set_election_status(%L, ''SELESAI'')', e6), 'RECONCILIATION_FAILED', 'L2 tidak bisa diselesaikan bila kertas suara manual belum cocok dengan peserta manual');
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('opall')::text, true);
  set local role authenticated;
  perform enter_manual_tally(e6, 'B1', 1, 0, jsonb_build_array(jsonb_build_object('candidate_id', c1, 'votes', 1)));
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  perform t.ok(set_election_status(e6, 'SELESAI') = 'SELESAI', 'L3 selesai setelah rekonsiliasi seimbang');
  perform t.ok((select locked_at is not null from elections where id = e6), 'L4 hasil terkunci saat selesai');

  -- musyawarah (RT 05)
  update elections set method = 'MUSYAWARAH' where id = e5;
  perform set_election_status(e5, 'TERJADWAL'); perform set_election_status(e5, 'PERSIAPAN');
  perform t.err(format('select set_election_status(%L, ''PEMILIHAN_BERLANGSUNG'')', e5), 'INVALID_TRANSITION', 'L5 musyawarah tidak memakai tahap pemungutan suara');
  perform t.err(format('select set_election_status(%L, ''SELESAI'')', e5), 'PREREQUISITE_FAILED', 'L6 musyawarah belum bisa selesai tanpa hasil tercatat');
  perform save_musyawarah(e5, '{"peserta": 42, "pengurus": [{"nama": "Yusuf Hakim", "jabatan": "Ketua RT"}]}'::jsonb);
  perform t.ok(set_election_status(e5, 'SELESAI') = 'SELESAI', 'L7 musyawarah selesai setelah hasil dicatat');
  perform save_berita_acara(e5, '{}'::jsonb);
  perform t.ok((select snapshot->'musyawarah'->>'peserta' from berita_acara where election_id = e5) = '42', 'L8 Berita Acara musyawarah memuat jumlah peserta dan pengurus terpilih');
  reset role;
end $t$;

-- ===== M. PENGATURAN =====
do $t$
begin
  perform set_config('request.jwt.claim.sub', t.id('panitia')::text, true);
  set local role authenticated;
  perform t.err('select save_setting(''rule.second_factor'', ''"INVITE_CODE"''::jsonb)', 'FORBIDDEN', 'M1 hanya Super Admin yang boleh mengubah aturan');
  update settings set value = '"x"'::jsonb where key = 'rule.tie_break';
  perform t.ok((select value from settings where key = 'rule.tie_break') = 'null'::jsonb, 'M2 panitia tidak dapat mengubah pengaturan secara langsung (nilai tetap)');
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('admin')::text, true);
  set local role authenticated;
  perform save_setting('rule.tie_break', '"MUSYAWARAH_PANITIA"'::jsonb);
  perform t.ok((select value from settings where key = 'rule.tie_break') = '"MUSYAWARAH_PANITIA"'::jsonb, 'M3 Super Admin dapat menetapkan aturan');
  perform save_setting('rule.tie_break', null);
  perform t.ok((select value from settings where key = 'rule.tie_break') = 'null'::jsonb, 'M4 mengosongkan aturan menyimpan null JSON (belum ditetapkan)');
  perform t.err('select save_setting(''kunci.liar'', ''1''::jsonb)', 'NOT_FOUND', 'M5 kunci pengaturan di luar daftar ditolak');
  reset role;
end $t$;

-- ===== N. CAKUPAN HASIL PER RT =====
do $t$
begin
  perform set_config('request.jwt.claim.sub', t.id('krt3')::text, true);
  set local role authenticated;
  perform t.ok((select count(*) from get_election_results(t.id('eRT3'))) = 3, 'N1 Koord. RT 03 melihat hasil RT 03');
  perform t.err(format('select * from get_election_results(%L)', t.id('eRT4')), 'FORBIDDEN', 'N2 Koord. RT 03 tidak bisa melihat hasil RT 04');
  perform t.err(format('select * from get_election_results(%L)', t.id('eRW')), 'FORBIDDEN', 'N3 Koord. RT tidak bisa melihat hasil RW');
  reset role;
  perform set_config('request.jwt.claim.sub', t.id('op4')::text, true);
  set local role authenticated;
  perform t.err(format('select manual_reconciliation(%L)', t.id('eRT3')), 'FORBIDDEN', 'N4 Operator RT 04 tidak bisa melihat rekonsiliasi RT 03');
  perform t.err(format('select * from get_election_results(%L)', t.id('eRT4')), 'FORBIDDEN', 'N5 Operator tidak melihat hasil (hanya input)');
  reset role;
end $t$;

-- ===== P. DAFTAR PUTIH HAK AKSES (anti-kelalaian migrasi) =====
do $t$
declare anon_fn text[]; auth_fn text[];
begin
  select array_agg(p.proname::text order by p.proname) into anon_fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE');
  select array_agg(p.proname::text order by p.proname) into auth_fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  perform t.ok(anon_fn = (select array_agg(x order by x) from unnest(array['can_see_rt','current_app_rt','current_app_role','get_public_results','has_role']) x), 'P1 fungsi yang dapat dipanggil anon = daftar putih (' || array_to_string(anon_fn, ',') || ')');
  perform t.ok(auth_fn = (select array_agg(x order by x) from unnest(array['add_candidate','can_see_rt','current_app_rt','current_app_role','enter_manual_tally','get_dashboard_stats','get_election_results','get_public_results','get_rw_matrix','has_role','list_households_for_codes','list_voters','manual_reconciliation','record_manual_participation','save_berita_acara','save_musyawarah','save_setting','set_election_status']) x), 'P2 fungsi yang dapat dipanggil staf login = daftar putih (' || array_to_string(auth_fn, ',') || ')');
  perform t.ok(not exists (select 1 from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon','authenticated') and table_name in ('votes','ballots','voting_sessions','manual_batches','manual_vote_entries','rate_limits','import_batches','import_staging')), 'P3 tabel suara/sesi/staging tidak punya hak apa pun untuk klien');
  perform t.ok(not exists (select 1 from information_schema.role_usage_grants where object_type = 'SEQUENCE' and grantee in ('anon','authenticated')), 'P4 tidak ada sekuens yang dapat dipakai klien');
  perform t.ok(not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity), 'P5 semua tabel memakai RLS');
end $t$;
