#!/usr/bin/env sh
# LapDeck one-line installer (Linux / macOS).
#
#   curl -fsSL https://raw.githubusercontent.com/ronak-create/LapDeck/main/scripts/install.sh | sh
#
# Clones LapDeck, installs its dependencies, and prints how to start it. Runs
# entirely as your user — no root, no sudo, nothing written outside the install
# dir. Re-run any time to update an existing checkout (it pulls instead of
# recloning). Windows users: use the git clone + npm install steps in the README
# instead (this script targets POSIX shells).
#
# Overrides via env var:
#   LAPDECK_DIR=/path   where to install (default: ~/LapDeck)
#   LAPDECK_REF=branch  git ref to check out (default: main)
set -eu

REPO_URL="https://github.com/ronak-create/LapDeck.git"
DIR="${LAPDECK_DIR:-$HOME/LapDeck}"
REF="${LAPDECK_REF:-main}"

info() { printf '\033[36m›\033[0m %s\n' "$1"; }
err()  { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; }

need() {
  command -v "$1" >/dev/null 2>&1 && return 0
  err "$1 is required but not found on PATH."
  return 1
}

# --- preflight -------------------------------------------------------------
missing=0
need git  || missing=1
need node || missing=1
need npm  || missing=1
if [ "$missing" -ne 0 ]; then
  err "Install the missing tool(s) and re-run. Node.js >= 20: https://nodejs.org"
  exit 1
fi

# Node >= 20. `node -v` prints like "v20.11.1"; strip the leading v and the dots.
NODE_MAJOR=$(node -v | sed 's/^v//; s/\..*//')
if [ "$NODE_MAJOR" -lt 20 ]; then
  err "Node.js >= 20 required (found $(node -v)). Update from https://nodejs.org"
  exit 1
fi

# --- fetch -----------------------------------------------------------------
if [ -d "$DIR/.git" ]; then
  info "Updating existing checkout in $DIR"
  git -C "$DIR" fetch --depth 1 origin "$REF"
  git -C "$DIR" checkout -q "$REF"
  git -C "$DIR" reset --hard -q "origin/$REF"
elif [ -e "$DIR" ]; then
  err "$DIR already exists and is not a LapDeck checkout. Move it or set LAPDECK_DIR."
  exit 1
else
  info "Cloning LapDeck into $DIR"
  git clone --depth 1 --branch "$REF" "$REPO_URL" "$DIR"
fi

# --- deps ------------------------------------------------------------------
info "Installing dependencies (npm install)"
( cd "$DIR" && npm install --no-fund --no-audit )

# --- done ------------------------------------------------------------------
printf '\n\033[32m✓ LapDeck is installed.\033[0m\n\n'
printf 'Start it and scan the QR with your phone:\n\n'
printf '    cd %s\n    npm start\n\n' "$DIR"
printf 'Optional — start automatically at login (systemd --user, no root):\n\n'
printf '    sh %s/scripts/install-autostart.sh\n\n' "$DIR"
