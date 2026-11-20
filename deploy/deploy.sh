#!/usr/bin/env bash
# Deploy ke production via SSH agent forwarding: ./deploy/deploy.sh
# Build langsung di server remote untuk menghindari transfer image 1.2GB via koneksi lambat.
set -euo pipefail
HOST=${HOST:-root@100.110.252.41}
SHA=$(git rev-parse --short HEAD)

[ -z "$(git status --porcelain)" ] || { echo "Working tree kotor. Selesaikan commit dulu."; exit 1; }

echo "==> Deploying commit $SHA to $HOST..."

ssh -A $HOST "SHA=$SHA bash -s" <<'REMOTE'
set -euo pipefail

echo "==> 1. Menjalankan backup database server..."
/opt/backups/backup-bugreport.sh </dev/null

BUILD_DIR="/tmp/bugreport-build"
rm -rf "$BUILD_DIR"
echo "==> 2. Fetch kode terbaru dari GitHub..."
git clone --depth 1 -b main git@github.com:egarifs/bugreport.git "$BUILD_DIR"

cd "$BUILD_DIR"
echo "==> 3. Membangun image Docker di server..."
docker build -t bugreport-app:$SHA .

cd /opt/stacks/bugreport
PREV=$(grep ^APP_TAG= .env | cut -d= -f2 || echo "none")
echo "Versi aplikasi sebelumnya: $PREV"

sed -i "s/^APP_TAG=.*/APP_TAG=$SHA/" .env

P="docker compose run --rm --no-deps app node_modules/.bin/prisma"

echo "==> 4. Menyelaraskan status migrasi Prisma baseline..."
$P migrate resolve --applied 20261120000000_baseline </dev/null || true
$P migrate deploy </dev/null

echo "==> 5. Restart container app dengan versi baru ($SHA)..."
docker compose up -d app </dev/null

echo "==> 6. Membersihkan build cache..."
rm -rf "$BUILD_DIR"

echo "==> Selesai. Container running:"
docker compose ps
REMOTE
