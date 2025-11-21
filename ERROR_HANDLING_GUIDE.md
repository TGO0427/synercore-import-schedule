# Standardized Error Handling Guide

## Overview

This guide explains the standardized error handling system implemented across all Synercore backend services. The system provides consistent error classification, logging, user-friendly messaging, and recovery recommendations.

## Error Handling Architecture

### Error Types

The system classifies errors into 10 standardized types:

| Error Type | HTTP Status | Cause | Example |
|------------|-------------|-------|---------|
| `NETWORK` | 503 | Network connectivity issues | Connection refused, DNS resolution failed |
| `VALIDATION` | 400 | Invalid input data | Missing required fields, wrong data type |
| `AUTHENTICATION` | 401 | Authentication failures | Invalid token, expired session |
| `AUTHORIZATION` | 403 | Permission denied | User lacks required role |
| `NOT_FOUND` | 404 | Resource doesn't exist | Shipment ID doesn't exist |
| `CONFLICT` | 409 | Resource conflict | Duplicate email address |
| `DATABASE` | 500 | Database operation failed | Query error, connection lost |
| `SERVER` | 500 | Internal server error | Unexpected condition |
| `EXTERNAL_API` | 502/503 | External service error | Third-party API timeout |
| `UNKNOWN` | 500 | Unclassified error | Generic fallback |

### Error Response Format

All errors follow a standardized response format:

```json
{
  "success": false,
  "error": {
    "type": "VALIDATION",
    "message": "Invalid input. Please check your data and try again.",
    "code": "MISSING_REQUIRED_FIELD",
    "statusCode": 400,
    "timestamp": "2025-11-21T14:30:00.000Z",
    "requestId": "req-abc123",
    "details": {
      "fieldName": "email"
    }
  }
}
```

## Usage Examples

### Basic Error Handling

```typescript
import { handleError, ServiceError, ErrorType } from '../utils/errorHandler';

// In a service function
async function processShipment(shipmentId: string) {
  try {
    // ... your operation ...
  } catch (error) {
    const response = handleError(error, {
      service: 'ShipmentService',
      operation: 'processShipment',
      userId: req.user.id,
      requestId: req.id,
      details: { shipmentId },
    });
    res.status(response.error.statusCode).json(response);
  }
}
```

### Throwing Errors with Context

```typescript
import { ServiceError, ErrorType } from '../utils/errorHandler';

if (!shipment) {
  throw new ServiceError(
    ErrorType.NOT_FOUND,
    404,
    'Shipment not found',
    { shipmentId },
    'SHIPMENT_NOT_FOUND'
  );
}

if (user.role !== 'admin') {
  throw new ServiceError(
    ErrorType.AUTHORIZATION,
    403,
    'Only administrators can perform this action',
    { userRole: user.role },
    'INSUFFICIENT_PERMISSIONS'
  );
}
```

### Validation with Error Handling

```typescript
import { validateRequired, validateEmail, validateType } from '../utils/errorHandler';

// Validate required fields
validateRequired(email, 'email', {
  service: 'UserService',
  operation: 'createUser',
});

// Validate email format
validateEmail(email, {
  service: 'UserService',
  operation: 'createUser',
});

// Validate field type
validateType(age, 'number', 'age', {
  service: 'UserService',
  operation: 'createUser',
});
```

### Wrapping Async Operations

```typescript
import { withErrorHandling } from '../utils/errorHandler';

const result = await withErrorHandling(
  async () => {
    return await emailService.sendEmail(email, subject, body);
  },
  {
    service: 'EmailService',
    operation: 'sendEmail',
    userId: req.user.id,
    requestId: req.id,
  }
);
```

### Wrapping Sync Operations

```typescript
import { withErrorHandlingSync } from '../utils/errorHandler';

const parsed = withErrorHandlingSync(
  () => {
    return JSON.parse(jsonString);
  },
  {
    service: 'ParsingService',
    operation: 'parseJSON',
    requestId: req.id,
  }
);
```

## Migration Guide

### Before (Inconsistent Error Handling)

```typescript
// ❌ Bad: Inconsistent error handling
try {
  const user = await db.getUser(id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' }); // Inconsistent format
  }
} catch (error) {
  console.error('Error:', error); // No context, no user-friendly message
  res.status(500).json({ error: 'Server error' }); // Generic message
}
```

### After (Standardized Error Handling)

```typescript
// ✅ Good: Standardized error handling
try {
  const user = await db.getUser(id);
  if (!user) {
    throw new ServiceError(
      ErrorType.NOT_FOUND,
      404,
      'User not found',
      { userId: id },
      'USER_NOT_FOUND'
    );
  }
  return res.json({ success: true, data: user });
} catch (error) {
  const response = handleError(error, {
    service: 'UserController',
    operation: 'getUser',
    userId: req.user?.id,
    requestId: req.id,
    details: { userId: id },
  });
  res.status(response.error.statusCode).json(response);
}
```

## User-Facing Messages

The error handler automatically provides appropriate user-facing messages for each error type. These messages are safe for production and don't expose internal details.

```typescript
ErrorType.NETWORK → "Network connection error. Please check your internet connection."
ErrorType.VALIDATION → "Invalid input. Please check your data and try again."
ErrorType.AUTHENTICATION → "Authentication failed. Please login again."
ErrorType.AUTHORIZATION → "You do not have permission to perform this action."
ErrorType.NOT_FOUND → "The requested resource was not found."
ErrorType.CONFLICT → "This resource already exists."
ErrorType.SERVER → "An internal server error occurred. Please try again later."
ErrorType.EXTERNAL_API → "External service error. Please try again later."
ErrorType.DATABASE → "Database error. Please try again later."
```

## Recovery Recommendations

The system provides automatically-generated recovery recommendations for each error type:

```typescript
// NETWORK errors suggest:
// - Check your internet connection
// - Verify the server is reachable
// - Try again in a few moments

// VALIDATION errors suggest:
// - Review the validation rules
// - Check input data format
// - Ensure all required fields are present

// AUTHENTICATION errors suggest:
// - Clear your browser cache and cookies
// - Login again with correct credentials
// - Check if your account is active
```

## Error Context

All errors should include context information:

```typescript
{
  service: 'ServiceName',        // Which service failed
  operation: 'operationName',    // Which operation failed
  userId: 'user-123',            // Which user (if applicable)
  requestId: 'req-xyz',          // Request tracking ID
  details: {                      // Additional context
    shipmentId: 'ship-456',
    attemptCount: 3,
    // ... any relevant data
  }
}
```

## Logging Integration

Errors are automatically logged with full context using the standard logger:

```typescript
// Full error details logged (for debugging):
// [ServiceName] Operation failed
// Error Type: VALIDATION
// Message: Invalid email format
// Stack: ...
// Context: { shipmentId: '123', userId: '456' }
// Recommendations: [Array of recovery steps]

// Returned to user (safe for production):
// Invalid input. Please check your data and try again.
```

## Development vs Production

In development mode, errors include full details:

```json
{
  "error": {
    "type": "VALIDATION",
    "message": "Invalid input. Please check your data and try again.",
    "details": {
      "originalMessage": "Email validation failed",
      "email": "invalid-email"
    }
  }
}
```

In production mode, sensitive details are hidden:

```json
{
  "error": {
    "type": "VALIDATION",
    "message": "Invalid input. Please check your data and try again."
  }
}
```

## Error Codes

Standard error codes for common scenarios:

| Error Code | Meaning |
|-----------|---------|
| `MISSING_REQUIRED_FIELD` | Required parameter is missing |
| `INVALID_TYPE` | Parameter type mismatch |
| `INVALID_EMAIL` | Email format is invalid |
| `NOT_FOUND` | Resource doesn't exist |
| `ALREADY_EXISTS` | Resource already exists |
| `INSUFFICIENT_PERMISSIONS` | User lacks required role |
| `EXPIRED_TOKEN` | Auth token has expired |
| `INVALID_CREDENTIALS` | Wrong email/password |
| `DATABASE_ERROR` | Database operation failed |
| `EXTERNAL_API_ERROR` | External service failed |

## Best Practices

### ✅ DO

1. **Always provide context** - Include service, operation, and relevant details
2. **Use specific error types** - Choose the most appropriate ErrorType
3. **Throw early, handle late** - Validate and throw at point of error
4. **Log full details** - System logs include stack traces and context
5. **Return safe messages** - User only sees appropriate, non-technical messages
6. **Include error codes** - Use standard codes for programmatic handling
7. **Track request IDs** - Enable error correlation and debugging

### ❌ DON'T

1. **Don't expose internal details** - Technical errors should not reach users
2. **Don't use generic messages** - "Error occurred" is not helpful
3. **Don't ignore errors** - Always handle or propagate
4. **Don't mix error formats** - Use ServiceError consistently
5. **Don't log passwords/tokens** - Sanitize sensitive data
6. **Don't swallow stack traces** - Always preserve stack for debugging
7. **Don't create new error types** - Use the 10 standardized types

## Testing

When testing error handling:

```typescript
it('should throw VALIDATION error for missing email', () => {
  expect(() => {
    validateRequired(null, 'email', { service: 'Test' });
  }).toThrow(expect.objectContaining({
    type: ErrorType.VALIDATION,
    statusCode: 400,
  }));
});

it('should return appropriate error response', async () => {
  const response = handleError(
    new Error('Test error'),
    {
      service: 'TestService',
      operation: 'testOp',
    }
  );

  expect(response.success).toBe(false);
  expect(response.error.statusCode).toBe(500);
  expect(response.error.message).toBeDefined();
});
```

## Migration Checklist

When migrating a service to use standardized error handling:

- [ ] Import errorHandler utilities
- [ ] Replace generic try-catch with error context
- [ ] Replace `console.error()` with `handleError()`
- [ ] Add appropriate ServiceError throws
- [ ] Add input validation
- [ ] Update error responses to use standard format
- [ ] Test error paths
- [ ] Verify user-facing messages
- [ ] Check development vs production error details
- [ ] Verify request tracking

## Summary

The standardized error handling system provides:

✅ **Consistency** - Same error format everywhere
✅ **User Experience** - Helpful, non-technical messages
✅ **Debuggability** - Full context and stack traces
✅ **Security** - No information leakage
✅ **Maintainability** - Centralized error logic
✅ **Monitoring** - Structured logging for alerting
✅ **Recovery** - Automatic recovery suggestions

For questions or additions, see `server/utils/errorHandler.ts` for the full implementation.
