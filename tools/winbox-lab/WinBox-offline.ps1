# WinBox 4.5 — offline Windows Sandbox capture (no RouterOS, no network).
# This file is deliberately not run by CI/Linux. Do not enter credentials.
param(
 [string]$Executable = 'C:\WinBoxInput\WinBox(3).exe',
 [string]$OutputDir = 'C:\WinBoxEvidence',
 [ValidateRange(10,180)][int]$Seconds = 90
)
$ErrorActionPreference = 'Stop'
$expected = '4ec6afb7b308633fd2d9e2354fbb164d727f3552216fd61a19518dbc1aaf6861'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Executable).Hash.ToLowerInvariant()
if($hash -ne $expected){ throw 'Unexpected WinBox binary hash — aborting.' }
$metadata = [ordered]@{
 utc = (Get-Date).ToUniversalTime().ToString('o')
 sha256 = $hash
 sandbox = $true
 network = 'disabled-by-wsb'
 windowsVersion = [Environment]::OSVersion.VersionString
 fileVersion = (Get-Item -LiteralPath $Executable).VersionInfo.FileVersion
}
$metadata | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDir 'environment.json') -Encoding UTF8
$samples = Join-Path $OutputDir 'process-snapshots.jsonl'
$proc = Start-Process -FilePath $Executable -PassThru
try{
 for($i=0;$i -lt $Seconds;$i++){
  Start-Sleep -Seconds 1
  try{
   $current = Get-Process -Id $proc.Id -ErrorAction Stop
   $modules = @()
   try{$modules = @($current.Modules | ForEach-Object { $_.ModuleName } | Select-Object -Unique | Sort-Object)}catch{}
   $sample = [ordered]@{
    utc=(Get-Date).ToUniversalTime().ToString('o')
    pid=$current.Id
    alive=$true
    cpuSeconds=$current.CPU
    memoryBytes=$current.WorkingSet64
    windowTitle=$current.MainWindowTitle
    windowHandle=([string]$current.MainWindowHandle)
    modules=$modules
   }
  }catch{
   $sample=[ordered]@{
    utc=(Get-Date).ToUniversalTime().ToString('o')
    pid=$proc.Id
    alive=$false
    exitCode=$(try{$proc.ExitCode}catch{$null})
   }
  }
  $sample | ConvertTo-Json -Compress -Depth 4 | Add-Content -LiteralPath $samples -Encoding UTF8
  if(-not $sample.alive){break}
 }
}finally{
 try{if(-not $proc.HasExited){$proc.CloseMainWindow() | Out-Null; Start-Sleep -Seconds 2}}catch{}
 try{if(-not $proc.HasExited){Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue}}catch{}
}
Write-Host 'Offline evidence saved to isolated output directory.'
