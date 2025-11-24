# Supplier Portal - Quick Reference Guide

## How Suppliers Access the Portal

### URLs
| URL | Purpose | Users |
|-----|---------|-------|
| `http://localhost:3002/supplier` | Dev: Supplier Portal | External Suppliers |
| `https://synercore.com/supplier` | Prod: Supplier Portal | External Suppliers |
| `http://localhost:3002/` | Dev: Main App | Internal Staff |
| `https://synercore.com/` | Prod: Main App | Internal Staff |

## Access Flow

```
SUPPLIER JOURNEY:
1. Supplier receives email with portal URL and login credentials
2. Supplier navigates to https://synercore.com/supplier
3. Supplier enters email and password
4. Supplier sees dashboard with their shipments only
5. Supplier can:
   - View shipments by status
   - Click to see shipment details
   - Upload delivery/customs documents
   - View performance reports
6. Supplier logs out
```

```
INTERNAL USER JOURNEY:
1. Internal user navigates to https://synercore.com/
2. User enters username and password (internal auth)
3. User sees main Synercore dashboard
4. User can manage all shipments, suppliers, reports, etc.
5. User cannot access supplier portal (different app)
```

## Key Design Points

### ✅ What Suppliers CAN Do
- Login to `/supplier` portal
- View their own shipments
- Filter by status
- View detailed shipment info
- Upload documents (POD, customs, delivery proof)
- View performance reports
- Logout

### ❌ What Suppliers CANNOT Do
- Access the main Synercore app (`/`)
- View other suppliers' shipments
- Modify shipment data
- Access system settings
- Manage users or warehouses
- View analytics or admin features

### ✅ What Internal Users CAN Do
- Access main Synercore app (`/`)
- Full supply chain management
- User and warehouse management
- System settings
- All reports and analytics
- Manage suppliers

### ❌ What Internal Users CANNOT Do
- Access supplier portal directly (different app)
- Impersonate suppliers
- View supplier-only functionality

## Architecture

```
┌─────────────────────────────────────────┐
│         Browser / Internet              │
└────────┬────────────────────────────────┘
         │
         ├── GET http://localhost:3002/
         │   └─> index.html (Main App)
         │       └─> App.jsx
         │           └─> LoginPage (internal auth)
         │
         ├── GET http://localhost:3002/supplier
         │   └─> supplier.html (Supplier Portal)
         │       └─> SupplierPortalApp.jsx
         │           └─> SupplierLogin (supplier auth)
         │
         └── GET http://localhost:5001/api/*
             └─> Express Backend
                 ├── /api/auth/* (main app auth)
                 ├── /api/supplier/* (supplier auth)
                 ├── /api/shipments (main app)
                 └── ... other routes
```

## Token Storage

**Main App (localStorage):**
```javascript
localStorage.getItem('token')        // Main user JWT
localStorage.getItem('user')         // Main user data
```

**Supplier Portal (localStorage):**
```javascript
localStorage.getItem('supplier_token')   // Supplier JWT
localStorage.getItem('supplier_user')    // Supplier data
```

This separation ensures suppliers cannot accidentally use main app token.

## Build & Deployment

### Development
```bash
npm run dev
# Access both apps from same port:
# - Main app: http://localhost:3002/
# - Supplier portal: http://localhost:3002/supplier
```

### Production Build
```bash
npm run build
# Creates:
# - dist/index.html (main app)
# - dist/supplier.html (supplier portal)
# - dist/assets/ (shared assets)
```

### Deployment Platforms

**Vercel/Railway/Netlify:**
- Configure to serve both `index.html` and `supplier.html`
- Use URL rewrites to route `/supplier*` to `supplier.html`
- All other routes go to `index.html`

## Communication to Suppliers

**Email Subject:** Synercore Supplier Portal Access

**Key Information to Include:**
1. Portal URL: `https://synercore.com/supplier`
2. Email: `admin@[company].supplier`
3. Temporary Password: `[generated password]`
4. Instruction to change password on first login
5. Support contact: `support@synercore.com`

**What Suppliers Can Do:**
- View shipments
- Filter by status
- Upload documents
- View reports

## Testing Checklist for Deployment

- [ ] Navigate to `/supplier` → See supplier login
- [ ] Navigate to `/` → See main app login (different)
- [ ] Login as supplier → See dashboard
- [ ] Cannot navigate from supplier portal to main app
- [ ] Cannot see main app routes from supplier portal
- [ ] Logout as supplier → Back to supplier login
- [ ] Login as internal user → See main app
- [ ] Cannot accidentally see supplier portal data in main app
- [ ] API returns 401 when using wrong token type
- [ ] Database queries filter by supplier_id correctly

## Files Changed/Created

### New Files
- `supplier.html` - Supplier portal HTML entry point
- `src/SupplierPortalApp.jsx` - Standalone supplier app component
- `src/supplier-main.jsx` - Supplier portal entry point (React root)
- `SUPPLIER_PORTAL_ACCESS.md` - Comprehensive access guide
- `SUPPLIER_ACCESS_QUICK_REFERENCE.md` - This file

### Modified Files
- `vite.config.mjs` - Added build config for both entry points

### Existing Files (No Changes)
- `src/pages/SupplierLogin.jsx` - Works as supplier portal login
- `src/pages/SupplierDashboard.jsx` - Supplier dashboard
- `server/routes/supplierPortal.js` - API routes
- `server/controllers/supplierController.js` - Controller logic

## Commits

| Commit | Message |
|--------|---------|
| `96608a3` | Create separate supplier portal entry point with exclusive access |
| `fc11836` | Fix status filter dropdown in supplier portal |
| `b8d6d38` | Fix supplier controller database schema mismatch |

## Support

For questions or issues:
1. Check `SUPPLIER_PORTAL_ACCESS.md` for detailed documentation
2. Check logs: `server logs` or browser console
3. Test API endpoints directly: `curl http://localhost:5001/api/supplier/shipments`
4. Verify database: Check `supplier_accounts` table exists and has data

## Next Steps

1. **Share with Suppliers:**
   - Email portal URL to all suppliers
   - Include credentials from SUPPLIER_CREDENTIALS.md
   - Ask them to change passwords on first login

2. **Monitor Usage:**
   - Track login attempts in logs
   - Monitor document uploads
   - Collect feedback on portal experience

3. **Future Enhancements:**
   - Forgot password functionality
   - Two-factor authentication
   - Email notifications for shipment updates
   - Mobile app version
   - Advanced shipment tracking with maps
