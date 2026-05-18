$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$env:ELECTRON_CACHE = Join-Path $root ".electron-cache"
$env:ELECTRON_BUILDER_CACHE = Join-Path $root ".electron-builder-cache"
$builder = Join-Path $root "node_modules\.bin\electron-builder.cmd"

if (-not (Test-Path -LiteralPath $builder)) {
  throw "electron-builder is not installed. Run: npm.cmd install"
}

New-Item -ItemType Directory -Force -Path $env:ELECTRON_CACHE | Out-Null
New-Item -ItemType Directory -Force -Path $env:ELECTRON_BUILDER_CACHE | Out-Null

& $builder --win
if ($LASTEXITCODE -ne 0) {
  throw "Electron Windows builds failed."
}
