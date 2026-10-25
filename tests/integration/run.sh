#!/usr/bin/env bash
# Uji integrasi: layanan aplikasi terhadap PostgREST + PostgreSQL lokal (meniru jalur API Supabase).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGRST_BIN="${PGRST_BIN:-/tmp/postgrest}"
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
as_pg "pkill -f postgrest || true" >/dev/null 2>&1 || true
sleep 1
as_pg "psql -qX -c \"select pg_terminate_backend(pid) from pg_stat_activity where datname='pemilu_it'\"" >/dev/null 2>&1 || true
as_pg "psql -qX -c 'drop database if exists pemilu_it' -c 'create database pemilu_it'" >/dev/null
for f in supabase/tests/00_supabase_shim.sql supabase/migrations/0001_core_schema.sql supabase/migrations/0002_voting_functions.sql supabase/migrations/0003_rls_and_seed.sql supabase/migrations/0004_operations.sql tests/integration/seed.sql; do
  as_pg "psql -qX -v ON_ERROR_STOP=1 -d pemilu_it -f $ROOT/$f" >/dev/null
done
as_pg "PGRST_DB_URI='postgres:///pemilu_it?host=/var/run/postgresql' PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET='uji-rahasia-jwt-minimal-32-karakter-panjang!!' PGRST_SERVER_PORT=3010 PGRST_SERVER_HOST=127.0.0.1 nohup $PGRST_BIN > /tmp/postgrest.log 2>&1 &"
for i in $(seq 1 30); do curl -s -o /dev/null http://127.0.0.1:3010/ && break; sleep 0.5; done
cd "$ROOT"
set +e
KK_HMAC_PEPPER='uji-pepper-kk-minimal-32-karakter-panjang-ya' npx vitest run --config vitest.integration.config.ts
RC=$?
as_pg "pkill -f 'postgrest' || true" >/dev/null 2>&1 || true
exit $RC
