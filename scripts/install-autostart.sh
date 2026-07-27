#!/usr/bin/env bash
# Installs LapDeck as a systemd --user service so it starts at login, headless
# (no terminal), with NO root. Re-run any time to refresh paths. Uninstall with
# scripts/uninstall-autostart.sh; stop the running agent with scripts/stop-agent.sh.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo root
ENTRY="$REPO_DIR/src/index.js"
NODE="$(command -v node)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT="$UNIT_DIR/lapdeck.service"

if [ -z "$NODE" ]; then
  echo "node not found on PATH — install Node.js >= 20 first." >&2
  exit 1
fi

mkdir -p "$UNIT_DIR"
cat > "$UNIT" <<EOF
[Unit]
Description=LapDeck agent (phone-to-laptop remote deck)
After=graphical-session.target

[Service]
Type=simple
WorkingDirectory=$REPO_DIR
ExecStart=$NODE $ENTRY
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now lapdeck.service

echo "Autostart installed: $UNIT"
echo "The agent is running now and will start automatically at each login."
echo
echo "  Status:  systemctl --user status lapdeck"
echo "  Logs:    journalctl --user -u lapdeck -f"
echo
echo "Tip: to keep it running after you log out, enable lingering once:"
echo "  sudo loginctl enable-linger \"$USER\""
echo
echo "Wayland note: touchpad/keyboard need ydotoold running with uinput access."
echo "See the README 'Linux requirements' section."
