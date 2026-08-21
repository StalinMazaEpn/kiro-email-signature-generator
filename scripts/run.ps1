#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Levanta el proyecto Email Signature Generator en local (frontend + backend).
.DESCRIPTION
    1. Verifica prerequisitos (Node.js >= 18 y npm)
    2. Revisa dependencias en la raiz y en lambda; las instala si faltan
    3. Crea .env desde .env.example si no existe
    4. Asegura que exista lambda/local-storage
    5. Arranca el dev server que sirve el frontend y la API
.EXAMPLE
    .\scripts\run.ps1
.EXAMPLE
    .\scripts\run.ps1 -Open   # Ademas abre el navegador en la URL final
#>

param(
    [switch]$Open
)

$ErrorActionPreference = 'Stop'

# --- Resuelve la raiz del proyecto (../ relativo a scripts/) ---
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $ProjectRoot

function Write-Step {
    param([string]$Message, [string]$Color = 'Yellow')
    Write-Host "[>] $Message" -ForegroundColor $Color
}

function Fail {
    param([string]$Message)
    Write-Host "`n[!] $Message" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Email Signature Generator - Local Run ===" -ForegroundColor Cyan

# --- 1. Prerequisitos ---
$nodeVersion = (& node --version 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $nodeVersion) {
    Fail 'Node.js no esta instalado o no esta en el PATH. Instala Node.js >= 18 desde https://nodejs.org'
}
if ($nodeVersion -match '^v?(\d+)') {
    $nodeMajor = [int]$Matches[1]
    if ($nodeMajor -lt 18) {
        Fail "Se requiere Node.js v18 o superior (tienes $nodeVersion)."
    }
}
Write-Step "Node.js detectado: $nodeVersion" -Color Green

$npmVersion = (& npm --version 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $npmVersion) {
    Fail 'npm no esta instalado o no esta en el PATH.'
}
Write-Step "npm detectado: $npmVersion" -Color Green

# --- 2. Dependencias (instala solo si faltan) ---
function Assert-Dependencies {
    param([string]$Dir, [string]$Label)

    $pkgPath = Join-Path $Dir 'package.json'
    if (-not (Test-Path $pkgPath)) { return }

    $pkg = Get-Content -Path $pkgPath -Raw | ConvertFrom-Json
    $hasDeps = ($null -ne $pkg.dependencies) -or ($null -ne $pkg.devDependencies)
    if (-not $hasDeps) { return }

    $modulesPath = Join-Path $Dir 'node_modules'
    $lockPath = Join-Path $Dir 'package-lock.json'

    if (Test-Path $modulesPath) {
        Write-Step "${Label}: dependencias OK." -Color Green
        return
    }

    Write-Step "${Label}: dependencias no instaladas. Instalando..."
    Push-Location $Dir
    try {
        if (Test-Path $lockPath) {
            & npm ci --no-fund --no-audit
        }
        else {
            & npm install --no-fund --no-audit
        }
        if ($LASTEXITCODE -ne 0) {
            Fail "Fallaron las dependencias de $Label (npm exit code $LASTEXITCODE)."
        }
    }
    finally {
        Pop-Location
    }
    Write-Step "${Label}: dependencias instaladas." -Color Green
}

Assert-Dependencies -Dir $ProjectRoot -Label 'Raiz'
Assert-Dependencies -Dir (Join-Path $ProjectRoot 'lambda') -Label 'Lambda'

# --- 3. Archivo .env ---
$envPath = Join-Path $ProjectRoot '.env'
$envExamplePath = Join-Path $ProjectRoot '.env.example'
if (-not (Test-Path $envPath)) {
    Write-Step 'No existe .env. Creando copia desde .env.example...'
    Copy-Item -Path $envExamplePath -Destination $envPath
    Write-Step '.env creado. Editalo si quieres habilitar IA real o image-tools.' -Color Green
}
else {
    Write-Step '.env presente.' -Color Green
}

# --- 4. Directorio de almacenamiento local ---
$storagePath = Join-Path $ProjectRoot 'lambda\local-storage'
if (-not (Test-Path $storagePath)) {
    New-Item -ItemType Directory -Path $storagePath -Force | Out-Null
    Write-Step 'lambda/local-storage creado.' -Color Green
}
else {
    Write-Step 'lambda/local-storage presente.' -Color Green
}

# --- 5. Detectar puerto desde .env (default 3005) ---
$port = 3005
$envLines = if (Test-Path $envPath) { Get-Content $envPath } else { @() }
$portLine = $envLines | Where-Object { $_ -match '^\s*PORT\s*=\s*\d+' } | Select-Object -First 1
if ($portLine -and $portLine -match '^\s*PORT\s*=\s*(\d+)') {
    $port = [int]$Matches[1]
}

# --- 6. (Opcional) Abrir navegador ---
if ($Open) {
    $url = "http://localhost:$port/"
    Write-Step "Abriendo $url en el navegador..." -Color Cyan
    Start-Process $url
}

# --- 7. Arrancar dev server (frontend + API) en primer plano ---
Write-Step "Arrancando servidor en http://localhost:$port  (Ctrl+C para detener)..." -Color Cyan
Write-Host "`n"

& node (Join-Path $ProjectRoot 'lambda\dev-server.js')
$code = $LASTEXITCODE
if ($code -ne 0) {
    Fail "El servidor se detuvo con codigo $code."
}
Write-Step 'Servidor detenido.' -Color Green
