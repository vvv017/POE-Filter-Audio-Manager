$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dist = Join-Path $root "dist"
$node = (Get-Command node).Source
$csc = Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"

if (-not (Test-Path -LiteralPath $csc)) {
  throw "Cannot find .NET Framework compiler: $csc"
}

New-Item -ItemType Directory -Force -Path $dist | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dist "app") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $dist "runtime") | Out-Null

$launcherOut = Join-Path $dist "POEFilterAudioManager.exe"
$launcherSource = Join-Path $root "tools\launcher\Program.cs"
& $csc /nologo /target:exe /optimize+ "/out:$launcherOut" "$launcherSource"
if ($LASTEXITCODE -ne 0) {
  throw "Launcher compilation failed."
}

Copy-Item -LiteralPath $node -Destination (Join-Path $dist "runtime\node.exe") -Force
Copy-Item -LiteralPath (Join-Path $root "server.js") -Destination (Join-Path $dist "app\server.js") -Force
Copy-Item -LiteralPath (Join-Path $root "package.json") -Destination (Join-Path $dist "app\package.json") -Force
Copy-Item -LiteralPath (Join-Path $root "README.md") -Destination (Join-Path $dist "README.md") -Force
Copy-Item -LiteralPath (Join-Path $root "public") -Destination (Join-Path $dist "app") -Recurse -Force

Write-Host "Built Windows package:"
Write-Host (Join-Path $dist "POEFilterAudioManager.exe")
