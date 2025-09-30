#!/usr/bin/env bash
set -euo pipefail

echo "=== Ngrok Setup for Synercore Import Schedule ==="
echo

# --- Resolve ngrok binary: prefer PATH, else ./ngrok
if command -v ngrok >/dev/null 2>&1; then
  NGROK_BIN="$(command -v ngrok)"
elif [ -x "./ngrok" ]; then
  NGROK_BIN="./ngrok"
else
  echo "❌ ngrok not found."
  echo "Install:"
  echo "  - macOS:   brew install ngrok/ngrok/ngrok"
  echo "  - Linux:   sudo snap install ngrok"
  echo "  - Windows: winget install Ngrok.Ngrok (use Git Bash/WSL)"
  echo "Or place the binary here as ./ngrok"
  exit 1
fi
echo "✅ ngrok found at: $NGROK_BIN"
echo

# --- Check authentication; if missing, prompt to add authtoken
echo "🔧 Checking ngrok authentication..."
if ! "$NGROK_BIN" config check >/dev/null 2>&1; then
  echo "⚠️  No ngrok authentication found."
  read -r -p "Enter your ngrok authtoken (or leave blank to skip): " TOKEN || true
  if [ -n "${TOKEN:-}" ]; then
    "$NGROK_BIN" config add-authtoken "$TOKEN"
    echo "✅ Auth token saved."
  else
    echo "ℹ️  Skipping token setup. You can run:"
    echo "    $NGROK_BIN config add-authtoken <YOUR_TOKEN>"
    echo "   (Get your token: https://dashboard.ngrok.com/get-started/your-authtoken)"
  fi
else
  echo "✅ ngrok authentication configured"
fi

# --- Paths
CONFIG_DIR="${HOME}/.config/ngrok"
CONFIG_FILE="${CONFIG_DIR}/ngrok.yml"
mkdir -p "$CONFIG_DIR"

# --- Keep a backup if a config already exists
if [ -f "$CONFIG_FILE" ]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  cp "$CONFIG_FILE" "${CONFIG_FILE}.bak.${TS}"
  echo "🗂  Existing config backed up to ${CONFIG_FILE}.bak.${TS}"
fi

# --- Settings (override via env)
PORT="${PORT:-3002}"
# Set this to your reserved dev domain (from your screenshot):
NGROK_HOSTNAME="${NGROK_HOSTNAME:-tangential-ela-brashy.ngrok-free.dev}"
# Optional region: af, eu, us, ap, au, in, jp, sa
NGROK_REGION="${NGROK_REGION:-}"
# Optional Basic Auth "user:pass" (leave empty to disable)
NGROK_BASIC_AUTH="${NGROK_BASIC_AUTH:-}"

REGION_LINE=""
[ -n "$NGROK_REGION" ] && REGION_LINE="region: ${NGROK_REGION}"

BASICAUTH_BLOCK=""
if [ -n "$NGROK_BASIC_AUTH" ]; then
  BASICAUTH_BLOCK=$(cat <<BAUTH
    basic_auth:
      - "${NGROK_BASIC_AUTH}"
BAUTH
)
fi

# --- Write config
echo
echo "🔧 Writing ngrok configuration to: $CONFIG_FILE"
cat > "$CONFIG_FILE" <<EOF
version: "2"
${REGION_LINE}
tunnels:
  synercore:
    proto: http
    addr: ${PORT}
${BASICAUTH_BLOCK}
EOF

# Note: Custom hostnames and bind_tls require paid plans
if [ -n "${NGROK_HOSTNAME:-}" ] && [ "$NGROK_HOSTNAME" != "tangential-ela-brashy.ngrok-free.dev" ]; then
  echo "ℹ️  Note: Custom hostname '$NGROK_HOSTNAME' requires a paid ngrok plan"
fi

echo "✅ Configuration created"

# --- Validate config
echo "🧪 Validating config..."
if "$NGROK_BIN" config check >/dev/null 2>&1; then
  echo "✅ Config validation passed."
else
  echo "❌ Config validation failed. See ${CONFIG_FILE} (a backup was saved)."
  exit 1
fi

echo
echo "🚀 Setup complete!"
echo "Next steps:"
echo "  1) Start:   ./scripts/start-ngrok.sh"
echo "  2) Stop:    ./scripts/stop-ngrok.sh"
echo
echo "Tips:"
echo "  - Change port at runtime:   PORT=3002 ./scripts/start-ngrok.sh"
echo "  - Set region (optional):    NGROK_REGION=af ./scripts/start-ngrok.sh"
echo "  - Enable basic auth:        NGROK_BASIC_AUTH='tino:StrongPass' ./scripts/start-ngrok.sh"
echo "  - Override hostname:        NGROK_HOSTNAME='myname.ngrok.dev' ./scripts/start-ngrok.sh"