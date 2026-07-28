#!/usr/bin/env sh
# Stops the running LapDeck agent. Stops the systemd --user service if installed;
# otherwise falls back to the PID recorded in the data dir.
set -eu

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if systemctl --user list-unit-files lapdeck.service >/dev/null 2>&1 \
   && systemctl --user is-active --quiet lapdeck.service; then
  systemctl --user stop lapdeck.service
  echo "Stopped lapdeck.service."
  exit 0
fi

PID_FILE="${LC_DATA_DIR:-$REPO_DIR/data}/agent.pid"
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  if kill "$PID" 2>/dev/null; then
    echo "Stopped agent (pid $PID)."
  else
    echo "No running agent for pid $PID (already stopped)."
  fi
else
  echo "No systemd service and no $PID_FILE — nothing to stop."
fi
