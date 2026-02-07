# =============================================================================
# OpenSalesAI — Database Migration Script (PowerShell)
# =============================================================================
# Usage:
#   .\scripts\migrate.ps1                    # Run pending migrations
#   .\scripts\migrate.ps1 -Reset             # Reset database + run all migrations
#   .\scripts\migrate.ps1 -Seed              # Run migrations + seed demo data
#   .\scripts\migrate.ps1 -Status            # Show migration status
#   .\scripts\migrate.ps1 -Generate "name"   # Generate new migration with name
#   .\scripts\migrate.ps1 -Deploy            # Deploy migrations (production)
# =============================================================================

param(
    [switch]$Reset,
    [switch]$Seed,
    [switch]$Status,
    [switch]$Deploy,
    [string]$Generate = "",
    [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PrismaSchema = Join-Path $ProjectRoot "services" "api-gateway" "prisma" "schema.prisma"
$SeedScript = Join-Path $ProjectRoot "scripts" "seed-demo.ts"
$EnvFilePath = Join-Path $ProjectRoot $EnvFile

# ---------------------------------------------------------------------------
# Colors and formatting
# ---------------------------------------------------------------------------
function Write-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "=============================================================" -ForegroundColor Cyan
    Write-Host "  $Message" -ForegroundColor Cyan
    Write-Host "=============================================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step {
    param([string]$Step, [string]$Message)
    Write-Host "[$Step] " -ForegroundColor Yellow -NoNewline
    Write-Host $Message -ForegroundColor White
}

function Write-Success {
    param([string]$Message)
    Write-Host "  OK: " -ForegroundColor Green -NoNewline
    Write-Host $Message
}

function Write-Fail {
    param([string]$Message)
    Write-Host "  FAIL: " -ForegroundColor Red -NoNewline
    Write-Host $Message
}

# ---------------------------------------------------------------------------
# Validate prerequisites
# ---------------------------------------------------------------------------
function Test-Prerequisites {
    Write-Step "PRE" "Checking prerequisites..."

    # Check Node.js
    try {
        $nodeVersion = & node --version 2>&1
        Write-Success "Node.js $nodeVersion"
    } catch {
        Write-Fail "Node.js not found. Install from https://nodejs.org/"
        exit 1
    }

    # Check npm
    try {
        $npmVersion = & npm --version 2>&1
        Write-Success "npm $npmVersion"
    } catch {
        Write-Fail "npm not found."
        exit 1
    }

    # Check npx
    try {
        $npxVersion = & npx --version 2>&1
        Write-Success "npx $npxVersion"
    } catch {
        Write-Fail "npx not found."
        exit 1
    }

    # Check Prisma schema exists
    if (Test-Path $PrismaSchema) {
        Write-Success "Prisma schema found at $PrismaSchema"
    } else {
        Write-Fail "Prisma schema not found at $PrismaSchema"
        exit 1
    }

    # Check .env file
    if (Test-Path $EnvFilePath) {
        Write-Success ".env file found at $EnvFilePath"
    } else {
        Write-Host "  WARN: " -ForegroundColor Yellow -NoNewline
        Write-Host ".env file not found. Checking for DATABASE_URL environment variable..."

        if ($env:DATABASE_URL) {
            Write-Success "DATABASE_URL found in environment"
        } else {
            Write-Fail "No .env file and no DATABASE_URL set. Copy .env.example to .env first."
            exit 1
        }
    }

    Write-Host ""
}

# ---------------------------------------------------------------------------
# Load environment variables from .env
# ---------------------------------------------------------------------------
function Import-EnvFile {
    if (Test-Path $EnvFilePath) {
        Write-Step "ENV" "Loading environment from $EnvFile..."
        Get-Content $EnvFilePath | ForEach-Object {
            $line = $_.Trim()
            # Skip comments and empty lines
            if ($line -and -not $line.StartsWith("#")) {
                $parts = $line -split "=", 2
                if ($parts.Count -eq 2) {
                    $key = $parts[0].Trim()
                    $value = $parts[1].Trim()
                    # Remove surrounding quotes if present
                    $value = $value -replace '^["'']|["'']$', ''
                    [System.Environment]::SetEnvironmentVariable($key, $value, "Process")
                }
            }
        }
        Write-Success "Environment loaded."
        Write-Host ""
    }
}

# ---------------------------------------------------------------------------
# Check database connectivity
# ---------------------------------------------------------------------------
function Test-Database {
    Write-Step "DB" "Testing database connectivity..."

    $dbUrl = $env:DATABASE_URL
    if (-not $dbUrl) {
        Write-Fail "DATABASE_URL is not set."
        exit 1
    }

    # Mask password in output
    $maskedUrl = $dbUrl -replace '://([^:]+):([^@]+)@', '://$1:****@'
    Write-Host "  Connection: $maskedUrl" -ForegroundColor DarkGray

    # Try a simple Prisma command to verify connectivity
    try {
        Push-Location $ProjectRoot
        $result = & npx prisma db execute --schema $PrismaSchema --stdin 2>&1 <<< "SELECT 1;"
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Database is reachable."
        } else {
            Write-Host "  WARN: " -ForegroundColor Yellow -NoNewline
            Write-Host "Could not verify database connectivity. Proceeding anyway..."
        }
        Pop-Location
    } catch {
        Write-Host "  WARN: " -ForegroundColor Yellow -NoNewline
        Write-Host "Could not verify database connectivity. Proceeding anyway..."
    }
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Install Prisma if needed
# ---------------------------------------------------------------------------
function Install-PrismaDeps {
    Write-Step "DEPS" "Ensuring Prisma dependencies are installed..."

    Push-Location $ProjectRoot

    # Check if node_modules exists
    if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
        Write-Host "  Installing npm dependencies..." -ForegroundColor DarkGray
        & npm install
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "npm install failed."
            Pop-Location
            exit 1
        }
    }

    # Ensure Prisma CLI is available
    try {
        & npx prisma --version | Out-Null
        Write-Success "Prisma CLI available."
    } catch {
        Write-Host "  Installing Prisma CLI..." -ForegroundColor DarkGray
        & npm install prisma @prisma/client
        if ($LASTEXITCODE -ne 0) {
            Write-Fail "Failed to install Prisma."
            Pop-Location
            exit 1
        }
    }

    Pop-Location
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Generate Prisma Client
# ---------------------------------------------------------------------------
function Invoke-PrismaGenerate {
    Write-Step "GEN" "Generating Prisma Client..."

    Push-Location $ProjectRoot
    & npx prisma generate --schema $PrismaSchema
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Prisma generate failed."
        Pop-Location
        exit 1
    }
    Write-Success "Prisma Client generated."
    Pop-Location
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Migration commands
# ---------------------------------------------------------------------------

# Run pending migrations (development)
function Invoke-MigrateDev {
    param([string]$MigrationName = "")

    Write-Header "Running Prisma Migrations (Development)"

    $args = @("prisma", "migrate", "dev", "--schema", $PrismaSchema)
    if ($MigrationName) {
        $args += "--name"
        $args += $MigrationName
    }

    Push-Location $ProjectRoot
    & npx @args
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Migration failed."
        Pop-Location
        exit 1
    }
    Write-Success "Migrations applied successfully."
    Pop-Location
}

# Deploy migrations (production)
function Invoke-MigrateDeploy {
    Write-Header "Deploying Prisma Migrations (Production)"

    Push-Location $ProjectRoot
    & npx prisma migrate deploy --schema $PrismaSchema
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Migration deploy failed."
        Pop-Location
        exit 1
    }
    Write-Success "Migrations deployed successfully."
    Pop-Location
}

# Reset database
function Invoke-MigrateReset {
    Write-Header "Resetting Database"

    Write-Host "  WARNING: This will DROP all data and re-run migrations!" -ForegroundColor Red
    $confirm = Read-Host "  Type 'yes' to confirm"

    if ($confirm -ne "yes") {
        Write-Host "  Aborted." -ForegroundColor Yellow
        return
    }

    Push-Location $ProjectRoot
    & npx prisma migrate reset --schema $PrismaSchema --force
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Database reset failed."
        Pop-Location
        exit 1
    }
    Write-Success "Database reset complete."
    Pop-Location
}

# Show migration status
function Get-MigrationStatus {
    Write-Header "Migration Status"

    Push-Location $ProjectRoot
    & npx prisma migrate status --schema $PrismaSchema
    Pop-Location
}

# Generate new migration
function New-Migration {
    param([string]$Name)

    if (-not $Name) {
        Write-Fail "Migration name required. Usage: .\migrate.ps1 -Generate 'migration_name'"
        exit 1
    }

    Write-Header "Creating New Migration: $Name"

    Push-Location $ProjectRoot
    & npx prisma migrate dev --schema $PrismaSchema --name $Name --create-only
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Migration generation failed."
        Pop-Location
        exit 1
    }
    Write-Success "Migration '$Name' created. Review the SQL before applying."
    Pop-Location
}

# Seed database
function Invoke-Seed {
    Write-Header "Seeding Demo Data"

    $tsNodePath = Join-Path $ProjectRoot "node_modules" ".bin" "tsx"
    $tsNodePathAlt = Join-Path $ProjectRoot "node_modules" ".bin" "ts-node"

    Push-Location $ProjectRoot

    if (Test-Path $tsNodePath) {
        Write-Step "SEED" "Running seed with tsx..."
        & npx tsx $SeedScript
    } elseif (Test-Path $tsNodePathAlt) {
        Write-Step "SEED" "Running seed with ts-node..."
        & npx ts-node $SeedScript
    } else {
        Write-Step "SEED" "Installing tsx and running seed..."
        & npx tsx $SeedScript
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Fail "Seeding failed."
        Pop-Location
        exit 1
    }
    Write-Success "Demo data seeded successfully."
    Pop-Location
}

# ---------------------------------------------------------------------------
# Post-migration: Add custom indexes (BRIN, GiST)
# ---------------------------------------------------------------------------
function Invoke-CustomIndexes {
    Write-Step "IDX" "Applying custom PostgreSQL indexes (BRIN, GiST)..."

    $sql = @"
-- BRIN indexes for time-range queries (much more efficient than btree for append-only date columns)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_date_brin ON transactions USING BRIN (transaction_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_date_brin ON tasks USING BRIN (task_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_checkin_brin ON visits USING BRIN (check_in_time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_predictions_date_brin ON predictions USING BRIN (prediction_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_eb2b_created_brin ON orders_eb2b USING BRIN (created_at);

-- Point-based spatial indexing for GPS coordinates (enables efficient proximity queries)
-- Note: Requires the btree_gist extension for combined indexes
CREATE EXTENSION IF NOT EXISTS btree_gist;
"@

    Push-Location $ProjectRoot
    try {
        $sql | & npx prisma db execute --schema $PrismaSchema --stdin 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Custom indexes created."
        } else {
            Write-Host "  WARN: " -ForegroundColor Yellow -NoNewline
            Write-Host "Some custom indexes may have failed. Check database manually."
        }
    } catch {
        Write-Host "  WARN: " -ForegroundColor Yellow -NoNewline
        Write-Host "Custom index creation skipped: $_"
    }
    Pop-Location
    Write-Host ""
}

# ---------------------------------------------------------------------------
# Main execution
# ---------------------------------------------------------------------------
Write-Header "OpenSalesAI Database Migration Tool"

Test-Prerequisites
Import-EnvFile
Install-PrismaDeps

if ($Status) {
    Get-MigrationStatus
    exit 0
}

if ($Generate) {
    New-Migration -Name $Generate
    exit 0
}

if ($Reset) {
    Invoke-MigrateReset
    Invoke-PrismaGenerate
    Invoke-CustomIndexes
    if ($Seed) {
        Invoke-Seed
    }
    exit 0
}

if ($Deploy) {
    Invoke-MigrateDeploy
    Invoke-PrismaGenerate
    Invoke-CustomIndexes
    exit 0
}

# Default: run development migrations
Invoke-MigrateDev
Invoke-PrismaGenerate
Invoke-CustomIndexes

if ($Seed) {
    Invoke-Seed
}

Write-Header "Migration Complete"
Write-Host "  Next steps:" -ForegroundColor White
Write-Host "    1. Start infrastructure:  docker compose -f docker-compose.infra.yml up -d" -ForegroundColor DarkGray
Write-Host "    2. Run seed (if needed):  .\scripts\migrate.ps1 -Seed" -ForegroundColor DarkGray
Write-Host "    3. Start dev servers:     npm run dev" -ForegroundColor DarkGray
Write-Host ""
