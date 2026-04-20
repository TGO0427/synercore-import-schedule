# Security Documentation

## Overview

This document outlines the security measures implemented in the Synercore Import Schedule application and provides guidance for maintaining security best practices.

## Recent Security Improvements

### Latest Updates (2026-04-20) — Authorization Hardening & Dependency Cleanup

A focused security review identified and remediated three HIGH-severity authorization gaps plus remaining dependency advisories.

**1. Public registration closed (broken auth / mass IDOR)**
- `POST /api/auth/register` previously created `is_active=true` accounts and issued JWTs immediately, so any internet caller could self-register and obtain a valid token.
- **Fix**: Registrations now create `is_active=false` accounts and return no tokens. An administrator must approve before the account can sign in. See `server/routes/auth.ts:297`.

**2. Destructive shipment routes gated by `requireAdmin`**
- Non-admin users could delete / bulk-import / bulk-archive / bulk-delete / bulk-restore shipments.
- **Fix**: Added `requireAdmin` to `DELETE /api/shipments/:id`, `POST /api/shipments/bulk-import`, `POST /api/shipments/bulk/archive`, `POST /api/shipments/bulk/delete`, `POST /api/shipments/bulk/restore`. PUT/PATCH/single-archive remain available to approved users for normal workflow.

**3. Warehouse-capacity PUT endpoints now require auth + admin**
- Previously accepted unauthenticated writes (including an explicit `// Simple update without authentication for now` comment).
- **Fix**: Added `authenticateToken, requireAdmin` to all three PUTs at `server/routes/warehouseCapacity.ts:108,155,244`.

**4. Supplier document reads restricted to admin**
- `GET /api/suppliers/:id/documents` and `GET /:id/documents/:filename` were gated only by `authenticateToken`, allowing any signed-in user to download any supplier's files.
- **Fix**: Added `requireAdmin`, matching the existing `DELETE` handler on the same path. Supplier-portal document access (where suppliers see their own docs) is unchanged and correctly gated by `requireSupplier` + ownership check.

**5. Supplier-portal IDOR via substring match**
- Six queries in `server/controllers/supplierController.js` used `LOWER(supplier) LIKE '%' || $name || '%'`, meaning supplier "ACME" could see rows for "ACME Inc", "ACME Global", etc.
- **Fix**: Replaced with exact case-insensitive equality (`LOWER(supplier) = LOWER($name)`) in all six queries (shipment list, count, detail, document-upload ownership check, report stats, report status breakdown).

**6. `/api/auth/setup` gated by `SETUP_TOKEN`**
- `/setup` auto-enabled whenever the `users` table was empty, meaning whoever raced the endpoint first after a DB reset became admin.
- **Fix**: Endpoint now returns 404 unless `SETUP_TOKEN` is set in env; when set, requires a matching `X-Setup-Token` header. Leave unset in steady-state production and set it only temporarily during DR bootstrap.

**7. `JWT_SECRET` rotated**
- All outstanding JWTs invalidated. Users re-authenticated.

**8. Dependency audit**
- `npm audit fix` resolved 13 of 15 advisories (brace-expansion, dompurify, express-rate-limit, jws, lodash, mailparser, minimatch, path-to-regexp via express, qs via body-parser, socket.io-parser).
- Remaining two require breaking-change bumps and are deferred with regression testing: `jspdf 3 → 4` (critical, PDF generation) and `nodemailer 6 → 8` (moderate, transitive via mailparser; low practical exploit surface here since the app parses rather than sends via nodemailer).

### Latest Updates (2025-11-19)

**Critical Issue #1 - Input Validation Integration**
- Added comprehensive input validation middleware to all mutation routes
- Implemented `validateShipmentCreate`, `validateSupplierCreate`, `validateSupplierUpdate` validators
- All POST, PUT, DELETE operations now validate input before database operations
- Prevents malicious or malformed data from being stored
- See: `server/middleware/validation.js`, `server/routes/shipments.js`, `server/routes/suppliers.js`

### Prior Updates (2025-10-20)

A comprehensive security audit was conducted and the following critical improvements were implemented:

### 1. Authentication & Authorization

#### JWT Secret Configuration
- **Issue**: JWT secret had a weak default fallback value
- **Fix**: JWT_SECRET environment variable is now **required** - application will not start without it
- **Action Required**: Set JWT_SECRET in Railway environment variables for production

```bash
# Generate a secure JWT secret:
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### Authentication Middleware
- **Issue**: Most API endpoints lacked authentication
- **Fix**: All protected endpoints now require valid JWT authentication
- **Protected Routes**:
  - `/api/shipments/*` - All shipment operations
  - `/api/suppliers/*` - All supplier operations
  - `/api/quotes/*` - Quote management
  - `/api/reports/*` - Report generation
  - `/api/email-import/*` - Email monitoring
  - `/api/admin/*` - Admin operations
  - `/api/documents/upload` - Document uploads
  - `/api/upload-excel` - Excel uploads

- **Public Routes**:
  - `/api/auth/*` - Authentication endpoints (with stricter rate limiting)
  - `/api/warehouse-capacity` - Read-only warehouse capacity (GET)
  - `/health` - Health check endpoint

### 2. Rate Limiting

#### Implementation
- **General API**: 100 requests per 15 minutes per IP
- **Authentication endpoints**: 5 requests per 15 minutes per IP (prevents brute force)

#### Configuration
Rate limiters are configured in `server/middleware/security.js` and can be adjusted:

```javascript
export const apiRateLimiter = createRateLimiter(15 * 60 * 1000, 100);
export const authRateLimiter = createRateLimiter(15 * 60 * 1000, 5);
```

### 3. Security Headers (Helmet)

The following security headers are now automatically applied to all responses:

- **Content-Security-Policy**: Restricts resource loading to prevent XSS
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-Frame-Options**: Prevents clickjacking
- **Strict-Transport-Security**: Forces HTTPS in production
- **X-XSS-Protection**: Additional XSS protection for older browsers

Configuration is in `server/middleware/security.js`.

### 4. Input Validation

#### Implementation
Created comprehensive validation middleware using `express-validator` in `server/middleware/validation.js`.

#### Available Validators
- `validateRegister` - User registration validation
- `validateLogin` - Login validation
- `validateChangePassword` - Password change validation
- `validateShipmentCreate` - Shipment creation validation
- `validateSupplierCreate` - Supplier creation validation
- `validateWarehouseCapacity` - Warehouse capacity update validation
- `validateShipmentQuery` - Query parameter validation
- `validatePagination` - Pagination validation

#### Usage Example
```javascript
import { validateShipmentCreate } from './middleware/validation.js';

router.post('/shipments', authenticateToken, validateShipmentCreate, async (req, res) => {
  // Handler code - input is already validated
});
```

### 5. SQL Injection Prevention

#### Issue
Dynamic ORDER BY clause in shipment queries was vulnerable to SQL injection.

#### Fix
- Implemented whitelist-based validation for sort columns
- Strict validation for sort order (ASC/DESC only)
- All database queries use parameterized queries

#### Example
```javascript
const allowedSortColumns = {
  'updated_at': 'updated_at',
  'orderRef': 'order_ref',
  'supplier': 'supplier',
  // ... complete whitelist
};

const sortColumn = allowedSortColumns[sortBy] || 'updated_at';
const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
```

### 6. SSL/TLS Configuration

#### Issue
SSL certificate validation was globally disabled, exposing the application to MITM attacks.

#### Fix
- SSL validation is now only disabled in development when explicitly configured
- Requires `NODE_ENV=development` AND `DISABLE_SSL_VERIFY=true`
- Production deployments use proper SSL certificate validation

#### Production Configuration
Railway environment variables (do NOT set DISABLE_SSL_VERIFY in production):
```
NODE_ENV=production
JWT_SECRET=<your-secret-here>
DATABASE_URL=<railway-provided>
```

### 7. Error Handling

#### Issue
Error details were exposed in production responses, potentially leaking sensitive information.

#### Fix
- Production mode: Generic error messages only
- Development mode: Detailed error messages with stack traces
- All errors logged server-side regardless of environment

## Security Best Practices

### Environment Variables

#### Required Variables
```bash
# CRITICAL - Must be set in production
JWT_SECRET=<64-character-random-hex-string>
DATABASE_URL=<railway-provided>
NODE_ENV=production
```

#### Optional Development Variables
```bash
# Only for local development
DISABLE_SSL_VERIFY=true  # NEVER set in production
```

### Password Requirements

All passwords must meet the following criteria:
- Minimum 6 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Authentication Flow

1. **Registration**: User submits credentials → account created with `is_active=false` → admin approval required before first login
2. **Login**: Approved user authenticates, server checks `is_active`, issues short-lived access token (15 min) + long-lived refresh token (7 days)
3. **Token Storage**: Client stores tokens securely
4. **API Requests**: Client includes access token in Authorization header:
   ```
   Authorization: Bearer <token>
   ```
5. **Token Verification**: Server validates token on each protected request; expired access tokens are refreshed via `/api/auth/refresh`

### Role-Based Access Control

#### Roles
- **admin**: Full access to all resources and admin-only endpoints
- **user**: Standard access to application features

#### Admin-Only Endpoints
- `POST /api/auth/admin/create-user` - Create new users
- `GET /api/auth/admin/users` - List all users
- `POST /api/admin/import-data` - Bulk data import

### File Upload Security

#### Current Implementation
- 10MB file size limit
- Multer memory storage
- File type filtering (where applicable)
- Filename sanitization

#### Recommendations
- Consider adding antivirus scanning for production
- Implement file type whitelist based on use case
- Store uploaded files in secure cloud storage (S3, etc.) instead of local filesystem

## Monitoring & Incident Response

### Security Monitoring

Monitor the following:
1. **Failed Authentication Attempts**: Rate limiter will block IPs after 5 failed attempts in 15 minutes
2. **API Rate Limit Violations**: Track IPs hitting rate limits
3. **Database Connection Failures**: Monitor Railway logs
4. **Unauthorized Access Attempts**: 401/403 responses

### Logging

All security-relevant events are logged:
- Authentication failures
- Rate limit violations
- API errors with request context
- CORS blocked origins

### Incident Response

In case of security incident:
1. **Rotate JWT Secret**: Update JWT_SECRET in Railway, invalidates all existing tokens
2. **Review Logs**: Check server logs for unauthorized access
3. **Update Dependencies**: Run `npm audit fix`
4. **Notify Users**: If credentials were compromised

## Deployment Security Checklist

Before deploying to production:

- [ ] JWT_SECRET is set to a strong random value (64+ characters)
- [ ] NODE_ENV is set to 'production'
- [ ] DISABLE_SSL_VERIFY is NOT set (or set to 'false')
- [ ] Database credentials are secure
- [ ] CORS origins are restricted to your domains only
- [ ] All dependencies are up to date (`npm audit`)
- [ ] Review Railway logs for any errors on startup

## Critical Security Issues - Current Status

### Issue #1: Input Validation ✅ FIXED (2025-11-19)
- **Severity**: CRITICAL
- **Status**: RESOLVED
- **What was fixed**: All mutation endpoints now validate input before processing
- **Impact**: Prevents invalid/malicious data from being stored in database

### Issue #2: Error Handling Inconsistency ⚠️ PENDING
- **Severity**: HIGH
- **Status**: NEEDS FIX
- **Description**: Error responses across controllers are inconsistent
- **What needs fixing**:
  - Standardize all error response format to: `{ error: string, code?: string, details?: object }`
  - Implement consistent HTTP status codes
  - Avoid exposing stack traces in production
- **Files affected**: `server/controllers/*.js`
- **Estimated effort**: 2 hours

### Issue #3: File Upload Validation ✅ FIXED (2025-11-19)
- **Severity**: CRITICAL
- **Status**: RESOLVED
- **What was fixed**: Comprehensive file upload validation middleware with centralized file type management
- **Implementation details**:
  - Created `server/middleware/fileUpload.js` with `ALLOWED_FILE_TYPES` configuration
  - Implemented `createSingleFileUpload()` and `createMultipleFileUpload()` factories
  - Added MIME type and extension validation with mismatch detection
  - Implemented `verifyUploadPermission` middleware to check supplier permissions
  - Added `validateFilesPresent` middleware to ensure files are provided
  - Implemented `generateSafeFilename()` to prevent path traversal attacks
  - Integrated validation into all upload endpoints:
    - `/api/documents/upload` - Multiple documents with permission checking
    - `/api/upload-excel` - Single Excel file for bulk import
    - `/api/supplier/documents` - Supplier portal document uploads
    - `/api/quotes/:forwarder/upload` - Forwarder quote uploads
- **Impact**: All file uploads now validated for type, MIME type, size, and user permissions

### Issue #4: Supplier Portal Security ⚠️ PARTIALLY RESOLVED
- **Severity**: CRITICAL
- **Status**: PARTIAL
- **Fixed 2026-04-20**:
  - ✅ Restrict supplier to only view their own data — IDOR via `LIKE '%name%'` replaced with exact case-insensitive equality across all six supplier-portal queries
  - ✅ Admin approval required before a supplier account can sign in (`is_active=false` on registration)
  - ✅ Short-lived access tokens (15 min) + refresh tokens already in place
  - ✅ CSRF middleware in place (`server/middleware/csrf.js`)
- **Still needed**:
  - Email verification for supplier registration
  - Self-service password reset via email
  - Permanent account lockout after repeated failed logins (currently only rate-limited)
- **Files affected**: `server/routes/supplierPortal.ts`, `server/controllers/supplierController.js`
- **Estimated remaining effort**: 1–2 hours

### Issue #5: WebSocket Error Handling ⚠️ PENDING
- **Severity**: HIGH
- **Status**: NEEDS FIX
- **Description**: WebSocket error handling is incomplete
- **What needs fixing**:
  - Broadcast errors to connected clients
  - Implement reconnection logic
  - Add error logging
  - Validate incoming WebSocket messages
- **Files affected**: `server/websocket/socketManager.js`
- **Estimated effort**: 1-2 hours

### Issue #6: Rate Limiting Gaps ⚠️ PENDING
- **Severity**: HIGH
- **Status**: NEEDS FIX
- **Description**: Rate limiting not applied to all critical routes
- **What needs fixing**:
  - Add rate limiting to file upload routes
  - Add rate limiting to export/report generation routes
  - Implement per-user rate limiting (not just per-IP)
  - Monitor and log rate limit violations
- **Files affected**: `server/middleware/security.js`, `server/routes/*.js`
- **Estimated effort**: 1-2 hours

### Issue #7: Workflow State Machine ⚠️ PENDING
- **Severity**: HIGH
- **Status**: NEEDS FIX
- **Description**: Workflow state transitions not validated
- **What needs fixing**:
  - Validate state transitions (e.g., can't go from 'received' to 'in_transit')
  - Implement state machine logic
  - Prevent invalid status changes
  - Log all state transitions
- **Files affected**: `server/controllers/shipmentsController.js`
- **Estimated effort**: 2-3 hours

### Issue #8: Certificate Validation ⚠️ PENDING
- **Severity**: MEDIUM
- **Status**: NEEDS FIX
- **Description**: Certificate validation disabled in socket client
- **What needs fixing**:
  - Enable certificate validation in production
  - Only disable in development with explicit flag
- **Files affected**: `src/utils/socketClient.js`
- **Estimated effort**: 30 minutes

## Remaining Security Considerations

### Future Improvements

1. **Multi-Factor Authentication (MFA)**: Add 2FA for admin accounts
2. **Session Management**: Implement token refresh mechanism
3. **Audit Logging**: Track all data modifications with user attribution
4. **Database Row-Level Security**: Implement if needed for multi-tenancy
5. **API Versioning**: Implement to allow breaking changes
6. **Rate Limiting per User**: Currently per-IP, consider per-user limits
7. **Content Security Policy**: Fine-tune CSP directives for production
8. **Automated Dependency Updates**: Set up Dependabot or Renovate

### Known Limitations

1. **Email Import Credentials**: Email credentials are passed in request body - consider encrypting at rest
2. **File Upload Virus Scanning**: Not implemented - files are stored without scanning
3. **Password Reset**: Not implemented - users cannot self-service password reset
4. **Account Lockout**: Failed login attempts trigger rate limiting, but no permanent lockout

## Privacy & POPIA Compliance

The application operates within South Africa and must comply with the Protection of Personal Information Act (POPIA).

### Personal information handled
- **Internal users** (`users` table): username, email, full name, hashed password, login activity (IP, user-agent, timestamp).
- **Supplier contacts** (`suppliers` table): supplier company name, contact person, email, phone, address, country.
- **Supplier portal accounts** (`supplier_accounts` table): login email, hashed password, last login timestamp.
- **Shipment-attached documents** (`supplier_documents`, filesystem): PODs, invoices, compliance PDFs — may contain PII about third parties.

### POPIA controls currently in place
- Passwords hashed with bcrypt (10 rounds); no plaintext credential storage.
- Access to personal information gated by authentication and role (`requireAdmin` on supplier document reads).
- Database connections use SSL in production.
- Login activity logged for accountability; no credential values recorded.
- `.env` files excluded from version control; secrets live in Railway Variables.
- **Retention jobs** — `server/jobs/retentionScheduler.js` runs nightly at 03:00 and purges:
  - `login_activity` rows older than `LOGIN_ACTIVITY_RETENTION_DAYS` (default 365)
  - expired/revoked `refresh_tokens` older than `REFRESH_TOKEN_RETENTION_DAYS` (default 30)
  - abandoned pending registrations (is_active=false, no audit activity) older than `PENDING_REGISTRATION_TTL_DAYS` (default 90)
- **Data-subject access (POPIA §23)** — `GET /api/auth/me/data-export` returns the caller's profile, login activity, and audit entries as a JSON download.
- **Data-subject erasure (POPIA §25)** — `POST /api/auth/admin/users/:id/erase` tombstones the user row, deletes login activity + refresh tokens, and preserves the audit trail.
- **Privacy notice** — accessible at `/privacy` (linked from login page) covering what is collected, why, retention periods, sub-operators, cross-border transfer, and rights.

### POPIA controls to implement
- **Lawful purpose & minimisation**: review whether `address`, `phone`, and `country` on `suppliers` are all necessary; drop fields the workflow doesn't use.
- **Retention for shipment data**: the retention job currently covers auth-related tables; extend to archived shipments and supplier documents with a defined retention period (e.g. 5 years to match SARS customs retention).
- **Self-service correction & deletion request**: users can currently export their data, but deletion requires admin action. Add a "request deletion" button in user settings that notifies an admin.
- **Operator agreements**: formal data-processing agreements with Railway (hosting), Vercel (frontend hosting), and Sentry (error monitoring) — these are sub-operators processing Synercore's personal information.
- **Cross-border transfer**: Railway and Vercel store data in regions outside South Africa. Confirm this is permitted under POPIA §72 (adequate protection / consent) and document the basis.
- **Breach notification**: define and document an incident response process that meets POPIA §22 — notify the Information Regulator and affected data subjects "as soon as reasonably possible" after a compromise.
- **Information Officer**: register a POPIA Information Officer with the Regulator if not already done.

### Privacy best practices for developers
- Never log email addresses, full names, or passwords in application logs.
- Never paste production personal information into tickets, chats, or AI tools without a signed data-processing agreement.
- When sharing bug reports, sanitise supplier names / emails / document filenames.
- When exporting data for analysis, prefer aggregated / anonymised views.

## Security Contacts

Report security vulnerabilities to: [Add contact information]

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)

## Changelog

### 2026-04-20 — Authorization hardening, supplier-portal IDOR fix, dependency cleanup
- Registration (`/api/auth/register`) now creates inactive accounts — admin approval required before login; no tokens issued on signup (commit `c965cf8`)
- Destructive shipment routes (`DELETE /:id`, `/bulk-import`, `/bulk/archive|delete|restore`) now require `requireAdmin` (commit `c965cf8`)
- Warehouse-capacity PUT endpoints now require `authenticateToken + requireAdmin` (commit `c965cf8`)
- Supplier document GET endpoints now require `requireAdmin`, matching existing DELETE handler (commit `c965cf8`)
- Supplier-portal IDOR fixed: `LOWER(supplier) LIKE '%' || name || '%'` replaced with exact case-insensitive equality across all six queries (commit `5bb6202`)
- `/api/auth/setup` gated behind `SETUP_TOKEN` env var + `X-Setup-Token` header; returns 404 when unset (commit `f486ec0`)
- `JWT_SECRET` rotated in Railway — all outstanding tokens invalidated
- `npm audit fix` resolved 13 of 15 advisories (commit `06884e8`); remaining jspdf 3→4 and nodemailer 6→8 deferred pending regression testing
- Added Privacy & POPIA Compliance section documenting personal information handled and outstanding compliance controls

### 2025-11-19 - File Upload Validation Implementation
- **Fixed**: File uploads missing validation and permission checks (Critical Issue #3)
- Created `server/middleware/fileUpload.js` with comprehensive validation
- Implemented file type whitelist: PDF, Excel, Word, Images (10MB max per file)
- Added MIME type validation with extension mismatch detection
- Implemented permission checks via `verifyUploadPermission` middleware
- Added safe filename generation to prevent path traversal attacks
- Integrated validation into all upload endpoints:
  - `/api/documents/upload` - Multiple documents with permission checking
  - `/api/upload-excel` - Single Excel file for bulk import
  - `/api/supplier/documents` - Supplier portal uploads
  - `/api/quotes/:forwarder/upload` - Forwarder quote uploads
- Enhanced quotes.js to use centralized `ALLOWED_FILE_TYPES` configuration
- Updated supplierPortal.js to use new validation middleware
- Build tested and verified - no breaking changes
- Updated SECURITY.md with Issue #3 fix details

### 2025-11-19 - Error Handling Standardization (Critical Issue #2)
- **Fixed**: Inconsistent error responses across controllers
- Created `server/utils/errorHandler.js` with `AppError` class and utility functions
- Implemented `sendError()` with context-aware logging and production-safe messaging
- Added `asyncHandler()` wrapper for automatic error handling in async routes
- Pre-built `Errors` object with common error types (NotFound, Unauthorized, etc.)
- Updated shipmentsController.js to use new error handling utilities
- Production mode hides sensitive details, development shows full context
- Build tested and verified - no breaking changes

### 2025-11-19 - Input Validation Implementation (Critical Issue #1)
- **Fixed**: Input validation not integrated in mutation routes
- Added `validateShipmentCreate` middleware to POST/PUT shipment operations
- Added `validateSupplierCreate` and `validateSupplierUpdate` middleware to supplier operations
- All workflow action routes now validate IDs before processing
- Standardized validation error responses
- Fixed production issue by making orderRef and supplier optional in shipment validation
- Build tested and verified - no breaking changes
- Updated SECURITY.md with critical security issues tracker

### 2025-10-20 - Major Security Update
- Implemented comprehensive authentication on all protected endpoints
- Added rate limiting (API-wide and auth-specific)
- Added security headers with Helmet
- Fixed SQL injection vulnerability in dynamic ORDER BY
- Fixed SSL/TLS certificate validation
- Improved error handling (no sensitive data leakage)
- Made JWT_SECRET required environment variable
- Created input validation middleware with express-validator
- Updated environment variable documentation

---

**Last Updated**: April 20, 2026
**Review Frequency**: Quarterly or after any security incident
**Next Review**: July 20, 2026

**Progress**: 3.5 of 8 critical issues resolved
- ✅ Issue #1: Input Validation
- ✅ Issue #2: Error Handling Inconsistency
- ✅ Issue #3: File Upload Validation
- 🟡 Issue #4: Supplier Portal Security (IDOR + admin-approval resolved 2026-04-20; email verification / password reset / permanent lockout still pending)
- ⏳ Issue #5: WebSocket Error Handling
- ⏳ Issue #6: Rate Limiting Gaps
- ⏳ Issue #7: Workflow State Machine
- ⏳ Issue #8: Certificate Validation

**Deferred dependency upgrades** (need regression testing):
- `jspdf` 3 → 4 (critical — PDF generation)
- `nodemailer` 6 → 8 (moderate — transitive via `mailparser`)
