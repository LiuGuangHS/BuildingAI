$ErrorActionPreference = "Stop"

$backupDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupsDir = Join-Path $backupDir "backups"

if (-not (Test-Path $backupsDir)) {
    New-Item -ItemType Directory -Path $backupsDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $backupsDir "backup_$timestamp.sql"

Write-Host "Starting PostgreSQL backup..."
Write-Host "Backup file: $backupFile"

docker exec buildingai-postgres pg_dump -U postgres -d buildingai | Out-File -FilePath $backupFile -Encoding utf8

if ($LASTEXITCODE -eq 0) {
    Write-Host "Backup completed successfully!"
    Write-Host "File size: $((Get-Item $backupFile).Length / 1MB -as [int]) MB"

    $cutoffDate = (Get-Date).AddDays(-7)
    Get-ChildItem -Path $backupsDir -Filter "backup_*.sql" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | ForEach-Object {
        Write-Host "Removing old backup: $($_.Name)"
        Remove-Item $_.FullName -Force
    }

    Write-Host "Old backups (older than 7 days) cleaned up."
} else {
    Write-Host "Backup failed!"
    exit 1
}
