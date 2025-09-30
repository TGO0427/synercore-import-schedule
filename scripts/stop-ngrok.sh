#!/usr/bin/env bash
set -euo pipefail

# Try to stop any running ngrok agent
if pgrep -x ngrok >/dev/null 2>&1; then
  echo "🛑 Stopping ngrok..."
  # Graceful kill
  pkill -x ngrok || true
  # Wait a moment
  sleep 1
  if pgrep -x ngrok >/dev/null 2>&1; then
    echo "⚠️  ngrok still running; forcing stop..."
    pkill -9 -x ngrok || true
  fi
  echo "✅ ngrok stopped."
else
  echo "ℹ️  No ngrok process found."
fi