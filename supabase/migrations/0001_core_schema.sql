-- PEMILU WARGA RW 09 - PHASE 2: skema inti
-- Prinsip: votes/ballots TIDAK menyimpan voter_id maupun timestamp presisi.
-- Verifikasi pemilih memakai Nomor KK (NKK); NIK tidak dikumpulkan sama sekali.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ===== ENUM =====
create type app_role as enum ('SUPER_ADMIN','PANITIA','KOORDINATOR_RW','KOORDINATOR_RT','OPERATOR','VIEWER');
create type election_type as enum ('RT','RW_NOMINATION','RW_FINAL');
create type election_status as enum ('DRAFT','TERJADWAL','PERSIAPAN','PEMILIHAN_BERLANGSUNG','PERHITUNGAN','SELESAI','DITETAPKAN');
create type election_method as enum ('MUSYAWARAH','VOTING');
create type vote_channel as enum ('ONLINE','MANUAL');
create type candidate_status as enum ('BAKAL_CALON','CALON_TETAP','MENGUNDURKAN_DIRI','TIDAK_AKTIF','TERPILIH');
create type gender as enum ('L','P');

-- ===== WILAYAH & PEMILIH =====
create table neighborhoods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,               -- 'RT 01'
  rw text not null default '09',
  kelurahan text not null default 'Purwantoro'
);

create table households (
  id uuid primary key default gen_random_uuid(),
  kk_hash text not null unique,            -- HMAC-SHA256(Nomor KK, pepper); nomor KK asli tidak disimpan
  kk_masked text not null check (kk_masked ~ '^\d{4}\*{8}\d{4}$'),
  neighborhood_id uuid not null references neighborhoods(id),
  invite_hash text                          -- HMAC kode undangan (faktor kedua, opsional)
);

create type household_role as enum ('SUAMI','ISTRI','LAINNYA');

create table voters (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  nama text not null check (length(trim(nama)) > 0),
  jenis_kelamin gender not null,
  hubungan household_role not null default 'LAINNYA',
  alamat text not null default '',
  neighborhood_id uuid not null references neighborhoods(id),
  is_active boolean not null default true,
  has_voting_right boolean not null default true,  -- diisi saat import: suami/istri = true; lainnya = false
  no_urut int,
  created_at timestamptz not null default now()
);
create unique index voters_household_name_uq on voters(household_id, lower(trim(nama)));
create index voters_rt_idx on voters(neighborhood_id);
create index voters_household_idx on voters(household_id);

-- ===== USER PANITIA =====
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nama text not null,
  role app_role not null default 'VIEWER',
  neighborhood_id uuid references neighborhoods(id),  -- cakupan RT (Koord. RT / Operator)
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ===== PEMILIHAN =====
create table elections (
  id uuid primary key default gen_random_uuid(),
  type election_type not null,
  neighborhood_id uuid references neighborhoods(id),
  nama text not null,
  status election_status not null default 'DRAFT',
  method election_method,
  max_choices int check (max_choices is null or max_choices > 0),  -- NULL = belum ditetapkan panitia
  config jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  check ((type = 'RT') = (neighborhood_id is not null))
);
create unique index elections_one_rt on elections(neighborhood_id) where type = 'RT';
create unique index elections_one_rw_type on elections(type) where type <> 'RT';

create table election_schedules (
  election_id uuid primary key references elections(id) on delete cascade,
  mulai timestamptz, selesai timestamptz,
  lokasi text, penanggung_jawab text, catatan text,
  check (selesai is null or mulai is null or selesai > mulai)
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  voter_id uuid not null references voters(id),
  nomor_urut int not null check (nomor_urut > 0),
  status candidate_status not null default 'BAKAL_CALON',
  created_at timestamptz not null default now(),
  unique (election_id, nomor_urut),
  unique (election_id, voter_id),
  unique (id, election_id)
);
create index candidates_election_idx on candidates(election_id);

create table candidate_profiles (
  candidate_id uuid primary key references candidates(id) on delete cascade,
  foto_path text, profil text
);

-- ===== VOTING (identitas dan pilihan dipisah) =====
create table voting_sessions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  voter_id uuid references voters(id),     -- terisi setelah pemilih memilih namanya dalam KK
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table vote_participation (        -- SIAPA sudah memilih (bukan memilih apa)
  id uuid primary key default gen_random_uuid(),
  voter_id uuid not null references voters(id),
  election_id uuid not null references elections(id),
  channel vote_channel not null,
  receipt_code text,
  recorded_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (voter_id, election_id)          -- 1 pemilih = 1 hak suara per pemilihan
);
create index participation_election_idx on vote_participation(election_id);

create table ballots (                   -- tanpa voter_id, tanpa timestamp
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  channel vote_channel not null,
  source_neighborhood_id uuid not null references neighborhoods(id),
  unique (id, election_id)
);
create index ballots_election_idx on ballots(election_id);

create table votes (                     -- APA yang dipilih (satu baris per pilihan pada surat suara)
  ballot_id uuid not null,
  election_id uuid not null,
  candidate_id uuid not null,
  primary key (ballot_id, candidate_id),
  foreign key (ballot_id, election_id) references ballots(id, election_id),
  foreign key (candidate_id, election_id) references candidates(id, election_id)
);
create index votes_tally_idx on votes(election_id, candidate_id);

-- ===== SUARA MANUAL (rekap per batch, tanpa kaitan ke individu) =====
create table manual_batches (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  label text not null,
  source_neighborhood_id uuid not null references neighborhoods(id),  -- RT asal kertas suara (untuk rekap RW)
  ballot_count int not null check (ballot_count >= 0),
  invalid_count int not null default 0 check (invalid_count >= 0),
  entered_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (election_id, label)
);
create table manual_vote_entries (
  batch_id uuid not null references manual_batches(id),
  election_id uuid not null,
  candidate_id uuid not null,
  votes int not null check (votes >= 0),
  primary key (batch_id, candidate_id),
  foreign key (candidate_id, election_id) references candidates(id, election_id)
);

-- ===== DOKUMEN, KOREKSI, PENGUMUMAN, PENGATURAN =====
create sequence berita_acara_seq;
create table berita_acara (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  nomor_seq bigint not null default nextval('berita_acara_seq'),
  nomor_dokumen text unique,               -- format menunggu keputusan panitia
  snapshot jsonb not null default '{}'::jsonb,
  locked_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create unique index berita_acara_one_per_election on berita_acara(election_id);

create table correction_requests (
  id uuid primary key default gen_random_uuid(),
  election_id uuid not null references elections(id),
  target_table text not null,
  target_id text,
  before_data jsonb, proposed_data jsonb,
  reason text not null check (length(trim(reason)) > 0),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  requested_by uuid not null references profiles(id),
  approved_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (approved_by is null or approved_by <> requested_by)   -- prinsip dua orang
);

create table announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text not null,
  is_published boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table settings (
  key text primary key,
  value jsonb not null default 'null'::jsonb,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create table audit_logs (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  entity text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- ===== TRIGGER: IMMUTABILITY =====
create function forbid_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'IMMUTABLE_RECORD' using errcode = 'P0001';
end $$;

create trigger ballots_immutable   before update or delete on ballots            for each row execute function forbid_mutation();
create trigger votes_immutable     before update or delete on votes              for each row execute function forbid_mutation();
create trigger particip_immutable  before update or delete on vote_participation for each row execute function forbid_mutation();
create trigger mbatch_immutable    before update or delete on manual_batches      for each row execute function forbid_mutation();
create trigger mentry_immutable    before update or delete on manual_vote_entries for each row execute function forbid_mutation();
create trigger audit_immutable     before update or delete on audit_logs          for each row execute function forbid_mutation();
create trigger ballots_notrunc  before truncate on ballots            for each statement execute function forbid_mutation();
create trigger votes_notrunc    before truncate on votes              for each statement execute function forbid_mutation();
create trigger particip_notrunc before truncate on vote_participation for each statement execute function forbid_mutation();
create trigger audit_notrunc    before truncate on audit_logs         for each statement execute function forbid_mutation();

-- ===== TRIGGER: AUDIT =====
create function audit_row_change() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare rid text;
begin
  rid := coalesce((to_jsonb(new)->>'id'), (to_jsonb(old)->>'id'), (to_jsonb(new)->>'key'), (to_jsonb(old)->>'key'));
  insert into audit_logs(actor, action, entity, entity_id, before_data, after_data)
  values (auth.uid(), tg_op, tg_table_name, rid,
          case when tg_op <> 'INSERT' then to_jsonb(old) - 'kk_hash' end,
          case when tg_op <> 'DELETE' then to_jsonb(new) - 'kk_hash' end);
  return coalesce(new, old);
end $$;

create trigger audit_elections  after insert or update or delete on elections          for each row execute function audit_row_change();
create trigger audit_schedules  after insert or update or delete on election_schedules for each row execute function audit_row_change();
create trigger audit_candidates after insert or update or delete on candidates         for each row execute function audit_row_change();
create trigger audit_profiles   after insert or update or delete on profiles           for each row execute function audit_row_change();
create trigger audit_settings   after insert or update or delete on settings           for each row execute function audit_row_change();
create trigger audit_ba         after insert or update or delete on berita_acara       for each row execute function audit_row_change();
create trigger audit_corrections after insert or update or delete on correction_requests for each row execute function audit_row_change();
create trigger audit_mbatches   after insert on manual_batches                          for each row execute function audit_row_change();

-- ===== TRIGGER: ATURAN BISNIS =====
create function elections_guard() returns trigger language plpgsql as $$
begin
  if old.status in ('SELESAI','DITETAPKAN') then
    if not (old.status = 'SELESAI' and new.status = 'DITETAPKAN'
            and (to_jsonb(new) - 'status' - 'locked_at') = (to_jsonb(old) - 'status' - 'locked_at')) then
      raise exception 'ELECTION_LOCKED' using errcode = 'P0001';
    end if;
  end if;
  if new.status = 'SELESAI' and old.status <> 'SELESAI' and new.locked_at is null then
    new.locked_at := now();
  end if;
  return new;
end $$;
create trigger elections_guard before update on elections for each row execute function elections_guard();

create function candidates_guard() returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare e elections%rowtype; v voters%rowtype;
begin
  select * into e from elections where id = coalesce(new.election_id, old.election_id);
  if tg_op = 'DELETE' then
    if e.status not in ('DRAFT','TERJADWAL','PERSIAPAN') then raise exception 'ELECTION_LOCKED' using errcode='P0001'; end if;
    return old;
  end if;
  if tg_op = 'INSERT' and e.status not in ('DRAFT','TERJADWAL','PERSIAPAN') then
    raise exception 'ELECTION_LOCKED' using errcode='P0001';
  end if;
  if tg_op = 'UPDATE' and e.status in ('SELESAI','DITETAPKAN') then
    raise exception 'ELECTION_LOCKED' using errcode='P0001';
  end if;
  select * into v from voters where id = new.voter_id;
  if e.type = 'RT' and v.neighborhood_id is distinct from e.neighborhood_id then
    raise exception 'CANDIDATE_WRONG_RT' using errcode='P0001';
  end if;
  return new;
end $$;
create trigger candidates_guard before insert or update or delete on candidates for each row execute function candidates_guard();

-- ===== HELPER RBAC =====
create function current_app_role() returns app_role language sql stable security definer
set search_path = public, pg_temp as $$
  select role from profiles where id = auth.uid() and is_active
$$;
create function current_app_rt() returns uuid language sql stable security definer
set search_path = public, pg_temp as $$
  select neighborhood_id from profiles where id = auth.uid() and is_active
$$;
create function has_role(variadic r app_role[]) returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select coalesce(current_app_role() = any(r), false)
$$;
create function can_see_rt(n uuid) returns boolean language sql stable security definer
set search_path = public, pg_temp as $$
  select case current_app_role()
    when 'SUPER_ADMIN' then true when 'PANITIA' then true when 'KOORDINATOR_RW' then true
    when 'KOORDINATOR_RT' then n is not null and n = current_app_rt()
    when 'OPERATOR' then current_app_rt() is null or n = current_app_rt()
    else false end
$$;
