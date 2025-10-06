@echo off
REM Migration script for Railway production database
REM Uses the public DATABASE_URL to run migrations from local machine

SET DATABASE_URL=postgresql://postgres:ZQgwgMMOECtDFlIrCbSmGeSLESMjxXBF@centerbeam.proxy.rlwy.net:33680/railway

echo Running database migrations on Railway production...
npm run setup:db

echo.
echo Migration complete!
pause
