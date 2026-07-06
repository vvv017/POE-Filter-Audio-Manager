$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$output = Join-Path $root "release"
$pake = Join-Path $root "node_modules\.bin\pake.cmd"

if (-not (Test-Path -LiteralPath $pake)) {
  throw "pake-cli is not installed. Run: npm.cmd install"
}

New-Item -ItemType Directory -Force -Path $output | Out-Null
node (Join-Path $root "scripts\patch-pake-native.mjs")

Push-Location $output
try {
  & $pake `
    (Join-Path $root "public\index.html") `
    --name "POE Filter Audio Manager" `
    --icon (Join-Path $root "assets\app-icon.ico") `
    --width 1320 `
    --height 820 `
    --min-width 820 `
    --min-height 520 `
    --use-local-file `
    --targets x64 `
    --keep-binary

  if ($LASTEXITCODE -ne 0) {
    throw "Pake Windows build failed."
  }
} finally {
  Pop-Location
}
