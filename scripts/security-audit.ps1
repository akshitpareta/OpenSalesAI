<#
.SYNOPSIS
    Security audit script for OpenSalesAI codebase.

.DESCRIPTION
    Scans the codebase for common security issues:
      1. Hardcoded secrets (API keys, passwords, tokens)
      2. Raw SQL strings (must use Prisma / SQLAlchemy)
      3. Unsafe React patterns (dangerouslySetInnerHTML)
      4. Missing auth middleware on API routes
      5. PII leakage in LLM prompts
      6. Insecure dependencies patterns

.NOTES
    Run from the project root:
      powershell -ExecutionPolicy Bypass -File scripts/security-audit.ps1
#>

param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [switch]$Verbose,
    [switch]$FailOnIssues
)

# ── Configuration ────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Continue"
$script:TotalIssues = 0
$script:CriticalIssues = 0
$script:WarningIssues = 0
$script:InfoIssues = 0

# Directories to scan
$SourceDirs = @(
    "apps",
    "services",
    "packages",
    "scripts"
)

# Files/directories to skip
$ExcludePatterns = @(
    "node_modules",
    ".next",
    "dist",
    "build",
    "__pycache__",
    ".git",
    "coverage",
    ".turbo",
    "*.min.js",
    "*.map",
    "*.lock",
    "package-lock.json",
    "pnpm-lock.yaml"
)

# File extensions to scan
$CodeExtensions = @("*.ts", "*.tsx", "*.js", "*.jsx", "*.py", "*.json", "*.yml", "*.yaml", "*.env")

# ── Helpers ──────────────────────────────────────────────────────────────────────

function Write-Finding {
    param(
        [string]$Severity,    # CRITICAL, WARNING, INFO
        [string]$Category,
        [string]$Message,
        [string]$FilePath = "",
        [int]$LineNumber = 0,
        [string]$LineContent = ""
    )

    $script:TotalIssues++
    switch ($Severity) {
        "CRITICAL" { $script:CriticalIssues++; $color = "Red" }
        "WARNING"  { $script:WarningIssues++;  $color = "Yellow" }
        "INFO"     { $script:InfoIssues++;      $color = "Cyan" }
        default    { $color = "White" }
    }

    $locationInfo = ""
    if ($FilePath) {
        $relativePath = $FilePath.Replace($ProjectRoot, "").TrimStart("\", "/")
        $locationInfo = " | $relativePath"
        if ($LineNumber -gt 0) {
            $locationInfo += ":$LineNumber"
        }
    }

    Write-Host "  [$Severity] " -ForegroundColor $color -NoNewline
    Write-Host "$Category$locationInfo" -ForegroundColor White
    Write-Host "    $Message" -ForegroundColor Gray

    if ($LineContent -and $Verbose) {
        $trimmedLine = $LineContent.Trim()
        if ($trimmedLine.Length -gt 120) {
            $trimmedLine = $trimmedLine.Substring(0, 117) + "..."
        }
        Write-Host "    > $trimmedLine" -ForegroundColor DarkGray
    }
}

function Get-SourceFiles {
    param(
        [string]$Directory,
        [string[]]$Extensions
    )

    $files = @()
    foreach ($ext in $Extensions) {
        $found = Get-ChildItem -Path $Directory -Filter $ext -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object {
                $path = $_.FullName
                $exclude = $false
                foreach ($pattern in $ExcludePatterns) {
                    if ($path -match [regex]::Escape($pattern)) {
                        $exclude = $true
                        break
                    }
                }
                -not $exclude
            }
        $files += $found
    }
    return $files
}

function Search-FileForPattern {
    param(
        [System.IO.FileInfo]$File,
        [string]$Pattern,
        [string]$Severity,
        [string]$Category,
        [string]$Message
    )

    try {
        $lines = Get-Content -Path $File.FullName -ErrorAction Stop
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match $Pattern) {
                Write-Finding `
                    -Severity $Severity `
                    -Category $Category `
                    -Message $Message `
                    -FilePath $File.FullName `
                    -LineNumber ($i + 1) `
                    -LineContent $lines[$i]
            }
        }
    } catch {
        # Skip binary or unreadable files
    }
}

# ── Banner ───────────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  OpenSalesAI Security Audit" -ForegroundColor Cyan
Write-Host "  Project Root: $ProjectRoot" -ForegroundColor Gray
Write-Host "  Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ── Check 1: Hardcoded Secrets ───────────────────────────────────────────────────

Write-Host "[1/6] Scanning for hardcoded secrets..." -ForegroundColor Yellow
Write-Host ""

$secretPatterns = @(
    @{
        Pattern  = '(?i)(api[_-]?key|apikey)\s*[:=]\s*["\x27][A-Za-z0-9_\-]{16,}["\x27]'
        Message  = "Potential hardcoded API key found. Use environment variables instead."
        Severity = "CRITICAL"
    },
    @{
        Pattern  = '(?i)(password|passwd|pwd)\s*[:=]\s*["\x27][^\x27"]{4,}["\x27]'
        Message  = "Potential hardcoded password found. Use environment variables instead."
        Severity = "CRITICAL"
    },
    @{
        Pattern  = '(?i)(secret|token|auth)\s*[:=]\s*["\x27][A-Za-z0-9_\-/+=]{16,}["\x27]'
        Message  = "Potential hardcoded secret or token found. Use environment variables instead."
        Severity = "CRITICAL"
    },
    @{
        Pattern  = '(?i)sk-[A-Za-z0-9]{20,}'
        Message  = "OpenAI API key pattern detected. Must be loaded from environment."
        Severity = "CRITICAL"
    },
    @{
        Pattern  = '(?i)sk-ant-[A-Za-z0-9\-]{20,}'
        Message  = "Anthropic API key pattern detected. Must be loaded from environment."
        Severity = "CRITICAL"
    },
    @{
        Pattern  = '(?i)(mongodb|postgres|mysql|redis)://[^"\x27\s]*:[^"\x27\s]*@'
        Message  = "Database connection string with credentials found. Use env vars."
        Severity = "CRITICAL"
    },
    @{
        Pattern  = '(?i)BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY'
        Message  = "Private key found in source code. Remove immediately."
        Severity = "CRITICAL"
    },
    @{
        Pattern  = 'AKIA[0-9A-Z]{16}'
        Message  = "AWS Access Key ID pattern detected."
        Severity = "CRITICAL"
    }
)

foreach ($dir in $SourceDirs) {
    $scanPath = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $scanPath)) { continue }

    $files = Get-SourceFiles -Directory $scanPath -Extensions $CodeExtensions
    foreach ($file in $files) {
        # Skip .env.example (it is expected to contain placeholder patterns)
        if ($file.Name -eq ".env.example") { continue }
        # Skip test files for secret scanning (test tokens are acceptable)
        if ($file.FullName -match '__tests__' -or $file.FullName -match '\.test\.' -or $file.FullName -match '\.spec\.') { continue }
        # Skip this audit script itself
        if ($file.Name -eq "security-audit.ps1") { continue }
        # Skip load test script (contains test data)
        if ($file.Name -eq "load-test.js") { continue }

        foreach ($sp in $secretPatterns) {
            Search-FileForPattern `
                -File $file `
                -Pattern $sp.Pattern `
                -Severity $sp.Severity `
                -Category "Hardcoded Secret" `
                -Message $sp.Message
        }
    }
}

# Also scan root-level files
$rootFiles = Get-ChildItem -Path $ProjectRoot -File -Filter "*.env" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -ne ".env.example" }
foreach ($file in $rootFiles) {
    Write-Finding `
        -Severity "WARNING" `
        -Category "Secrets File" `
        -Message "Active .env file found. Ensure it is in .gitignore and never committed." `
        -FilePath $file.FullName
}

Write-Host ""

# ── Check 2: Raw SQL Strings ────────────────────────────────────────────────────

Write-Host "[2/6] Checking for raw SQL strings..." -ForegroundColor Yellow
Write-Host ""

$sqlPatterns = @(
    @{
        Pattern  = '(?i)\$queryRaw|\.raw\s*\(|\.rawQuery\s*\('
        Message  = "Raw SQL query detected. Use Prisma/SQLAlchemy parameterized queries instead."
        Severity = "CRITICAL"
        Extensions = @("*.ts", "*.tsx", "*.js", "*.jsx")
    },
    @{
        Pattern  = '(?i)(SELECT|INSERT|UPDATE|DELETE)\s+.*(FROM|INTO|SET)\s+'
        Message  = "Inline SQL statement found. Use ORM methods for all database access."
        Severity = "WARNING"
        Extensions = @("*.ts", "*.tsx", "*.js", "*.jsx")
    },
    @{
        Pattern  = '(?i)text\s*\(\s*["\x27](SELECT|INSERT|UPDATE|DELETE)'
        Message  = "SQLAlchemy text() with raw SQL detected. Use ORM query builders."
        Severity = "WARNING"
        Extensions = @("*.py")
    },
    @{
        Pattern  = '(?i)execute\s*\(\s*["\x27f](SELECT|INSERT|UPDATE|DELETE)'
        Message  = "Direct SQL execute with string detected. Use parameterized queries."
        Severity = "CRITICAL"
        Extensions = @("*.py")
    },
    @{
        Pattern  = '(?i)f["\x27].*\{.*\}.*(SELECT|INSERT|UPDATE|DELETE|WHERE)'
        Message  = "f-string SQL interpolation detected. SQL injection risk."
        Severity = "CRITICAL"
        Extensions = @("*.py")
    }
)

foreach ($dir in $SourceDirs) {
    $scanPath = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $scanPath)) { continue }

    foreach ($sp in $sqlPatterns) {
        $files = Get-SourceFiles -Directory $scanPath -Extensions $sp.Extensions
        foreach ($file in $files) {
            # Skip test files (test SQL is acceptable)
            if ($file.FullName -match '__tests__' -or $file.FullName -match '\.test\.' -or $file.FullName -match '\.spec\.' -or $file.FullName -match 'tests[\\/]') { continue }
            # Skip migration files
            if ($file.FullName -match 'migrations?' -or $file.FullName -match 'prisma[\\/]') { continue }

            Search-FileForPattern `
                -File $file `
                -Pattern $sp.Pattern `
                -Severity $sp.Severity `
                -Category "Raw SQL" `
                -Message $sp.Message
        }
    }
}

Write-Host ""

# ── Check 3: Unsafe React Patterns ──────────────────────────────────────────────

Write-Host "[3/6] Checking for unsafe React patterns..." -ForegroundColor Yellow
Write-Host ""

$reactPatterns = @(
    @{
        Pattern  = 'dangerouslySetInnerHTML'
        Message  = "dangerouslySetInnerHTML found. Ensure content is sanitized with DOMPurify or similar."
        Severity = "CRITICAL"
    },
    @{
        Pattern  = '(?i)eval\s*\('
        Message  = "eval() usage detected. Potential code injection vulnerability."
        Severity = "CRITICAL"
    },
    @{
        Pattern  = '(?i)document\.write\s*\('
        Message  = "document.write() detected. Use DOM manipulation methods instead."
        Severity = "WARNING"
    },
    @{
        Pattern  = '(?i)innerHTML\s*='
        Message  = "Direct innerHTML assignment detected. Use React state or sanitized content."
        Severity = "WARNING"
    },
    @{
        Pattern  = '(?i)window\.location\s*=\s*[^;]*\+\s*'
        Message  = "Dynamic redirect with string concatenation. Possible open redirect."
        Severity = "WARNING"
    }
)

foreach ($dir in @("apps", "packages")) {
    $scanPath = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $scanPath)) { continue }

    $files = Get-SourceFiles -Directory $scanPath -Extensions @("*.tsx", "*.jsx", "*.ts", "*.js")
    foreach ($file in $files) {
        # Skip test files
        if ($file.FullName -match '__tests__' -or $file.FullName -match '\.test\.' -or $file.FullName -match '\.spec\.') { continue }

        foreach ($rp in $reactPatterns) {
            Search-FileForPattern `
                -File $file `
                -Pattern $rp.Pattern `
                -Severity $rp.Severity `
                -Category "Unsafe React" `
                -Message $rp.Message
        }
    }
}

Write-Host ""

# ── Check 4: Auth Middleware on API Routes ───────────────────────────────────────

Write-Host "[4/6] Verifying auth middleware on API routes..." -ForegroundColor Yellow
Write-Host ""

$routeFiles = @()
foreach ($dir in @("services")) {
    $scanPath = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $scanPath)) { continue }

    $routeFiles += Get-SourceFiles -Directory $scanPath -Extensions @("*.ts", "*.js") |
        Where-Object {
            $_.FullName -match 'routes[\\/]' -and
            -not ($_.FullName -match '__tests__' -or $_.FullName -match '\.test\.' -or $_.FullName -match '\.spec\.')
        }
}

foreach ($file in $routeFiles) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop

        # Check if the route file registers routes (has fastify.get/post/put/delete)
        if ($content -match 'fastify\.(get|post|put|delete|patch)\s*\(') {
            # Check if auth middleware or preHandler with auth check exists
            $hasAuth = (
                $content -match 'authenticate' -or
                $content -match 'preHandler.*auth' -or
                $content -match 'onRequest.*auth' -or
                $content -match 'verifyToken' -or
                $content -match 'request\.user' -or
                $content -match 'preValidation'
            )

            # The whatsapp webhook GET route is allowed without auth (Meta verification)
            $isWebhook = ($file.Name -match 'whatsapp' -and $content -match 'hub\.verify_token')

            if (-not $hasAuth -and -not $isWebhook) {
                Write-Finding `
                    -Severity "WARNING" `
                    -Category "Missing Auth" `
                    -Message "Route file registers endpoints but no auth middleware detected. Verify authentication is applied via parent plugin or hook." `
                    -FilePath $file.FullName
            }
        }
    } catch {
        # Skip unreadable files
    }
}

# Check that the main server files apply auth globally
$serverFiles = @()
foreach ($dir in @("services")) {
    $scanPath = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $scanPath)) { continue }

    $serverFiles += Get-SourceFiles -Directory $scanPath -Extensions @("*.ts", "*.js") |
        Where-Object {
            ($_.Name -eq "index.ts" -or $_.Name -eq "server.ts" -or $_.Name -eq "app.ts") -and
            $_.FullName -match 'src[\\/]'
        }
}

foreach ($file in $serverFiles) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop
        if (-not ($content -match 'authenticate|auth|preHandler|onRequest|verifyToken|jwt')) {
            Write-Finding `
                -Severity "WARNING" `
                -Category "Missing Global Auth" `
                -Message "Main server file does not appear to register global auth middleware." `
                -FilePath $file.FullName
        }
    } catch {
        # Skip
    }
}

Write-Host ""

# ── Check 5: PII in LLM Prompts ─────────────────────────────────────────────────

Write-Host "[5/6] Checking for PII leakage in LLM prompt handling..." -ForegroundColor Yellow
Write-Host ""

$piiPatterns = @(
    @{
        Pattern  = '(?i)(phone|mobile|cell)\s*[:=]\s*["\x27]\+?\d{10,}'
        Message  = "Phone number appears hardcoded. Ensure PII is redacted before sending to LLM."
        Severity = "WARNING"
    },
    @{
        Pattern  = '(?i)aadhaar|aadhar'
        Message  = "Aadhaar (national ID) reference found. Ensure this data is never sent to LLM."
        Severity = "CRITICAL"
    },
    @{
        Pattern  = '(?i)pan\s*[:=]\s*["\x27][A-Z]{5}\d{4}[A-Z]'
        Message  = "PAN card number pattern detected. Remove PII before LLM calls."
        Severity = "CRITICAL"
    }
)

# Scan AI service and prompt templates
$aiDirs = @(
    (Join-Path $ProjectRoot "services" "ai-service"),
    (Join-Path $ProjectRoot "data" "prompts")
)

foreach ($aiDir in $aiDirs) {
    if (-not (Test-Path $aiDir)) { continue }

    $files = Get-SourceFiles -Directory $aiDir -Extensions @("*.py", "*.md", "*.txt", "*.json", "*.yml", "*.yaml")
    foreach ($file in $files) {
        # Skip test files
        if ($file.FullName -match 'tests[\\/]' -or $file.FullName -match '\.test\.') { continue }

        foreach ($pp in $piiPatterns) {
            Search-FileForPattern `
                -File $file `
                -Pattern $pp.Pattern `
                -Severity $pp.Severity `
                -Category "PII Leakage" `
                -Message $pp.Message
        }
    }
}

# Check that prompt construction includes redaction
$promptFiles = @()
foreach ($aiDir in $aiDirs) {
    if (-not (Test-Path $aiDir)) { continue }
    $promptFiles += Get-SourceFiles -Directory $aiDir -Extensions @("*.py")
}

foreach ($file in $promptFiles) {
    try {
        $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop
        if ($content -match 'prompt|template' -and $content -match 'llm|model|chat|completion') {
            if (-not ($content -match 'redact|mask|sanitiz|anonymiz|strip_pii|remove_pii')) {
                Write-Finding `
                    -Severity "INFO" `
                    -Category "PII Handling" `
                    -Message "File constructs LLM prompts but no PII redaction function detected. Consider adding PII masking." `
                    -FilePath $file.FullName
            }
        }
    } catch {
        # Skip
    }
}

Write-Host ""

# ── Check 6: Dependency & Config Security ────────────────────────────────────────

Write-Host "[6/6] Checking dependency and configuration security..." -ForegroundColor Yellow
Write-Host ""

# Check for .gitignore including sensitive files
$gitignorePath = Join-Path $ProjectRoot ".gitignore"
if (Test-Path $gitignorePath) {
    $gitignoreContent = Get-Content -Path $gitignorePath -Raw

    $requiredIgnores = @(".env", "*.pem", "*.key", "node_modules", "__pycache__", ".next", "dist")
    foreach ($entry in $requiredIgnores) {
        if (-not ($gitignoreContent -match [regex]::Escape($entry))) {
            Write-Finding `
                -Severity "WARNING" `
                -Category "Gitignore" `
                -Message "'$entry' is not in .gitignore. Sensitive files may be committed." `
                -FilePath $gitignorePath
        }
    }
} else {
    Write-Finding `
        -Severity "CRITICAL" `
        -Category "Gitignore" `
        -Message "No .gitignore file found. Sensitive files could be committed to the repository."
}

# Check for CORS wildcard in production configs
foreach ($dir in @("services")) {
    $scanPath = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $scanPath)) { continue }

    $files = Get-SourceFiles -Directory $scanPath -Extensions @("*.ts", "*.js")
    foreach ($file in $files) {
        if ($file.FullName -match '__tests__' -or $file.FullName -match '\.test\.') { continue }

        Search-FileForPattern `
            -File $file `
            -Pattern "origin:\s*['\x22]\*['\x22]|origin:\s*true" `
            -Severity "WARNING" `
            -Category "CORS" `
            -Message "Wildcard CORS origin detected. Restrict to specific domains in production."
    }
}

# Check rate limiting is configured
$hasRateLimiting = $false
foreach ($dir in @("services")) {
    $scanPath = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $scanPath)) { continue }

    $files = Get-SourceFiles -Directory $scanPath -Extensions @("*.ts", "*.js")
    foreach ($file in $files) {
        try {
            $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop
            if ($content -match 'rate-limit|rateLimit|rateLimiting|fastify-rate-limit') {
                $hasRateLimiting = $true
                break
            }
        } catch { }
    }
    if ($hasRateLimiting) { break }
}

if (-not $hasRateLimiting) {
    Write-Finding `
        -Severity "WARNING" `
        -Category "Rate Limiting" `
        -Message "No rate limiting configuration found in any service. Add fastify-rate-limit or equivalent."
}

# Check for helmet / security headers
$hasSecurityHeaders = $false
foreach ($dir in @("services")) {
    $scanPath = Join-Path $ProjectRoot $dir
    if (-not (Test-Path $scanPath)) { continue }

    $files = Get-SourceFiles -Directory $scanPath -Extensions @("*.ts", "*.js")
    foreach ($file in $files) {
        try {
            $content = Get-Content -Path $file.FullName -Raw -ErrorAction Stop
            if ($content -match 'helmet|security-headers|fastify-helmet|x-frame-options') {
                $hasSecurityHeaders = $true
                break
            }
        } catch { }
    }
    if ($hasSecurityHeaders) { break }
}

if (-not $hasSecurityHeaders) {
    Write-Finding `
        -Severity "INFO" `
        -Category "Security Headers" `
        -Message "No security header middleware (helmet) found. Consider adding fastify-helmet for HTTP security headers."
}

Write-Host ""

# ── Summary ──────────────────────────────────────────────────────────────────────

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  AUDIT SUMMARY" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Total Issues:    $($script:TotalIssues)" -ForegroundColor White

if ($script:CriticalIssues -gt 0) {
    Write-Host "  Critical:        $($script:CriticalIssues)" -ForegroundColor Red
} else {
    Write-Host "  Critical:        0" -ForegroundColor Green
}

if ($script:WarningIssues -gt 0) {
    Write-Host "  Warnings:        $($script:WarningIssues)" -ForegroundColor Yellow
} else {
    Write-Host "  Warnings:        0" -ForegroundColor Green
}

Write-Host "  Info:            $($script:InfoIssues)" -ForegroundColor Cyan
Write-Host ""

if ($script:CriticalIssues -eq 0 -and $script:WarningIssues -eq 0) {
    Write-Host "  PASSED - No critical or warning issues found." -ForegroundColor Green
} elseif ($script:CriticalIssues -eq 0) {
    Write-Host "  PASSED WITH WARNINGS - Review the warnings above." -ForegroundColor Yellow
} else {
    Write-Host "  FAILED - Critical issues must be resolved before deployment." -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Exit with error code if critical issues found and FailOnIssues is set
if ($FailOnIssues -and $script:CriticalIssues -gt 0) {
    exit 1
}

exit 0
