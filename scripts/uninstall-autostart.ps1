# Removes the LapDeck logon autostart entry.
$ErrorActionPreference = "Stop"
$vbsPath = Join-Path ([Environment]::GetFolderPath("Startup")) "LapDeck.vbs"
if (Test-Path $vbsPath) {
  Remove-Item $vbsPath
  Write-Host "Autostart removed. (A currently-running agent keeps running until you stop it.)"
} else {
  Write-Host "Autostart was not installed; nothing to remove."
}
