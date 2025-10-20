# Security Documentation

## Overview

This document outlines the security measures implemented in the Synercore Import Schedule application and provides guidance for maintaining security best practices.

## Recent Security Improvements (2025-10-20)

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

1. **Registration/Login**: User provides credentials
2. **Token Generation**: Server generates JWT with 7-day expiry
3. **Token Storage**: Client stores token securely
4. **API Requests**: Client includes token in Authorization header:
   ```
   Authorization: Bearer <token>
   ```
5. **Token Verification**: Server validates token on each protected request

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

## Security Contacts

Report security vulnerabilities to: [Add contact information]

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Node.js Security Checklist](https://github.com/goldbergyoni/nodebestpractices#6-security-best-practices)

## Changelog

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

**Last Updated**: October 20, 2025
**Review Frequency**: Quarterly or after any security incident
