param([string]$Name = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$pin = Join-Path $root 'deps/esabi/ESABI_PIN'
$esabi = Join-Path $root 'deps/esabi'
$include = Join-Path $esabi 'include'
$expected = ((Get-Content -LiteralPath $pin | Where-Object { $_ -like 'commit=*' }) -replace '^commit=', '').Trim()
if (-not (Test-Path -LiteralPath (Join-Path $include 'esabi/esabi.h'))) { throw "Pinned ESABI header checkout not found at $include" }
$actual = '65c9c3ce627a26a89d6bf90547678841df0cf981'
if ($expected -ne $actual) { throw "Vendored ESABI pin mismatch: expected $actual, got $expected" }
$pinLines = Get-Content -LiteralPath $pin
function PinValue([string]$name) {
  return (($pinLines | Where-Object { $_ -like ($name + '=*') }) -replace ('^' + [regex]::Escape($name) + '='), '').Trim().ToLowerInvariant()
}
$pinnedFiles = @(
  @('esabi_h_sha256', (Join-Path $include 'esabi/esabi.h')),
  @('externalobject_h_sha256', (Join-Path $include 'esabi/externalobject.h')),
  @('value_h_sha256', (Join-Path $include 'esabi/value.h')),
  @('license_sha256', (Join-Path $esabi 'LICENSE'))
)
foreach ($entry in $pinnedFiles) {
  $expectedHash = PinValue $entry[0]
  if (-not $expectedHash) { throw "ESABI pin is missing $($entry[0])" }
  $actualHash = (Get-FileHash -LiteralPath $entry[1] -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $expectedHash) { throw "Vendored ESABI file hash mismatch for $($entry[1]): expected $expectedHash, found $actualHash" }
}
if (-not (Get-Command cl.exe -ErrorAction SilentlyContinue)) {
  $vswhere = 'C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe'
  if (-not (Test-Path -LiteralPath $vswhere)) { throw 'MSVC cl.exe not found; run from a VS developer environment or install VS Build Tools.' }
  $install = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  $devcmd = Join-Path $install 'Common7/Tools/VsDevCmd.bat'
  if (-not (Test-Path -LiteralPath $devcmd)) { throw 'VsDevCmd.bat not found.' }
  cmd /c "`"$devcmd`" -arch=x64 -host_arch=x64 >nul && set" | ForEach-Object {
    if ($_ -match '^(.*?)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') }
  }
}
$outDir = Join-Path $root 'dist/native'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$source = Join-Path $root 'native/esfs_native.c'
$compilerPath = (Get-Command cl.exe -ErrorAction Stop).Source
$compilerVersion = (Get-Item -LiteralPath $compilerPath).VersionInfo.FileVersion
$compileProfile = 'x64|O2|MT|LD|W4|WX|LONG32|WINDOWS'
$fingerprintParts = @(
  (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash,
  (Get-FileHash -LiteralPath $MyInvocation.MyCommand.Path -Algorithm SHA256).Hash,
  (Get-FileHash -LiteralPath (Join-Path $include 'esabi/esabi.h') -Algorithm SHA256).Hash,
  (Get-FileHash -LiteralPath (Join-Path $include 'esabi/externalobject.h') -Algorithm SHA256).Hash,
  (Get-FileHash -LiteralPath (Join-Path $include 'esabi/value.h') -Algorithm SHA256).Hash,
  $expected,
  $compilerVersion,
  $compileProfile
)
$fingerprintBytes = [Text.Encoding]::UTF8.GetBytes(($fingerprintParts -join ':'))
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
  $fingerprint = ([BitConverter]::ToString($sha256.ComputeHash($fingerprintBytes))).Replace('-', '').ToLowerInvariant().Substring(0,16)
} finally {
  $sha256.Dispose()
}
if (-not $Name) { $Name = "ESFSNative_$fingerprint.dll" }
$out = Join-Path $outDir $Name
$obj = Join-Path $outDir "esfs_native_$fingerprint.obj"
$implib = Join-Path $outDir "ESFSNative_$fingerprint.lib"
if (-not (Test-Path -LiteralPath $out)) {
  & cl.exe /nologo /O2 /MT /LD /W4 /WX /D ESABI_ABI_PROFILE=ESABI_ABI_PROFILE_LONG32 /Fo:"$obj" /I"$include" "$source" /link /SUBSYSTEM:WINDOWS /MACHINE:X64 /IMPLIB:"$implib" /OUT:"$out"
  if ($LASTEXITCODE -ne 0) { throw "cl.exe failed with exit $LASTEXITCODE" }
}
$releaseDir = Join-Path $outDir 'release'
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
$releaseOut = Join-Path $releaseDir 'ESFSNative.dll'
Copy-Item -LiteralPath $out -Destination $releaseOut -Force
Set-Content -LiteralPath (Join-Path $outDir 'ESFSNative.current') -Value $Name -Encoding ascii -NoNewline
Write-Output "Built/reused $out against vendored ESABI 0.3.1 / $actual; release copy: $releaseOut"
