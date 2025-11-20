#!/bin/bash

# Fix supplier name mismatches via API
# This script updates supplier names to match shipment data

API_URL="https://synercore-import-schedule-production.up.railway.app"

# You need to be logged in to get a valid token
# Run this after getting an auth token from the browser

echo "🔧 Fixing supplier name mismatches..."
echo ""

# The supplier name fixes needed:
# 1. "AB Mauri " (with trailing space) → "AB Mauri"
# 2. "Aromsa" → "AROMSA"
# 3. "Shakti Chemicals" → "SHAKTI CHEMICALS"
# 4. " Sacco" (with leading space) → "SACCO"
# 5. "Deltaris" → "QUERCYL"

# First, get all suppliers to find their IDs
echo "📋 Fetching supplier list..."
curl -s -X GET "$API_URL/api/suppliers" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

echo ""
echo "❌ This script requires manual API calls with authentication token."
echo ""
echo "Instead, use the UI to fix these supplier names:"
echo ""
echo "1. Go to Supplier Management"
echo "2. Click Edit on each supplier:"
echo "   - 'AB Mauri ' → change to 'AB Mauri' (remove trailing space)"
echo "   - 'Aromsa' → change to 'AROMSA'"
echo "   - 'Shakti Chemicals' → change to 'SHAKTI CHEMICALS'"
echo "   - ' Sacco' → change to 'SACCO' (remove leading space)"
echo "   - 'Deltaris' → change to 'QUERCYL'"
echo "3. Click Save for each"
echo "4. Go back to Suppliers view"
echo "5. Check console - metrics should now work!"
