#!/usr/bin/env bash
# Deploy ke production: ./deploy/deploy.sh (override HOST jika perlu)
set -euo pipefail
HOST=${HOST:-root@100.110.252.41}
SHA=$(git rev-parse --short HEAD)

[ -z "$(git status --porcelain)" ] || { echo "Working tree kotor. Selesaikan commit dulu."; exit 1; }

echo "==> 1. Membangun image Docker lokal: bugreport-app:$SHA"
docker build --network host -t bugreport-app:$SHA .

echo "==> 2. Mengirim image Docker ke server $HOST"
docker save bugreport-app:$SHA | gzip -1 | ssh $HOST 'gunzip | docker load'

echo "==> 3. Menjalankan backup dan menerapkan perubahan di server"
ssh $HOST "SHA=$SHA bash -s" <<'REMOTE'
set -euo pipefail

# Selalu backup DB dan data uploads sebelum tindakan apa pun
echo "==> Menjalankan backup rutin server..."
/opt/backups/backup-bugreport.sh </dev/null

cd /opt/stacks/bugreport
PREV=$(grep ^APP_TAG= .env | cut -d= -f2 || echo "none")
echo "Versi aplikasi saat ini: $PREV"

# Update tag aplikasi di .env
sed -i "s/^APP_TAG=.*/APP_TAG=$SHA/" .env

P="docker compose run --rm --no-deps app node_modules/.bin/prisma"

# Tandai baseline baru jika skema produksi sudah setara atau belum tercatat
echo "==> Menyelaraskan status migrasi Prisma..."
$P migrate resolve --applied 20261120000000_baseline </dev/null || true
$P migrate deploy </dev/null

echo "==> Merestart container app dengan versi baru ($SHA)..."
docker compose up -d app </dev/null
echo "==> Selesai. Container running:"
docker compose ps
REMOTE
