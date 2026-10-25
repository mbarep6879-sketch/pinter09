-- DATA DUMMY untuk pengujian. Tidak ada data warga asli.
create schema t; grant usage on schema t to public;
create table t.fx (k text primary key, id uuid not null); grant select on t.fx to public;
create function t.id(p_k text) returns uuid language sql stable as $$ select id from t.fx where k = p_k $$;
create function t.ok(c boolean, n text) returns void language plpgsql as $$
begin if c is not true then raise exception 'FAIL: %', n; end if; raise notice 'PASS: %', n; end $$;
create function t.err(q text, expected text, n text) returns void language plpgsql as $$
begin
  begin execute q;
  exception when others then
    if position(expected in sqlerrm) > 0 then raise notice 'PASS: % [%]', n, expected; return; end if;
    raise exception 'FAIL: % (diharapkan %, dapat %)', n, expected, sqlerrm;
  end;
  raise exception 'FAIL: % (tidak ada error, diharapkan %)', n, expected;
end $$;
grant execute on all functions in schema t to public;

do $f$
declare r record; hh uuid; vid uuid; uid uuid; eid uuid;
begin
  -- pemilih: (kunci, rt, nama, jk, kelompok KK, hubungan, berhak)
  -- A dan B adalah suami-istri dalam KK yang sama; Z adalah anak (tidak berhak memilih).
  for r in select * from (values
    ('A','RT 03','Ahmad Fauzi','L','AB','SUAMI',true),('B','RT 03','Siti Aminah','P','AB','ISTRI',true),
    ('Z','RT 03','Zahra Fauzi','P','AB','LAINNYA',false),
    ('C','RT 03','Budi Santoso','L','C','SUAMI',true),('D','RT 03','Budi Santoso','L','D','SUAMI',true),
    ('E','RT 03','Dewi Lestari','P','E','ISTRI',true),('F','RT 03','Fajar Nugroho','L','F','SUAMI',true),
    ('G','RT 03','Gita Putri','P','G','ISTRI',true),('H','RT 03','Hasan Basri','L','H','SUAMI',true),
    ('X','RT 04','Rina Wulandari','P','X','ISTRI',true),('Y','RT 05','Yusuf Hakim','L','Y','SUAMI',true)) v(k,rt,nama,jk,grp,hub,hak)
  loop
    insert into households(kk_hash, kk_masked, neighborhood_id)
    values ('kk_'||r.grp, '3573********1234', (select id from neighborhoods where code=r.rt))
    on conflict (kk_hash) do update set kk_hash = excluded.kk_hash returning id into hh;
    insert into voters(household_id, nama, jenis_kelamin, hubungan, alamat, neighborhood_id, has_voting_right)
    values (hh, r.nama, r.jk::gender, r.hub::household_role, 'Jl. Contoh No. '||r.grp, (select id from neighborhoods where code=r.rt), r.hak)
    returning id into vid;
    insert into t.fx values ('v'||r.k, vid);
  end loop;

  -- staf
  for r in select * from (values
    ('admin','SUPER_ADMIN',null),('panitia','PANITIA',null),('krt3','KOORDINATOR_RT','RT 03'),
    ('op4','OPERATOR','RT 04'),('opall','OPERATOR',null),('viewer','VIEWER',null)) s(k,role,rt)
  loop
    insert into auth.users(email) values (r.k||'@contoh.test') returning id into uid;
    insert into profiles(id, nama, role, neighborhood_id)
    values (uid, r.k, r.role::app_role, (select id from neighborhoods where code=r.rt));
    insert into t.fx values (r.k, uid);
  end loop;

  -- konfigurasi pemilihan
  update elections set method='VOTING', max_choices=2, status='PERSIAPAN' where neighborhood_id=(select id from neighborhoods where code='RT 03');
  update elections set method='VOTING', status='PERSIAPAN' where neighborhood_id=(select id from neighborhoods where code='RT 04'); -- max_choices sengaja NULL
  update elections set method='VOTING', max_choices=1, status='PERSIAPAN' where type='RW_NOMINATION';

  -- calon (status CALON_TETAP untuk RT; nama kembar: Budi Santoso x2)
  select id into eid from elections where neighborhood_id=(select id from neighborhoods where code='RT 03');
  insert into t.fx values ('eRT3', eid);
  insert into t.fx select 'eRT4', id from elections where neighborhood_id=(select id from neighborhoods where code='RT 04');
  insert into t.fx select 'eRT5', id from elections where neighborhood_id=(select id from neighborhoods where code='RT 05');
  insert into t.fx select 'eRW', id from elections where type='RW_NOMINATION';
  insert into candidates(election_id, voter_id, nomor_urut, status) values (t.id('eRT3'), t.id('vC'), 1, 'CALON_TETAP') returning id into eid; insert into t.fx values ('cC', eid);
  insert into candidates(election_id, voter_id, nomor_urut, status) values (t.id('eRT3'), t.id('vD'), 2, 'CALON_TETAP') returning id into eid; insert into t.fx values ('cD', eid);
  insert into candidates(election_id, voter_id, nomor_urut, status) values (t.id('eRT3'), t.id('vE'), 3, 'CALON_TETAP') returning id into eid; insert into t.fx values ('cE', eid);
  insert into candidates(election_id, voter_id, nomor_urut, status) values (t.id('eRT4'), t.id('vX'), 1, 'CALON_TETAP');
  insert into candidates(election_id, voter_id, nomor_urut) values (t.id('eRW'), t.id('vA'), 1) returning id into eid; insert into t.fx values ('rwA', eid);
  insert into candidates(election_id, voter_id, nomor_urut) values (t.id('eRW'), t.id('vX'), 2) returning id into eid; insert into t.fx values ('rwX', eid);

  -- buka pemilihan
  update elections set status='PEMILIHAN_BERLANGSUNG' where id in (t.id('eRT3'), t.id('eRT4'), t.id('eRW'));
end $f$;
