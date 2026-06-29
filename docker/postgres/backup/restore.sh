#!/bin/bash
set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file>"
    echo "Example: $0 storage/backups/backup_20260626_120000.sql.gz"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../../.."
BACKUP_FILE="$1"
if [[ "$BACKUP_FILE" != /* ]]; then
    if [ -f "$PROJECT_ROOT/$BACKUP_FILE" ]; then
        BACKUP_FILE="$PROJECT_ROOT/$BACKUP_FILE"
    else
        BACKUP_FILE="$SCRIPT_DIR/$BACKUP_FILE"
    fi
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "WARNING: This will overwrite the current database!"
echo "Backup file: $BACKUP_FILE"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

echo "Stopping application container..."
cd "$PROJECT_ROOT"
docker compose stop nodejs

echo "Restoring database..."
if [[ "$BACKUP_FILE" == *.gz ]]; then
    gunzip -c "$BACKUP_FILE" | docker exec -i buildingai-postgres psql -U postgres -d buildingai
else
    cat "$BACKUP_FILE" | docker exec -i buildingai-postgres psql -U postgres -d buildingai
fi

echo "Starting application container..."
docker compose start nodejs

echo "Restore process completed!"
