#!/bin/bash

# Check ngrok tunnel status for Synercore Import Schedule

echo "📊 Ngrok Status Check"
echo "===================="

# Check if ngrok binary exists
if [ ! -f "./ngrok" ]; then
    echo "❌ ngrok binary not found"
    echo "Run ./scripts/setup-ngrok.sh to set up ngrok"
    exit 1
fi

echo "✅ ngrok binary found"

# Check if ngrok process is running
if [ -f ".ngrok.pid" ]; then
    PID=$(cat .ngrok.pid)
    if kill -0 "$PID" 2>/dev/null; then
        echo "✅ ngrok process running (PID: $PID)"

        # Check if tunnel URL is available
        if [ -f ".ngrok-url.txt" ]; then
            TUNNEL_URL=$(cat .ngrok-url.txt)
            echo "🌐 Tunnel URL: $TUNNEL_URL"

            # Test if tunnel is accessible
            if curl -s -o /dev/null -w "%{http_code}" "$TUNNEL_URL" | grep -q "200\|302\|404"; then
                echo "✅ Tunnel is accessible"
            else
                echo "⚠️  Tunnel may not be responding"
            fi
        else
            echo "⚠️  No tunnel URL found"
        fi

        # Show ngrok web interface status
        if curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
            echo "🔧 Ngrok web interface: http://localhost:4040"

            # Get tunnel info from API
            TUNNELS=$(curl -s http://localhost:4040/api/tunnels | grep -c '"public_url"')
            echo "📊 Active tunnels: $TUNNELS"
        else
            echo "⚠️  Ngrok web interface not accessible"
        fi
    else
        echo "❌ ngrok process not running (stale PID file)"
        rm -f .ngrok.pid
    fi
else
    echo "❌ ngrok not running"
fi

# Check if application is running
echo ""
echo "📱 Application Status"
echo "===================="

if nc -z localhost 3002 2>/dev/null; then
    echo "✅ Application running on port 3002"
else
    echo "❌ Application not running on port 3002"
    echo "Start with: npm run dev"
fi

echo ""
echo "Quick Commands:"
echo "  Start tunnel: ./scripts/start-ngrok.sh"
echo "  Stop tunnel:  ./scripts/stop-ngrok.sh"
echo "  Setup ngrok:  ./scripts/setup-ngrok.sh"