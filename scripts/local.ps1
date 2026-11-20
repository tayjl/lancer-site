# Starts the local test site: Docker, the local database, then the dev server on http://localhost:5174.
# Run with: npm run local
$ErrorActionPreference = 'Stop'

# 1. Docker Desktop (installed per user, not in Program Files)
docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Starting Docker Desktop...'
  Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
  $waited = 0
  do {
    Start-Sleep -Seconds 3
    $waited += 3
    docker info *> $null
  } while ($LASTEXITCODE -ne 0 -and $waited -lt 180)
  if ($LASTEXITCODE -ne 0) { throw 'Docker did not start within 3 minutes.' }
}

# 2. The local database. The first try can fail with "db container is not ready", so try twice.
npx supabase start
if ($LASTEXITCODE -ne 0) { npx supabase start }
if ($LASTEXITCODE -ne 0) { throw 'Local Supabase did not start.' }

# 3. Apply any new migrations without wiping test data.
npx supabase migration up
if ($LASTEXITCODE -ne 0) { throw 'Migrations failed.' }

# 4. The dev server (Ctrl+C stops it; the database keeps running).
npm run dev -- --mode localdb --port 5174
