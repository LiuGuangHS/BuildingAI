#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../../.."
BACKUPS_DIR="$PROJECT_ROOT/storage/backups"

mkdir -p "$BACKUPS_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUPS_DIR/backup_${TIMESTAMP}.sql.gz"

echo "Starting PostgreSQL backup..."
echo "Backup file: $BACKUP_FILE"

cd "$PROJECT_ROOT"
docker exec buildingai-postgres pg_dump -U postgres -d buildingai | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "Backup completed successfully!"
    echo "File size: $(du -h "$BACKUP_FILE" | cut -f1)"

    find "$BACKUPS_DIR" -name "backup_*.sql.gz" -mtime +7 -delete
    echo "Old backups (older than 7 days) cleaned up."
else
    echo "Backup failed!"
    exit 1
fi
