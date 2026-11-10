[CmdletBinding()]
param(
  [string]$Database = $env:PGDATABASE,
  [string]$OutputDirectory,
  [int]$RetentionDays = 14
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($Database)) {
  throw 'Database is required. Set PGDATABASE or pass -Database.'
}
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
  $OutputDirectory = Join-Path $PSScriptRoot '..\backups'
}

$pgDump = $null
if ($env:PG_BIN) {
  $candidate = Join-Path $env:PG_BIN 'pg_dump.exe'
  if (Test-Path $candidate) { $pgDump = $candidate }
}
if (-not $pgDump) {
  $command = Get-Command pg_dump.exe -ErrorAction SilentlyContinue
  if ($command) { $pgDump = $command.Source }
}
if (-not $pgDump) {
  throw 'pg_dump.exe was not found. Set PG_BIN or add PostgreSQL bin to PATH.'
}

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$output = Join-Path $OutputDirectory "${Database}_${timestamp}.dump"

& $pgDump --format=custom --no-owner --no-privileges --file=$output --dbname=$Database
if ($LASTEXITCODE -ne 0) {
  if (Test-Path $output) { Remove-Item -LiteralPath $output -Force }
  throw "pg_dump failed with exit code $LASTEXITCODE."
}

$cutoff = (Get-Date).AddDays(-[Math]::Max(1, $RetentionDays))
Get-ChildItem -LiteralPath $OutputDirectory -Filter "$Database`_*.dump" -File |
  Where-Object LastWriteTime -lt $cutoff |
  Remove-Item -Force

$size = (Get-Item -LiteralPath $output).Length
if ($size -le 0) {
  Remove-Item -LiteralPath $output -Force
  throw "Backup was created empty: $output"
}

[pscustomobject]@{
  database = $Database
  file = $output
  sizeBytes = $size
  createdAt = (Get-Date).ToString('o')
  retentionDays = $RetentionDays
} | ConvertTo-Json
