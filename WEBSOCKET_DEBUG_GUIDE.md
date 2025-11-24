# WebSocket Connection Troubleshooting Guide

## Overview

When you see the message **"Real-time sync unavailable - Using polling mode"**, it means the WebSocket connection failed and the app is falling back to polling data every 30 seconds. This guide helps you diagnose and fix the issue.

## Quick Diagnosis

### Step 1: Check Browser Console
Open your browser's **Developer Tools** (`F12`) and go to the **Console** tab. Look for messages starting with `[SocketClient]`:

**Expected logs on successful connection:**
```
[2024-11-20T10:30:45.123Z] [SocketClient] Attempting connection {url: "http://localhost:5001", hasAuthToken: true, env: "development", apiBase: "http://localhost:5001/api"}
[2024-11-20T10:30:46.456Z] [SocketClient] ✓ Connected successfully {socketId: "abc123xyz", transport: "websocket"}
```

**Error logs if connection fails:**
```
[2024-11-20T10:30:45.789Z] [SocketClient] ✗ Connection error {error: "ECONNREFUSED", attempt: 1, maxAttempts: 5}
[2024-11-20T10:30:46.234Z] [SocketClient] ✗ Reconnection attempt {attempt: 2}
...
[2024-11-20T10:30:50.567Z] [SocketClient] ✗ Max reconnection attempts reached - WebSocket will be unavailable {totalAttempts: 5, fallback: "Using polling mode for data updates"}
```

### Step 2: Check Network Tab
In **Developer Tools**, go to the **Network** tab:

1. Filter by **WS** (WebSocket) or **Socket.IO** connections
2. Look for a connection to your API server (e.g., `ws://localhost:5001/socket.io/`)
3. Check the **Status** column:
   - ✓ `101 Switching Protocols` = Successfully connected
   - ✗ `0` or blank = Connection refused
   - ✗ `400`, `403`, `401` = Authentication error

### Step 3: Check Server Logs
When the server starts, you should see:
```
[SocketManager] Initializing with allowed origins: [...]
✓ Socket.io initialized successfully
✓ Listening for WebSocket connections on configured transports: websocket, polling
```

When a client connects, you should see:
```
[SocketManager] ✓ Connection established: user=john_doe, socketId=abc123xyz
[SocketManager] Authenticated connection: userId=user_123, role=user, socketId=abc123xyz
```

## Common Issues and Fixes

### Issue 1: Backend Server Not Running

**Symptoms:**
- Browser console: `Error: ECONNREFUSED`
- Network tab: Connection refused / pending forever

**Fix:**
```bash
# Terminal - Navigate to project root
cd "/mnt/c/Users/Tino/Synercore Import Schedule"

# Install dependencies if needed
npm install

# Start the server
npm run dev
```

**Expected output:**
```
Server running on http://localhost:5001
✓ Database connected
✓ Socket.io initialized successfully
```

---

### Issue 2: Wrong API Base URL

**Symptoms:**
- Browser console: Connection attempts show wrong URL
- Network tab: Connection attempts to wrong server

**Check:**
1. Open **Developer Tools** → **Application** tab
2. Go to **Local Storage**
3. Check what the API base URL is set to

**For Development:**
```
Should be: http://localhost:5001 (or your server address)
```

**For Production:**
```
Check the VITE_API_BASE_URL environment variable in your .env file
```

**Fix:**
```bash
# Create/update .env file in project root
VITE_API_BASE_URL=http://localhost:5001
```

---

### Issue 3: Authentication Token Missing or Expired

**Symptoms:**
- Browser console: No `hasAuthToken: true` in logs
- Server console: Socket authentication failed error
- Network tab: Connection shows `error: "Authentication error"`

**Check:**
1. Open **Developer Tools** → **Application** → **Local Storage**
2. Look for these keys:
   - `auth_access_token` - Main JWT token
   - `auth_token` - Legacy token (backup)
   - `auth_token_expiry` - Token expiration time

**If tokens are missing:**
- Log out completely and log back in
- Make sure you're logged in before the app tries to connect

**If tokens are expired:**
- Log out and log back in
- Or wait for automatic token refresh (should happen automatically)

---

### Issue 4: CORS Configuration Issue

**Symptoms:**
- Browser console: Cross-Origin errors
- Server console: No connection logs appear
- Network tab: Preflight (OPTIONS) request fails with 403/401

**Fix:**
The server's CORS configuration allows these origins by default:
- `http://localhost:3000`
- `http://localhost:3002`
- `http://localhost:5173`
- `https://synercore-frontend.vercel.app`

**If you're running on a different port:**

Add your URL to the server's environment:
```bash
# server/.env or system environment variables
ALLOWED_ORIGINS=http://localhost:YOUR_PORT,http://192.168.x.x:PORT
```

**Restart the server after changing environment variables**

---

### Issue 5: Firewall Blocking WebSocket

**Symptoms:**
- Browser console: Connection timeout (no response)
- Network tab: Connection pending forever, then fails
- Server logs: No connection attempts appear

**Fix:**
- If running locally: Usually not an issue
- If connecting remotely:
  - Check firewall allows WebSocket traffic on the server port (default 5001)
  - Verify the port isn't blocked by ISP or network

**Test connectivity:**
```bash
# On your machine, test if you can reach the server
curl -I http://your-server-ip:5001/

# Should return a 404 or 200, not "Connection refused"
```

---

### Issue 6: JWT_SECRET Not Set on Server

**Symptoms:**
- Server won't start
- Server console: `Error: JWT_SECRET environment variable is required`
- App gets no WebSocket connections

**Fix:**
```bash
# Set JWT_SECRET environment variable
export JWT_SECRET=your-secret-key-here

# Then start server
npm run dev

# Or set it in .env file:
echo "JWT_SECRET=your-secret-key-here" >> server/.env
```

---

## Expected Behavior

### With WebSocket Working ✓

1. Browser console shows:
   ```
   [SocketClient] ✓ Connected successfully {socketId: "...", transport: "websocket"}
   ```

2. Network tab shows:
   ```
   WebSocket connection to ws://localhost:5001/socket.io/?...
   Status: 101 Switching Protocols
   ```

3. App shows no "Real-time sync unavailable" message

4. Real-time updates work instantly (no refresh delay)

### With Polling Fallback ✓

1. Browser console shows:
   ```
   [SocketClient] ✗ Max reconnection attempts reached
   ```

2. App shows:
   ```
   "Real-time sync unavailable - Using polling mode"
   ```

3. Data still updates but every 30 seconds (slower)

4. This is a safe fallback - app still works, just not in real-time

---

## Advanced Debugging

### Enable Verbose Logging

**For Socket.io client debugging:**
```javascript
// Add to browser console
localStorage.debug = 'socket.io-client:*';
// Then reload the page
```

**For Socket.io server debugging:**
```bash
# Set environment variable before running
export DEBUG=socket.io:*
npm run dev
```

---

### Test WebSocket Directly

**Using curl (bash):**
```bash
# Check if server is listening on the port
curl -v http://localhost:5001/

# Should return something (even a 404 is fine - means server is responding)
```

**Using Node.js repl:**
```javascript
// In browser console
const socket = io('http://localhost:5001');
socket.on('connect', () => console.log('Connected!'));
socket.on('error', (err) => console.error('Error:', err));
socket.on('disconnect', (reason) => console.warn('Disconnected:', reason));
```

---

### Collect Diagnostic Information

Before reporting an issue, gather:

1. **Browser console output** - Copy all `[SocketClient]` logs
2. **Server console output** - Copy all `[SocketManager]` logs
3. **Network tab** - Screenshot WebSocket connection attempt
4. **System info**:
   ```bash
   node --version
   npm --version
   ```

---

## Fallback Behavior (Still Safe!)

Even if WebSocket fails, the app is **still fully functional**:

- **Polling mode** fetches data every 30 seconds
- **Real-time features** won't work until WebSocket connects
- **Data consistency** is maintained
- **App remains responsive** and usable

The fallback ensures the app **never breaks**, just degrades gracefully.

---

## Configuration Reference

### Client Configuration
**File:** `src/utils/socketClient.js`

| Setting | Value | Purpose |
|---------|-------|---------|
| Reconnection | true | Auto-reconnect on disconnect |
| Reconnection Delay | 1000ms | Initial delay before retry |
| Max Reconnection Delay | 5000ms | Maximum delay between retries |
| Max Reconnection Attempts | 5 | Total retry attempts before giving up |
| Transports | `['websocket', 'polling']` | Try WebSocket first, fallback to polling |

### Server Configuration
**File:** `server/websocket/socketManager.js`

| Setting | Value | Purpose |
|---------|-------|---------|
| Ping Interval | 25 seconds | Keep-alive heartbeat frequency |
| Ping Timeout | 60 seconds | Disconnect if no response |
| Max Buffer Size | 1MB | Max message size |
| CORS Transports | websocket, polling | Both protocols allowed |

### Environment Variables
**Location:** `.env` file or system environment

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `JWT_SECRET` | YES | none | Required for authentication |
| `PORT` | NO | 5001 | Server port |
| `VITE_API_BASE_URL` | NO | http://localhost:5001 | Backend URL (development) |
| `FRONTEND_URL` | NO | https://synercore-frontend.vercel.app | Allowed CORS origin |
| `ALLOWED_ORIGINS` | NO | none | Additional CORS origins (comma-separated) |
| `NODE_ENV` | NO | development | Logging verbosity |

---

## Getting Help

If the issue persists after trying these steps:

1. Check [Socket.io documentation](https://socket.io/docs/v4/)
2. Review server logs for detailed error messages
3. Verify all environment variables are set correctly
4. Ensure backend and frontend are on compatible versions

**Common Discord/Support patterns to search:**
- "WebSocket connection refused"
- "CORS blocking socket.io"
- "Socket authentication failed"
