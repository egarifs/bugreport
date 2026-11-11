#!/usr/bin/env bash
# Deploy from laptop: ./deploy/deploy.sh   (HOST override: HOST=root@x ./deploy/deploy.sh)
# Production schema was created with `db push` (no _prisma_migrations). First run baselines the
# 3 migrations that already match prod, then `migrate deploy` applies the rest. Tested on a prod dump copy.
set -euo pipefail
HOST=${HOST:-root@100.110.252.41}
SHA=$(git rev-parse --short HEAD)
[ -z "$(git status --porcelain)" ] || { echo "working tree kotor"; exit 1; }
docker build --network host -t bugreport-app:$SHA .
docker save bugreport-app:$SHA | gzip -1 | ssh $HOST 'gunzip | docker load'
ssh $HOST "SHA=$SHA bash -s" <<'REMOTE'
set -euo pipefail
/opt/backups/backup-bugreport.sh </dev/null
cd /opt/stacks/bugreport
PREV=$(grep ^APP_TAG= .env | cut -d= -f2); echo "prev tag: $PREV"
sed -i "s/^APP_TAG=.*/APP_TAG=$SHA/" .env
P="docker compose run --rm --no-deps app node_modules/.bin/prisma"
HAS=$(echo "select to_regclass('_prisma_migrations')" | docker compose exec -T db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA')
if [ -z "$HAS" ]; then
  for m in 20261026075205_init 20261104085000_add_project_is_test 20261108090000_bug_fix_verify_due; do $P migrate resolve --applied $m </dev/null; done
fi
$P migrate deploy </dev/null
docker compose up -d app </dev/null
REMOTE
