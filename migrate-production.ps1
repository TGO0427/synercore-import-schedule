# Migration script for Railway production database
# Uses the public DATABASE_URL to run migrations from local machine

$env:DATABASE_URL = "postgresql://postgres:ZQgwgMMOECtDFlIrCbSmGeSLESMjxXBF@centerbeam.proxy.rlwy.net:33680/railway"

Write-Host "Running database migrations on Railway production..." -ForegroundColor Cyan
npm run setup:db

Write-Host ""
Write-Host "Migration complete!" -ForegroundColor Green
