#!/usr/bin/env bash
# Menjalankan seluruh pengujian pada database lokal sekali pakai. Butuh PostgreSQL 16 dan akses postgres.
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
PSQL="psql -q -v ON_ERROR_STOP=1 -X"
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
as_pg "psql -qX -c 'drop database if exists pemilu_test' -c 'create database pemilu_test'" >/dev/null
for f in tests/00_supabase_shim.sql migrations/0001_core_schema.sql migrations/0002_voting_functions.sql migrations/0003_rls_and_seed.sql migrations/0004_operations.sql tests/01_fixtures.sql tests/02_tests.sql tests/04_ops_tests.sql; do
  as_pg "$PSQL -d pemilu_test -f $DIR/$f" 2>&1 | grep -E "PASS|FAIL|ERROR" || true
done

# ===== UJI KONKURENSI: 12 koneksi paralel memakai Nomor KK yang sama =====
as_pg "psql -qX -c 'drop database if exists pemilu_race' -c 'create database pemilu_race'" >/dev/null
for f in tests/00_supabase_shim.sql migrations/0001_core_schema.sql migrations/0002_voting_functions.sql migrations/0003_rls_and_seed.sql migrations/0004_operations.sql tests/01_fixtures.sql; do
  as_pg "$PSQL -d pemilu_race -f $DIR/$f" >/dev/null 2>&1
done
OUT=$(seq 12 | xargs -P12 -I{} su postgres -c "psql -qX -d pemilu_race -f $DIR/tests/03_race_attempt.sql" 2>&1 | grep -o 'RESULT:.*' | sort | uniq -c || true)
echo "$OUT"
OKS=$(echo "$OUT" | grep -E 'RESULT:OK' | awk '{print $1}' || true)
PART=$(as_pg "psql -qXtA -d pemilu_race -c \"select count(*) from vote_participation where voter_id=t.id('vF') and election_id=t.id('eRT3')\"")
VOTES=$(as_pg "psql -qXtA -d pemilu_race -c \"select count(*) from votes where election_id=t.id('eRT3')\"")
echo "berhasil=$OKS partisipasi=$PART suara_tercatat=$VOTES"
if echo "$OUT" | grep -qi deadlock; then echo "FAIL: R1 terjadi deadlock"; exit 1; fi
if [ "${OKS:-0}" = "1" ] && [ "$PART" = "1" ] && [ "$VOTES" = "1" ]; then echo "PASS: R1 hanya 1 dari 12 percobaan paralel yang berhasil"; else echo "FAIL: R1 uji konkurensi"; exit 1; fi
