#!/usr/bin/env bash
# Uji asap: menjalankan build produksi terhadap PostgREST+PostgreSQL lokal lalu memeriksa halaman via HTTP.
# Prasyarat: database pemilu_it ada (jalankan tests/integration/run.sh dulu). Skrip ini membangun aplikasi sendiri.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
# Bersihkan sisa proses dari uji sebelumnya (pola berkurung agar tidak mencocokkan shell ini sendiri).
pkill -f '[n]ext-server' 2>/dev/null; pkill -f '[n]ext start' 2>/dev/null; pkill -f '[p]roxy.mjs' 2>/dev/null
as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
as_pg "pkill -f '[p]ostgrest'" >/dev/null 2>&1; sleep 1
as_pg "PGRST_DB_URI='postgres:///pemilu_it?host=/var/run/postgresql' PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET='uji-rahasia-jwt-minimal-32-karakter-panjang!!' PGRST_SERVER_PORT=3010 PGRST_SERVER_HOST=127.0.0.1 nohup ${PGRST_BIN:-/tmp/postgrest} > /tmp/postgrest.log 2>&1 &"
nohup node tests/integration/proxy.mjs > /tmp/proxy.log 2>&1 &
PROXY=$!
ANON=$(node tests/integration/mkjwt.mjs anon); SVC=$(node tests/integration/mkjwt.mjs service_role)
export NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3011 NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON SUPABASE_SERVICE_ROLE_KEY=$SVC KK_HMAC_PEPPER=uji-pepper-kk-minimal-32-karakter-panjang-ya
# NEXT_PUBLIC_* ditanam saat build, jadi build harus memakai kunci yang sama dengan saat dijalankan.
npx next build > /tmp/build.log 2>&1 || { echo "FAIL: build"; tail -20 /tmp/build.log; kill $PROXY 2>/dev/null; exit 1; }
nohup npx next start -p 3000 > /tmp/next.log 2>&1 &
NEXTP=$!
for i in $(seq 1 60); do [ "$(curl -s -m 2 -o /dev/null -w "%{http_code}" "localhost:3011/rest/v1/neighborhoods?select=id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON")" = 200 ] && break; sleep 0.5; done
for i in $(seq 1 60); do curl -s -m 2 -o /dev/null localhost:3000/login && break; sleep 0.5; done
if grep -q EADDRINUSE /tmp/next.log; then echo "FAIL: port 3000 masih dipakai proses lain"; exit 1; fi
FAIL=0
check() { # nama, perintah-yang-menghasilkan-output, pola
  if eval "$2" | sed 's/<!-- -->//g' | grep -qiE "$3"; then echo "PASS: $1"; else echo "FAIL: $1"; FAIL=1; fi
}
check "beranda memuat data pemilihan dari DB" "curl -s -m 10 localhost:3000/" "Sedang berlangsung: RT 03"
check "jadwal publik 200" "curl -s -m 10 -o /dev/null -w '%{http_code}' localhost:3000/jadwal" "^200$"
check "halaman pemilih RT 03 (terbuka) menampilkan form NKK" "curl -s -m 10 localhost:3000/pilih/rt03" "Nomor Kartu Keluarga \(16 digit\)"
check "RT yang belum dibuka tidak menampilkan form" "curl -s -m 10 localhost:3000/pilih/rt05" "belum dijadwalkan|belum dibuka"
check "database terhubung (API anon membaca RT)" "curl -s -m 10 \"localhost:3011/rest/v1/neighborhoods?select=code&order=code\" -H \"apikey: $ANON\" -H \"Authorization: Bearer $ANON\"" "RT 06"
check "RT 05 tidak memuat form NKK" "curl -s -m 10 localhost:3000/pilih/rt05 | grep -c 'Nomor Kartu Keluarga'" "^0$"
check "RT tidak dikenal 404" "curl -s -m 10 -o /dev/null -w '%{http_code}' localhost:3000/pilih/rt99" "^404$"
check "hasil publik 200" "curl -s -m 10 -o /dev/null -w '%{http_code}' localhost:3000/hasil" "^200$"
check "/admin tanpa login diarahkan ke /login" "curl -s -m 10 -o /dev/null -w '%{http_code} %{redirect_url}' localhost:3000/admin" "^307 .*/login\?next=(%2F|/)admin"
check "/admin/pemilih tanpa login diarahkan" "curl -s -m 10 -o /dev/null -w '%{http_code} %{redirect_url}' localhost:3000/admin/pemilih" "^307 .*/login"
check "ekspor pemilih tanpa login diarahkan" "curl -s -m 10 -o /dev/null -w '%{http_code} %{redirect_url}' localhost:3000/api/admin/export/pemilih" "^307 .*/login"
check "kode undangan tanpa login ditolak" "curl -s -m 10 -X POST -o /dev/null -w '%{http_code} %{redirect_url}' localhost:3000/api/admin/invite-codes" "^307 .*/login"
check "header X-Frame-Options" "curl -sI -m 10 localhost:3000/" "x-frame-options: DENY"
check "header nosniff" "curl -sI -m 10 localhost:3000/" "x-content-type-options: nosniff"
check "header HSTS" "curl -sI -m 10 localhost:3000/" "strict-transport-security"
check "tidak ada X-Powered-By" "curl -sI -m 10 localhost:3000/ | grep -ci x-powered-by" "^0$"
check "manifest PWA" "curl -s -m 10 localhost:3000/manifest.webmanifest" "PEMILU WARGA RW 09"
LEAK=0; for p in / /jadwal /hasil /pilih/rt03 /login; do n=$(curl -s -m 10 localhost:3000$p | grep -ciE "service_role|SUPABASE_SERVICE|PEPPER|kk_hash|eyJhbGci"); LEAK=$((LEAK+n)); done
check "tidak ada rahasia/kunci/hash di HTML publik" "echo $LEAK" "^0$"
# bundel JavaScript untuk browser tidak boleh memuat kunci service_role maupun pepper
SVC_PART=$(echo "$SVC" | cut -d. -f2)
JSLEAK=$(grep -rlE "$SVC_PART|uji-pepper-kk" .next/static 2>/dev/null | wc -l)
check "bundel browser bebas kunci service_role & pepper" "echo $JSLEAK" "^0$"
if [ -n "$DEBUG" ]; then
  echo "=== TEKS /"; curl -s -m 10 localhost:3000/ | perl -0pe 's/<script.*?<\/script>//gs; s/<style.*?<\/style>//gs; s/<[^>]+>/ /g; s/\s+/ /g' | head -c 900; echo
  echo "=== TEKS /pilih/rt03"; curl -s -m 10 localhost:3000/pilih/rt03 | perl -0pe 's/<script.*?<\/script>//gs; s/<style.*?<\/style>//gs; s/<[^>]+>/ /g; s/\s+/ /g' | head -c 700; echo
  echo "=== LOG NEXT"; tail -15 /tmp/next.log
fi
kill $NEXTP $PROXY 2>/dev/null; pkill -f '[n]ext-server' 2>/dev/null; as_pg "pkill -f '[p]ostgrest'" >/dev/null 2>&1
exit $FAIL
