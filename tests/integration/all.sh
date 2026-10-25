#!/usr/bin/env bash
# Menyalakan PostgreSQL bila perlu, lalu: uji integrasi (layanan -> API) dan uji asap (build produksi via HTTP).
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"; cd "$ROOT"
if ! pg_lsclusters 2>/dev/null | grep -q online; then pg_ctlcluster 16 main start 2>/dev/null; sleep 3; fi
bash tests/integration/run.sh; A=$?
bash tests/integration/smoke.sh; B=$?
echo "integrasi=$A asap=$B"; exit $((A+B))
