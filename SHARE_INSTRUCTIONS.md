# Synercore Import Schedule - Sharing Instructions

## Quick Setup for Colleagues

### Option 1: Use ngrok (Recommended)
1. Download ngrok: https://ngrok.com/download
2. Extract to Desktop
3. Open Windows Command Prompt:
   ```cmd
   cd C:\Users\[YourName]\Desktop\ngrok
   ngrok.exe http 3002
   ```
4. Share the https://xxx.ngrok.io URL that appears

### Option 2: Local Network (If on same network)
**Windows IP addresses to try:**
- Check Windows Command Prompt: `ipconfig`
- Look for "Ethernet adapter" or "WiFi adapter"
- Try: `http://[IP-ADDRESS]:3002/`

Common IP patterns:
- `http://192.168.1.xxx:3002/`
- `http://192.168.0.xxx:3002/`
- `http://10.0.0.xxx:3002/`

### Option 3: Share Project Folder
1. Zip this entire folder
2. Send to colleagues
3. Instructions for them:
   ```bash
   # Extract the zip file
   # Open terminal/command prompt in the folder
   npm install
   npm run dev
   ```

## Current Status
- ✅ Application is running
- ✅ Accessible locally at http://localhost:3002/
- ❌ Network access blocked (likely firewall)

## Features Available
- Import/Export Excel shipment data
- Track shipment status and timing
- Generate PDF and Excel reports
- Manage forwarding agents (DHL, DSV, MSC, etc.)
- Real-time shipment analytics

## Troubleshooting
If colleagues can't connect:
1. Try ngrok (Option 1) - most reliable
2. Check Windows Firewall settings
3. Verify they're on the same network
4. Share the project folder instead (Option 3)