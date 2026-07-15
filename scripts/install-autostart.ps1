# Installs LapDeck to start automatically at logon, hidden (no console
# window), with NO admin prompt. Works by dropping a tiny VBS launcher into the
# per-user Startup folder. Re-run any time to refresh paths.
$ErrorActionPreference = "Stop"

$agentDir = Split-Path -Parent $PSScriptRoot          # repo root
$node = (Get-Command node -ErrorAction Stop).Source   # resolve node.exe path
$entry = Join-Path $agentDir "src\index.js"
$startup = [Environment]::GetFolderPath("Startup")
$vbsPath = Join-Path $startup "LapDeck.vbs"

# The doubled quotes ("") are VBS-escaped quotes, so the spawned command line is
# properly quoted around the (possibly space-containing) node and script paths.
$vbs = @"
' Auto-start the LapDeck agent at logon, fully hidden (no window).
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "$agentDir"
sh.Run """$node"" ""$entry""", 0, False
"@

Set-Content -Path $vbsPath -Value $vbs -Encoding ASCII
Write-Host "Autostart installed:" -ForegroundColor Green
Write-Host "  $vbsPath"
Write-Host "The agent will launch automatically each time you log in to Windows."
Write-Host "To start it right now without rebooting, run:  wscript `"$vbsPath`""
