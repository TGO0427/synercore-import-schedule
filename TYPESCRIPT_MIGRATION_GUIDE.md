# TypeScript Migration Guide

Complete guide for the ongoing TypeScript migration of the Synercore Import Schedule application.

## Overview

This document outlines the TypeScript migration strategy and progress. The migration is being done incrementally to minimize disruption and allow for gradual adoption.

**Status**: In Progress (Phase 1: Infrastructure & Utilities Complete)

## Phases

### Phase 1: Infrastructure & Utilities ✅ COMPLETE

**Files Migrated:**
- `server/types/index.ts` - Central type definitions
- `server/utils/AppError.ts` - Custom error class
- `server/utils/logger.ts` - Logging utilities
- `server/utils/envValidator.ts` - Environment validation
- `server/middleware/errorHandler.ts` - Error handling middleware
- `server/middleware/requestId.ts` - Request ID tracking

**Configuration Added:**
- `tsconfig.json` - Main TypeScript configuration with strict mode enabled
- `tsconfig.test.json` - Test-specific configuration

### Phase 2: Database & Models (IN PROGRESS)

**To Migrate:**
- `server/db/connection.ts` - Database connection pool
- `server/db/*.ts` - Migration scripts
- Database query builders and helpers
- Model/schema definitions

**Benefits:**
- Type-safe database queries
- Compile-time error detection for queries
- Better IDE autocomplete for column names

### Phase 3: Route Handlers (PENDING)

**To Migrate:**
- `server/routes/*.ts` - All route handler files
- Request/response validation with types
- Controller logic

**Files:**
- routes/shipments.ts
- routes/suppliers.ts
- routes/quotes.ts
- routes/auth.ts
- routes/reports.ts
- routes/notifications.ts
- routes/warehouseCapacity.ts
- routes/emailImport.ts
- routes/admin.ts
- routes/schedulerAdmin.ts
- routes/supplierPortal.ts

### Phase 4: Stores & Client (PENDING)

**To Migrate:**
- `src/stores/*.ts` - Zustand stores
- Zustand store types and actions

**Benefits:**
- Type-safe store actions
- Automatic state type inference
- Better developer experience

### Phase 5: Testing (PENDING)

**To Update:**
- Convert test files to TypeScript if beneficial
- Update test configuration
- Create test type utilities

## TypeScript Configuration

### Key Compiler Options

**Strict Type Checking:**
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "strictFunctionTypes": true,
  "strictBindCallApply": true,
  "strictPropertyInitialization": true,
  "noImplicitThis": true,
  "alwaysStrict": true
}
```

**Code Quality:**
```json
{
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

**Path Aliases:**
```json
{
  "paths": {
    "@/*": ["server/*"],
    "@config/*": ["server/config/*"],
    "@middleware/*": ["server/middleware/*"],
    "@routes/*": ["server/routes/*"],
    "@utils/*": ["server/utils/*"],
    "@db/*": ["server/db/*"],
    "@types/*": ["server/types/*"],
    "@websocket/*": ["server/websocket/*"],
    "@jobs/*": ["server/jobs/*"]
  }
}
```

## Central Type System

All shared types are defined in `server/types/index.ts`:

### Data Models
- `User` - User database model
- `Supplier` - Supplier model
- `Shipment` - Shipment with 14 status values
- `Quote` - Supplier quote
- `WarehouseCapacity` - Warehouse storage
- `Notification` - User notification
- `RefreshToken` - Token model

### API Types
- `JwtPayload` - JWT token content
- `AuthTokens` - Access/refresh token pair
- `AuthenticatedRequest` - Extended Express Request
- `ErrorResponse` - Standard error format
- `ApiResponse<T>` - Standard API response
- `PaginatedResponse<T>` - Paginated results
- `ValidationErrorDetails` - Validation error

### Enums & Unions
- `UserRole` - 'user' | 'admin' | 'supplier'
- `ShipmentStatus` - 14 status values
- `NotificationType` - 'info' | 'warning' | 'error' | 'success'
- `NotificationStatus` - 'unread' | 'read'

### Configuration Types
- `EmailConfig` - Email settings
- `SchedulerConfig` - Job scheduler config
- `ReportFilters` - Report filter options
- `SupplierMetrics` - Supplier performance data

## Migration Patterns

### 1. Migrating a Utility Function

**Before (JavaScript):**
```javascript
// server/utils/helper.js
export function formatDate(date) {
  return new Date(date).toISOString();
}
```

**After (TypeScript):**
```typescript
// server/utils/helper.ts
export function formatDate(date: string | Date): string {
  return new Date(date).toISOString();
}
```

### 2. Migrating a Middleware

**Before (JavaScript):**
```javascript
export const myMiddleware = (req, res, next) => {
  req.customData = 'value';
  next();
};
```

**After (TypeScript):**
```typescript
import { Request, Response, NextFunction } from 'express';

export const myMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  req.customData = 'value';
  next();
};
```

### 3. Migrating a Route Handler

**Before (JavaScript):**
```javascript
router.get('/:id', async (req, res, next) => {
  try {
    const result = await getShipment(req.params.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

**After (TypeScript):**
```typescript
import { asyncHandler } from '../middleware/errorHandler.js';
import type { Request, Response } from 'express';

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await getShipment(req.params.id);
  res.json(result);
}));
```

### 4. Using Shared Types

```typescript
import type { Shipment, User, ShipmentStatus } from '../types/index.js';

async function updateShipment(
  id: string,
  status: ShipmentStatus,
  notes?: string
): Promise<Shipment> {
  // Type-safe implementation
}
```

## Type Utilities

### Generic Handlers

```typescript
// Response wrapper
export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return { data, message };
}

// Error handling
export function handleError(error: unknown): AppError {
  // Type guard and conversion
}
```

### Request Extensions

```typescript
// Extend Express Request with custom properties
declare global {
  namespace Express {
    interface Request {
      id?: string;
      user?: JwtPayload;
    }
  }
}
```

## Build & Testing

### TypeScript Compilation

```bash
# Check for TypeScript errors
npx tsc --noEmit

# Compile TypeScript
npx tsc

# Watch mode (development)
npx tsc --watch
```

### Running Tests

```bash
# Tests still use JavaScript Jest configuration
npm run test:server

# Type check tests
npx tsc --noEmit --project tsconfig.test.json
```

## Best Practices

### 1. Strict Null Checks

Always handle optional types:

```typescript
// ❌ Avoid
const name = user.profile.name;

// ✅ Good
const name = user?.profile?.name ?? 'Unknown';
```

### 2. Avoid `any`

Always specify types explicitly:

```typescript
// ❌ Avoid
export function process(data: any): any {
  return data;
}

// ✅ Good
export function process(data: Shipment): ShipmentStatus {
  return data.latestStatus;
}
```

### 3. Use Type Guards

```typescript
// Type guard function
function isShipment(obj: unknown): obj is Shipment {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'latestStatus' in obj
  );
}

// Usage
if (isShipment(data)) {
  // TypeScript narrows type to Shipment
  console.log(data.latestStatus);
}
```

### 4. Import Types Separately

Always use `import type` for type-only imports:

```typescript
// ✅ Good - type-only import
import type { Shipment, ShipmentStatus } from '../types/index.js';

// ✅ Good - value import
import { AppError } from '../utils/AppError.js';

// ⚠️  Avoid mixing in single import
import { AppError, type ErrorResponse } from '../utils/AppError.js';
```

## Troubleshooting

### Issue: Circular Dependencies

**Problem:** TypeScript compilation fails due to circular imports.

**Solution:** Use type-only imports:
```typescript
// Instead of importing the full module
import type { User } from './types.js';
```

### Issue: Module Resolution

**Problem:** Can't find module despite correct path.

**Solution:** Check:
1. `tsconfig.json` paths configuration
2. Import extensions (`.js` required in ESM)
3. `"moduleResolution": "node"` is set

### Issue: `express.Request` Property Not Found

**Problem:** Custom properties on Request are not recognized.

**Solution:** Extend Request in a `.d.ts` file:

```typescript
// server/types/express.d.ts
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      id?: string;
    }
  }
}
```

## Migration Checklist

### Setup ✅
- [x] Install TypeScript and type definitions
- [x] Create tsconfig.json with strict mode
- [x] Create central types/index.ts
- [x] Set up path aliases

### Phase 1: Utilities ✅
- [x] Migrate AppError.ts
- [x] Migrate logger.ts
- [x] Migrate envValidator.ts
- [x] Migrate errorHandler.ts
- [x] Migrate requestId.ts

### Phase 2: Database (IN PROGRESS)
- [ ] Migrate connection.ts
- [ ] Migrate migration scripts
- [ ] Migrate database helpers
- [ ] Add query type safety

### Phase 3: Routes
- [ ] Migrate auth routes
- [ ] Migrate shipment routes
- [ ] Migrate supplier routes
- [ ] Migrate quote routes
- [ ] Migrate other routes

### Phase 4: Client & Stores
- [ ] Migrate Zustand stores
- [ ] Add store type definitions
- [ ] Ensure type safety in components

### Phase 5: Testing
- [ ] Update test configuration
- [ ] Ensure all tests pass with TypeScript
- [ ] Add test type utilities

### Phase 6: Cleanup
- [ ] Remove old .js files after migration
- [ ] Update all import statements
- [ ] Verify no regressions
- [ ] Update documentation

## Performance Considerations

**Build Time:**
- TypeScript compilation adds ~3-5 seconds to build time
- Use incremental compilation with `--incremental` flag
- Consider using `tsc-skip-lib-check` for faster builds

**Runtime Performance:**
- TypeScript compiles to JavaScript, no runtime overhead
- Strict type checking prevents bugs at compile time
- Better tree-shaking opportunities with TypeScript

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express TypeScript Guide](https://expressjs.com/en/resources/middleware/cors.html)
- [Node.js TypeScript Support](https://nodejs.org/en/docs/guides/nodejs-typesscript/)
- [Type-only imports](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-8.html#type-only-imports-and-export)

## Next Steps

1. **Database Migration**: Start migrating connection and query helpers
2. **Route Types**: Define clear request/response types for each endpoint
3. **Gradual Adoption**: Keep .js files during migration for compatibility
4. **Testing**: Ensure all tests pass with TypeScript
5. **Documentation**: Update API docs with type information

---

Last Updated: 2024-11-20
