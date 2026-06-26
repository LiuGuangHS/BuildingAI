param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

$ErrorActionPreference = "Stop"

$backupDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupFilePath = Join-Path $backupDir $BackupFile

if (-not (Test-Path $backupFilePath)) {
    Write-Host "Error: Backup file not found: $backupFilePath"
    exit 1
}

Write-Host "WARNING: This will overwrite the current database!"
Write-Host "Backup file: $backupFilePath"
$confirm = Read-Host "Are you sure you want to continue? (y/N)"
if ($confirm -notmatch "^[Yy]$") {
    Write-Host "Restore cancelled."
    exit 0
}

Write-Host "Stopping application container..."
docker compose stop nodejs

Write-Host "Restoring database..."
Get-Content $backupFilePath | docker exec -i buildingai-postgres psql -U postgres -d buildingai

if ($LASTEXITCODE -eq 0) {
    Write-Host "Database restored successfully!"
} else {
    Write-Host "Restore failed!"
    exit 1
}

Write-Host "Starting application container..."
docker compose start nodejs

Write-Host "Restore process completed!"
