# Supplier Portal Access Guide

## Overview

The Synercore Supplier Portal is a **completely separate application** from the main Synercore Supply Chain Management system. Suppliers have **exclusive access to the portal** and cannot access any other parts of the Synercore application.

### Key Points:
- ✅ Suppliers login ONLY to the Supplier Portal
- ✅ Suppliers can view their shipments, upload documents, and access reports
- ❌ Suppliers CANNOT access the main Synercore app
- ❌ Suppliers CANNOT view other supplier data
- ❌ Suppliers CANNOT manage system settings

---

## How Suppliers Access the Portal

### URL Structure

**Supplier Portal:**
```
https://synercore.com/supplier
```

**Main Synercore App (Internal Users Only):**
```
https://synercore.com/
```

### Local Development

**Supplier Portal:**
```
http://localhost:3002/supplier
```

**Main Synercore App (Internal Users Only):**
```
http://localhost:3002/
```

---

## Supplier Portal Features

### 1. Login
Suppliers can login with their assigned email and password:

**Example Login Credentials:**
```
Email:    admin@qida.supplier
Password: CazHyqm$jnz^ng@b
```

### 2. My Shipments Tab
- View all shipments associated with the supplier
- Filter by status (In Transit, Arrived, Stored, Received, etc.)
- Click on any shipment to view details

### 3. Shipment Details
- View complete shipment information (order reference, product, quantity, pallets)
- View expected arrival date and destination
- Upload and manage documents (POD, Delivery Proof, Customs Documents, etc.)
- See uploaded documents and verification status

### 4. Reports Tab
- View statistics:
  - Total shipments
  - Delivered shipments
  - In-transit shipments
  - Documents uploaded
  - Shipments by status breakdown

### 5. Logout
- Safely logout from the portal
- Returns to the login page

---

## Sharing Portal Credentials with Suppliers

### Email Template

Use this template to communicate supplier access information:

```
Subject: Synercore Supplier Portal Access Instructions

Dear [Supplier Name],

We're pleased to provide you with access to the Synercore Supplier Portal!

📍 SUPPLIER PORTAL URL
https://synercore.com/supplier

🔐 YOUR LOGIN CREDENTIALS
Email:    [email]
Password: [password]

📦 WHAT YOU CAN DO IN THE PORTAL
✅ View all your shipments in real-time
✅ Filter shipments by status (Planned, In Transit, Arrived, Stored, Received)
✅ Click on any shipment to see detailed information
✅ Upload and manage documents:
   - Proof of Delivery (POD)
   - Delivery Proof (Tracking information)
   - Customs Documents (Import/export paperwork)
   - Other supporting documents
✅ Access performance reports and analytics
✅ View shipment statistics and status breakdown

🔒 SECURITY BEST PRACTICES
1. Change your password on first login
2. Never share your login credentials
3. Logout when you're finished using the portal
4. Use a strong, unique password
5. If you forget your password, contact support@synercore.com

📞 TECHNICAL SUPPORT
For any issues accessing or using the Supplier Portal, please contact:
support@synercore.com

Thank you for partnering with Synercore!

Best regards,
Synercore Team
```

---

## Technical Architecture

### Two Separate Applications

The Synercore system consists of two completely separate frontend applications:

#### Main Synercore App
- **Entry Point:** `/` (index.html)
- **Users:** Internal Synercore employees (admins, managers, warehouse staff)
- **Features:** Full supply chain management, reporting, user management, system settings
- **Authentication:** Username/password (internal auth)

#### Supplier Portal App
- **Entry Point:** `/supplier` (supplier.html)
- **Users:** External suppliers only
- **Features:** View own shipments, upload documents, view reports
- **Authentication:** Email/password (supplier account auth)

### Build Configuration

The `vite.config.mjs` is configured to build both applications:

```javascript
build: {
  outDir: 'dist',
  rollupOptions: {
    input: {
      main: './index.html',       // Main app
      supplier: './supplier.html'  // Supplier portal
    }
  }
}
```

**Build Output:**
- `dist/index.html` - Main Synercore app
- `dist/supplier.html` - Supplier Portal
- Both share the same API backend at `/api/`

### API Architecture

Both applications use the same backend server:

**Main App API Routes:**
- `/api/auth/login` - Admin/internal user login
- `/api/shipments` - Shipment management
- `/api/suppliers` - Supplier management
- `/api/admin/*` - Admin operations
- etc.

**Supplier Portal API Routes:**
- `/api/supplier/login` - Supplier login
- `/api/supplier/register` - Supplier registration
- `/api/supplier/shipments` - Supplier's own shipments
- `/api/supplier/documents` - Document upload
- `/api/supplier/reports` - Supplier reports
- etc.

### Authentication Tokens

Each system uses separate localStorage keys to prevent mixing:

**Main App:**
- `token` - JWT access token for internal users
- `user` - User data object

**Supplier Portal:**
- `supplier_token` - JWT access token for suppliers
- `supplier_user` - Supplier user data object

This ensures:
- ✅ Suppliers cannot access main app token storage
- ✅ Internal users cannot access supplier token storage
- ✅ Complete isolation between the two systems

---

## Deployment Instructions

### Development

Start both apps in development:

```bash
# Terminal 1 - Main app (port 3002, path /)
npm run dev

# Terminal 2 - Supplier portal accessible at (port 3002, path /supplier)
# Same dev server - Vite serves both index.html and supplier.html
```

### Production Build

Build both applications:

```bash
npm run build
```

This creates:
- `dist/index.html` - Main app (served at `/`)
- `dist/supplier/index.html` - Supplier portal (served at `/supplier`)
- `dist/assets/` - Shared assets for both apps

### Vercel/Railway Deployment

Configure your platform to:
1. Run `npm run build` to build both apps
2. Set output directory to `dist/`
3. Configure rewrites so:
   - `/supplier*` → `dist/supplier.html`
   - `/*` → `dist/index.html`

**Vercel Example (vercel.json):**
```json
{
  "rewrites": [
    { "source": "/supplier/(.*)", "destination": "/supplier.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## URL Access Patterns

| URL | App | Purpose |
|-----|-----|---------|
| `/` | Main App | Internal Synercore dashboard (admin login required) |
| `/supplier` | Supplier Portal | Supplier access (supplier login required) |
| `/supplier/` | Supplier Portal | Alternative access path |
| `/api/*` | Backend API | API endpoints for both apps |

---

## Security Features

### Access Control
- ✅ Suppliers can ONLY login to `/supplier`
- ✅ Main app has completely separate authentication
- ✅ API enforces role-based access control
- ✅ Suppliers can only view their own shipments

### Data Isolation
- ✅ Supplier queries filtered by supplier_id
- ✅ No cross-supplier data visibility
- ✅ Supplier tokens only grant access to supplier routes
- ✅ Main app token structure prevents supplier access

### Token Management
- ✅ JWT tokens are signed with secret key
- ✅ Tokens expire after 15 minutes (supplier) / configurable (main)
- ✅ Refresh tokens for session persistence
- ✅ Secure token storage in localStorage (with HTTPS in production)

---

## Troubleshooting

### Problem: Supplier lands on main app instead of portal

**Solution:** Direct them to `/supplier` URL, not just `/`

### Problem: Supplier cannot login

**Solution:**
1. Check email address is correct (case-insensitive)
2. Verify password is correct
3. Check account is active in database:
   ```sql
   SELECT email, is_active FROM supplier_accounts
   WHERE email = 'admin@supplier.com';
   ```
4. Check no duplicate accounts exist

### Problem: Supplier sees "Error loading shipments"

**Solution:**
1. Check supplier name matches in both tables:
   ```sql
   -- Check suppliers table
   SELECT id, name FROM suppliers WHERE id = [supplier_id];

   -- Check shipments table
   SELECT DISTINCT supplier FROM shipments LIMIT 10;
   ```
2. Ensure flexible matching is working in controller
3. Check database query in logs

### Problem: CORS errors when accessing portal

**Solution:**
1. Check CORS whitelist includes `/supplier` origin
2. Verify `ALLOWED_ORIGINS` environment variable includes supplier domain
3. Check API server is running and accessible

---

## Admin Operations

### Register a Supplier

**Option 1: Self-Registration**
- Supplier navigates to `/supplier`
- Clicks "Register" tab
- Fills in form with Supplier ID, email, password

**Option 2: Bulk Registration (Admin)**
```bash
node server/scripts/bulkRegisterSuppliers.js
```
This auto-generates credentials for all suppliers in the database.

### Reset Supplier Password

```bash
# Option 1: Run bulk registration again (resets all passwords)
node server/scripts/bulkRegisterSuppliers.js

# Option 2: Manual database update
UPDATE supplier_accounts
SET password_hash = bcrypt('new_password', 10)
WHERE email = 'admin@supplier.com';
```

### Deactivate Supplier Access

```sql
UPDATE supplier_accounts
SET is_active = false
WHERE supplier_id = '1757586493291';
```

### View Supplier Activity

```sql
-- Last login
SELECT email, last_login FROM supplier_accounts
WHERE email = 'admin@qida.supplier';

-- Documents uploaded by supplier
SELECT COUNT(*) as document_count,
       COUNT(DISTINCT shipment_id) as shipments_with_docs
FROM supplier_documents
WHERE supplier_id = '1757586493291';
```

---

## Testing Checklist

- [ ] Navigate to `/supplier` and see login page
- [ ] Login with supplier credentials
- [ ] See shipments list in "My Shipments" tab
- [ ] Filter shipments by status
- [ ] Click on shipment to view detail
- [ ] Upload a test document
- [ ] Check document appears in detail view
- [ ] Click "Reports" tab and see statistics
- [ ] Try accessing `/` (main app) - should see different login
- [ ] Try typing `/api/shipments` directly - should get 401 without supplier token
- [ ] Logout and confirm returned to login page
- [ ] Test on mobile device - responsive design

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2025-11-14 | 1.0 | Initial supplier portal release with separate entry point |

---

## Related Documentation

- [SUPPLIER_CREDENTIALS.md](./SUPPLIER_CREDENTIALS.md) - Supplier login credentials
- [server/controllers/supplierController.js](./server/controllers/supplierController.js) - API implementation
- [server/routes/supplierPortal.js](./server/routes/supplierPortal.js) - Route definitions
