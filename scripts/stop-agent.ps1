# Stops the running LapDeck agent (targets its recorded PID only, so
# it won't touch other Node apps you may be running).
$ErrorActionPreference = "SilentlyContinue"
$pidFile = Join-Path (Split-Path -Parent $PSScriptRoot) "data\agent.pid"
if (Test-Path $pidFile) {
  $agentPid = (Get-Content $pidFile).Trim()
  $proc = Get-Process -Id $agentPid -ErrorAction SilentlyContinue
  if ($proc) {
    Stop-Process -Id $agentPid -Force
    Write-Host "Stopped LapDeck agent (PID $agentPid)."
  } else {
    Write-Host "No running agent found for PID $agentPid (stale pid file)."
  }
  Remove-Item $pidFile -ErrorAction SilentlyContinue
} else {
  Write-Host "No pid file found - the agent may not be running."
}
