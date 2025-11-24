#!/bin/bash

# TypeScript Migration Script
# This script consolidates duplicate .js and .ts files, keeping the .ts versions

SERVER_DIR="/mnt/c/Users/Tino/Synercore Import Schedule/server"
DUPLICATES=(
  "db/add-referential-integrity"
  "db/connection"
  "middleware/auth"
  "middleware/errorHandler"
  "middleware/requestId"
  "routes/admin"
  "routes/auth"
  "routes/emailImport"
  "routes/notifications"
  "routes/quotes"
  "routes/reports"
  "routes/schedulerAdmin"
  "routes/shipments"
  "routes/supplierPortal"
  "routes/suppliers"
  "routes/warehouseCapacity"
  "services/archiveService"
  "services/emailImporter"
  "services/emailService"
  "services/pdfAnalyzer"
  "services/scheduledNotifications"
  "utils/AppError"
  "utils/envValidator"
  "utils/logger"
  "websocket/shipmentEvents"
  "websocket/socketManager"
)

echo "🔄 Starting TypeScript Migration..."
echo "=================================="

for file in "${DUPLICATES[@]}"; do
  JS_FILE="${SERVER_DIR}/${file}.js"
  TS_FILE="${SERVER_DIR}/${file}.ts"
  
  if [ -f "$JS_FILE" ] && [ -f "$TS_FILE" ]; then
    echo "Found duplicate: $file"
    
    # Check which one is larger (usually TS is more complete)
    JS_SIZE=$(wc -c < "$JS_FILE")
    TS_SIZE=$(wc -c < "$TS_FILE")
    
    if [ $TS_SIZE -gt $JS_SIZE ]; then
      echo "  ✓ Keeping .ts version (${TS_SIZE} bytes)"
      echo "  ✗ Removing .js version (${JS_SIZE} bytes)"
      rm "$JS_FILE"
    else
      echo "  ✓ Keeping .js version (${JS_SIZE} bytes)"
      echo "  ✗ Removing .ts version (${TS_SIZE} bytes)"
      rm "$TS_FILE"
    fi
  elif [ -f "$JS_FILE" ]; then
    echo "Only .js exists: $file (keeping as is)"
  elif [ -f "$TS_FILE" ]; then
    echo "Only .ts exists: $file (good - already migrated)"
  else
    echo "⚠️  Neither version found: $file"
  fi
done

echo ""
echo "✅ Migration complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Review server/index.js and update all imports to use .ts extensions"
echo "2. Run 'npm run build' to verify TypeScript compilation"
echo "3. Test the application"
