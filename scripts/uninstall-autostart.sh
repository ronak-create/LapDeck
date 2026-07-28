#!/usr/bin/env sh
# Removes the LapDeck systemd --user service (stops it first). Leaves your data
# dir (token, settings, launcher) untouched.
set -eu

UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT="$UNIT_DIR/lapdeck.service"

systemctl --user disable --now lapdeck.service 2>/dev/null || true
rm -f "$UNIT"
systemctl --user daemon-reload

echo "Autostart removed. Your data dir (token/settings) was left in place."
