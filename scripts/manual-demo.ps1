param([ValidateSet('start','status','stop')][string]$Action = 'start')
$ErrorActionPreference = 'Stop'
$taskWorkspace = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $taskWorkspace
$taskProfilePath = Join-Path $taskWorkspace '.local\manual-demo\config.json'
if (-not (Test-Path -LiteralPath $taskProfilePath)) { throw 'Prepara primero los datos: .\scripts\forma.ps1 exec tsx scripts/manual-demo-prepare.mjs' }
$taskProfile = Get-Content -LiteralPath $taskProfilePath -Raw | ConvertFrom-Json
if (-not $taskProfile.ready -or $taskProfile.database -ne 'forma_manual_demo') { throw 'La preparación ficticia no está completa.' }
$taskOrigin = 'http://127.0.0.1:4180'
function Get-DemoState {
  try {
    $taskInstance = Invoke-RestMethod -Uri ($taskOrigin + '/v1/manual-demo/instance') -TimeoutSec 2
    if ($taskInstance.instanceId -eq $taskProfile.instanceId -and $taskInstance.loopbackOnly) { return $taskInstance }
    throw 'El puerto responde con otra instancia.'
  } catch { return $null }
}
$taskState = Get-DemoState
if ($Action -eq 'status') {
  if ($taskState) { Write-Output ('Activa, solo este PC: ' + $taskOrigin + '/acceso') }
  else { Write-Output 'Prueba local detenida.' }
  exit 0
}
if ($Action -eq 'stop') {
  if (-not $taskState) { Write-Output 'No hay una instancia propia activa que detener.'; exit 0 }
  $taskMetadata = Get-Content -LiteralPath (Join-Path $taskWorkspace '.local\manual-demo\server.json') -Raw | ConvertFrom-Json
  $taskProcess = Get-CimInstance Win32_Process -Filter ('ProcessId=' + [int]$taskMetadata.pid)
  if ($taskMetadata.instanceId -ne $taskProfile.instanceId -or -not $taskProcess -or
    $taskProcess.CommandLine -notlike '*scripts/manual-demo-server.mjs*') { throw 'No se puede verificar el proceso de esta prueba; no se detuvo nada.' }
  Stop-Process -Id ([int]$taskMetadata.pid)
  Write-Output 'Prueba detenida. Tus cambios ficticios se conservan.'
  exit 0
}
if ($taskState) { Write-Output ('Ya está activa: ' + $taskOrigin + '/acceso'); exit 0 }
$taskNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $taskNode)) { $taskNode = (Get-Command node.exe).Source }
if ([int]((& $taskNode --version).TrimStart('v').Split('.')[0]) -lt 24) { throw 'Se necesita Node.js 24.' }
$taskLogRoot = Join-Path $taskWorkspace '.local\manual-demo'
$taskChild = Start-Process -FilePath $taskNode -ArgumentList @('--import','tsx','scripts/manual-demo-server.mjs') `
  -WorkingDirectory $taskWorkspace -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $taskLogRoot 'server.log') `
  -RedirectStandardError (Join-Path $taskLogRoot 'server-error.log')
for ($taskAttempt = 0; $taskAttempt -lt 20; $taskAttempt++) {
  Start-Sleep -Milliseconds 500
  if (Get-DemoState) { Write-Output ('Lista, solo este PC: ' + $taskOrigin + '/acceso'); exit 0 }
  if ($taskChild.HasExited) { break }
}
throw 'El servidor no confirmó el arranque; revisa .local/manual-demo/server-error.log. No se inició ningún servicio público.'
