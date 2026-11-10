$ErrorActionPreference = "Stop"
$base = "C:\Users\hp\Desktop\exp\pg-xerp\sql"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$base\_batch-generate.ps1" 2>&1 | Select-Object -Last 16
