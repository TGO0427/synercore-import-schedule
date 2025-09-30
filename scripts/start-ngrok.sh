#!/usr/bin/env bash
set -euo pipefail

# Resolve ngrok binary
if command -v ngrok >/dev/null 2>&1; then
  NGROK_BIN="$(command -v ngrok)"
elif [ -x "./ngrok" ]; then
  NGROK_BIN="./ngrok"
else
  echo "❌ ngrok not found. Run ./scripts/setup-ngrok.sh first."
  exit 1
fi

# Allow overriding port at runtime (defaults to 3002); if provided, we patch a temp config
PORT="${PORT:-${1:-3002}}"
CONFIG_FILE="${HOME}/.config/ngrok/ngrok.yml"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ Config not found at $CONFIG_FILE"
  echo "Run ./scripts/setup-ngrok.sh to create it."
  exit 1
fi

# Get the configured hostname for display
HOSTNAME=$(grep -A 10 'synercore:' "$CONFIG_FILE" | grep 'hostname:' | sed 's/.*hostname: *//' | tr -d '"' || echo "auto-generated")

# Create a temp config with the chosen PORT (so you can do PORT=4000 ./scripts/start-ngrok.sh)
TMP_CFG=""
cleanup() { [ -n "$TMP_CFG" ] && rm -f "$TMP_CFG"; }
trap cleanup EXIT

if grep -q 'tunnels:' "$CONFIG_FILE"; then
  TMP_CFG="$(mktemp)"
  # Replace 'addr:' line for synercore tunnel to current PORT
  awk -v p="$PORT" '
    BEGIN { in_tunnel=0 }
    /synercore:/ { in_tunnel=1 }
    in_tunnel==1 && $1=="addr:" { sub($2, p); print; next }
    { print }
    /[^ ]\S:/ && $1!="synercore:" && in_tunnel==1 { in_tunnel=0 }
  ' "$CONFIG_FILE" > "$TMP_CFG"
else
  echo "❌ Unexpected ngrok config format. Re-run setup."
  exit 1
fi

echo "🚀 Starting ngrok tunnel 'synercore' on http://localhost:${PORT} ..."
if [ "$HOSTNAME" != "auto-generated" ]; then
  echo "🌐 Your app will be available at: https://${HOSTNAME}"
fi
echo "   (Press Ctrl+C to stop; or run ./scripts/stop-ngrok.sh)"

# Start ngrok in background and capture PID
"$NGROK_BIN" start --config "$TMP_CFG" synercore &
NGROK_PID=$!

# Wait a moment for ngrok to start
sleep 3

# Try to get and display the actual URL
if curl -s http://localhost:4040/api/tunnels >/dev/null 2>&1; then
  PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*' | grep -o 'https://[^"]*' | head -1)
  if [ -n "$PUBLIC_URL" ]; then
    echo ""
    echo "🎉 Tunnel active! Your Synercore Import Schedule is live at:"
    echo "📱 $PUBLIC_URL"
    echo "🔧 Ngrok dashboard: http://localhost:4040"
    echo ""
  fi
fi

# Wait for the ngrok process
wait $NGROK_PID