#!/bin/bash
# Daily pg_dump + uploads tar. Install: /opt/backups/backup-bugreport.sh, cron /etc/cron.d/bugreport-backup
# ponytail: local-only copies, 7-day retention; add off-server encrypted copy per hardening taskboard.
set -euo pipefail
cd /opt/stacks/bugreport
DIR=/opt/backups/bugreport; TS=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$DIR"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip -9 > "$DIR/db-$TS.sql.gz.part"
mv "$DIR/db-$TS.sql.gz.part" "$DIR/db-$TS.sql.gz"
docker compose exec -T app tar czf - -C /app uploads > "$DIR/uploads-$TS.tar.gz"
find "$DIR" -name '*.gz' -mtime +7 -delete
echo "[$TS] ok $(du -h "$DIR/db-$TS.sql.gz" | cut -f1)"
