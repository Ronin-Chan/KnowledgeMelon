param(
    [string]$ProjectRoot = $PSScriptRoot,
    [string]$BackendDir = (Join-Path $PSScriptRoot "backend"),
    [string]$FrontendDir = (Join-Path $PSScriptRoot "frontend"),
    [int]$PostgresTimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

function Invoke-ComposeUp {
    if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
        & docker-compose up -d
        return
    }

    if (Get-Command docker -ErrorAction SilentlyContinue) {
        & docker compose up -d
        return
    }

    throw "Docker Compose is not available. Please install Docker Desktop or Docker Compose first."
}

function Wait-ForPostgresHealthy {
    param(
        [int]$TimeoutSeconds = 120
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $status = & docker inspect -f "{{.State.Health.Status}}" knowledge-melon-db 2>$null
            if ($status -eq "healthy") {
                return
            }
        } catch {
            # Keep waiting until the container reports healthy.
        }

        Start-Sleep -Seconds 2
    }

    throw "Postgres did not become healthy within $TimeoutSeconds seconds."
}

function Get-BackendPython {
    $candidates = @(
        (Join-Path $BackendDir "venv\Scripts\python.exe"),
        (Join-Path $BackendDir ".venv\Scripts\python.exe")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python) {
        return $python.Source
    }

    throw "Python is not available. Create backend/venv or install Python 3.13+."
}

Write-Host "Starting PostgreSQL via Docker Compose..."
Set-Location $ProjectRoot
Invoke-ComposeUp

Write-Host "Waiting for PostgreSQL to become healthy..."
Wait-ForPostgresHealthy -TimeoutSeconds $PostgresTimeoutSeconds

$backendPython = Get-BackendPython

Write-Host "Starting backend..."
Start-Process -FilePath $backendPython -ArgumentList @("-u", "main.py") -WorkingDirectory $BackendDir

Write-Host "Starting frontend..."
Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev") -WorkingDirectory $FrontendDir

Write-Host "All services are starting."
Write-Host "Frontend: http://localhost:3000"
Write-Host "Backend:  http://localhost:8000"
