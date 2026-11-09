param([Parameter(ValueFromRemainingArguments = $true)][string[]]$TaskArguments)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$taskNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
if (Test-Path -LiteralPath (Join-Path $taskNode 'node.exe')) { $env:PATH = $taskNode + ';' + $env:PATH }
$taskNodeExecutable = (Get-Command node.exe).Source
if ([int]((& $taskNodeExecutable --version).TrimStart('v').Split('.')[0]) -lt 24) { throw 'Instala Node.js 24 LTS para ejecutar el proyecto.' }
$taskNpmExecutable = (Get-Command npm.cmd).Source
$taskNpmCli = Join-Path (Split-Path -Parent $taskNpmExecutable) 'node_modules\npm\bin\npm-cli.js'
& $taskNodeExecutable $taskNpmCli @TaskArguments
exit $LASTEXITCODE
