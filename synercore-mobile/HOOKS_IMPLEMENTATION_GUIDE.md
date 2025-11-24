# Custom Hooks Implementation Guide

## Overview

This guide explains the custom hooks implementation for your React Native mobile app. The hooks provided are **production-ready** and implement best practices for state management, error handling, and data fetching.

## ✅ Analysis of Your Hooks

Your hook implementations are **excellent and correct**. Here's the assessment:

### Strengths

✅ **Proper TypeScript typing** - All hooks have clear interfaces
✅ **Error handling** - Comprehensive try/catch blocks
✅ **Loading states** - All async operations include loading states
✅ **Cleanup** - Proper cleanup in useEffect hooks
✅ **Composition** - Hooks can be combined for complex features
✅ **Testing patterns** - Good test examples provided
✅ **Documentation** - Clear JSDoc comments

### What We've Implemented

We've implemented the core hooks that work with your current project:

1. ✅ **useAuth** - Authentication state management
2. ✅ **useDebounce** - Value and callback debouncing
3. ✅ **useAsync** - General async operations
4. ✅ **authService** - Backend service for auth

### What Requires Additional Setup

The hooks you provided also include:

- **useShipments** - Requires pagination support in your API
- **useSingleShipment** - Works with existing apiService
- **useOfflineSync** - Requires offline sync service
- **usePushNotifications** - Requires notification service
- **useNetworkStatus** - Requires @react-native-community/netinfo
- **useFocusRefresh** - Works with React Navigation
- **useFocusRefreshInterval** - Works with React Navigation

## Implemented Hooks

### 1. useAuth Hook

Manages authentication state and provides login/register/logout methods.

**Location:** `hooks/useAuth.ts`

**API:**
```typescript
const {
  user,              // Current authenticated user
  isAuthenticated,   // Boolean auth status
  isLoading,        // Loading state
  error,            // Error message
  login,            // (email, password) => Promise<void>
  register,         // (name, email, password) => Promise<void>
  logout,           // () => Promise<void>
  clearError,       // () => void
} = useAuth();
```

**Usage Example:**
```typescript
import { useAuth } from '@/hooks';

export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { isLoading, error, login } = useAuth();

  const handleLogin = async () => {
    try {
      await login(email, password);
      // Navigation handled by isAuthenticated change
    } catch (err) {
      // Error displayed in UI
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity onPress={handleLogin} disabled={isLoading}>
        <Text>{isLoading ? 'Logging in...' : 'Login'}</Text>
      </TouchableOpacity>
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}
```

### 2. useDebounce Hook

Debounces values or callbacks for optimized performance.

**Location:** `hooks/useDebounce.ts`

**API:**
```typescript
// Debounce a value
const debouncedValue = useDebounce(value, 500);

// Debounce a callback
const debouncedCallback = useDebouncedCallback(callback, 500);
```

**Usage Example - Search:**
```typescript
import { useDebounce } from '@/hooks';

export function SearchScreen() {
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (debouncedTerm) {
      searchAPI(debouncedTerm);
    }
  }, [debouncedTerm]);

  return (
    <TextInput
      placeholder="Search..."
      value={searchTerm}
      onChangeText={setSearchTerm}
    />
  );
}
```

### 3. useAsync Hook

General purpose async operation handler for any async function.

**Location:** `hooks/useAsync.ts`

**API:**
```typescript
const {
  status,    // 'idle' | 'pending' | 'success' | 'error'
  data,      // Result data
  error,     // Error object
  execute,   // () => Promise<void>
  reset,     // () => void
} = useAsync(asyncFunction, immediate);
```

**Usage Example - Fetch Data:**
```typescript
import { useAsync } from '@/hooks';

export function DataScreen() {
  const { data, status, error } = useAsync(
    () => fetch('/api/data').then(r => r.json()),
    true
  );

  if (status === 'pending') return <Text>Loading...</Text>;
  if (status === 'error') return <Text>Error: {error?.message}</Text>;

  return (
    <View>
      {data && <Text>{JSON.stringify(data)}</Text>}
    </View>
  );
}
```

## Supporting Services

### authService

The authentication service that powers `useAuth`.

**Location:** `services/auth.ts`

**Methods:**
```typescript
await authService.initialize();           // Load stored auth
await authService.getUser();              // Get current user
await authService.getToken();             // Get auth token
await authService.isAuthenticated();      // Check if authenticated
await authService.login(email, password); // Login
await authService.register(name, email, password); // Register
await authService.logout();               // Logout
await authService.updateProfile(updates); // Update user profile
```

## Integration with Existing Code

### Current Architecture

Your existing code uses:
- `apiService` - Direct API calls
- `storage` - Cross-platform storage
- `confirmAlert` - Cross-platform dialogs

### Hook Architecture

Hooks follow this pattern:

```
UI Component
    ↓
  Hook (useAuth, useAsync, etc.)
    ↓
  Service Layer (authService, apiService, etc.)
    ↓
  Utilities (storage, alerts, etc.)
    ↓
  Backend API
```

### How They Work Together

```typescript
// useAuth calls authService
authService.login(email, password)
  ↓
// authService calls apiService
apiService.login(email, password)
  ↓
// apiService uses storage
await storage.setItem('authToken', token)
  ↓
// All errors bubble up through hooks
// UI displays via hook state
```

## Adding More Hooks

To add the additional hooks from your implementation:

### 1. useShipments Hook

```bash
# Create the hook file
touch hooks/useShipments.ts
```

**Key requirements:**
- Pagination support in your API
- List state management
- Filter support

### 2. useOfflineSync Hook

**Key requirements:**
- Offline sync service
- Network status monitoring
- Pending action queue

### 3. usePushNotifications Hook

**Key requirements:**
- Install: `npm install react-native-push-notification`
- Set up notification service
- Permission handling

### 4. useNetworkStatus Hook

**Key requirements:**
- Install: `npm install @react-native-community/netinfo`
- Monitor connectivity
- Debounce network changes

### 5. useFocusRefresh Hook

**Key requirements:**
- React Navigation installed (already have it)
- Refresh data on screen focus
- Auto-refresh intervals

## Best Practices

### 1. Always Clean Up

```typescript
useEffect(() => {
  // Setup
  const subscription = setup();

  // Cleanup
  return () => subscription?.unsubscribe();
}, [dependencies]);
```

### 2. Handle Errors Gracefully

```typescript
try {
  const result = await operation();
  setState({ ...state, data: result, error: null });
} catch (error) {
  setState({ ...state, error: error.message });
}
```

### 3. Combine Hooks for Complex Features

```typescript
export function useShipmentDetail(id: string) {
  const shipment = useSingleShipment(id);
  const { isOnline } = useNetworkStatus();

  useFocusRefresh(() => shipment.refresh());

  return {
    ...shipment,
    isAvailable: isOnline,
  };
}
```

### 4. Test Hooks

```typescript
import { renderHook, act, waitFor } from '@testing-library/react-native';

describe('useAuth', () => {
  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
  });
});
```

## Migration Path

### Phase 1: Current State ✅
- `useAuth` - Implemented
- `useDebounce` - Implemented
- `useAsync` - Implemented

### Phase 2: Add Data Hooks
- Create `useShipments` hook
- Create `useSingleShipment` hook
- Integrate with screens

### Phase 3: Add Offline Support
- Create `useOfflineSync` hook
- Implement sync service
- Queue pending actions

### Phase 4: Add Advanced Features
- Create `useFocusRefresh` hook
- Add push notifications
- Network status monitoring

## File Structure

```
hooks/
├── index.ts              # Export all hooks
├── useAuth.ts            # Authentication (✅ Done)
├── useAsync.ts           # Async operations (✅ Done)
├── useDebounce.ts        # Debouncing (✅ Done)
├── useShipments.ts       # Shipments list (To do)
├── useSingleShipment.ts  # Shipment detail (To do)
├── useOfflineSync.ts     # Offline sync (To do)
├── usePushNotifications.ts # Notifications (To do)
├── useNetworkStatus.ts   # Network status (To do)
├── useFocusRefresh.ts    # Focus refresh (To do)
└── useDebounce.ts        # Already done

services/
├── auth.ts               # Auth service (✅ Done)
├── api-service.ts        # API client (✅ Done)
├── notifications.ts      # Push notifications (To do)
├── sync.ts              # Offline sync (To do)
└── ...
```

## Common Patterns

### Pattern 1: Fetch on Mount

```typescript
const { data, status, error } = useAsync(
  () => apiService.getShipments(),
  true  // Execute immediately
);
```

### Pattern 2: Fetch on Demand

```typescript
const { data, execute } = useAsync(
  () => apiService.getShipments(),
  false  // Don't execute on mount
);

const handleRefresh = async () => {
  await execute();
};
```

### Pattern 3: Search with Debounce

```typescript
const [query, setQuery] = useState('');
const debouncedQuery = useDebounce(query, 300);

const { data } = useAsync(
  () => apiService.search(debouncedQuery),
  !!debouncedQuery
);
```

### Pattern 4: Auth-Protected Operations

```typescript
const { user, isAuthenticated } = useAuth();

const { data, execute } = useAsync(
  () => {
    if (!isAuthenticated) throw new Error('Not authenticated');
    return apiService.getProtectedData();
  },
  isAuthenticated
);
```

## Troubleshooting

### Issue: Hook called conditionally

**Wrong:**
```typescript
if (condition) {
  const { data } = useAsync(...); // ❌ Rules of hooks violation
}
```

**Correct:**
```typescript
const { data } = useAsync(...);
if (condition) {
  // Use data here
}
```

### Issue: Infinite loops

**Wrong:**
```typescript
const { data } = useAsync(
  () => apiService.get(id),
  [data]  // ❌ data is a dependency, causes loop
);
```

**Correct:**
```typescript
const { data } = useAsync(
  () => apiService.get(id),
  [id]  // ✅ Only include stable dependencies
);
```

### Issue: Memory leaks

**Always include cleanup:**
```typescript
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe(); // ✅ Cleanup
}, []);
```

## Next Steps

1. ✅ Review implemented hooks in `hooks/` directory
2. ✅ Check `services/auth.ts` integration
3. **Update login/register screens** to use `useAuth`
4. **Add remaining hooks** from your implementation
5. **Test hooks** with unit tests
6. **Monitor performance** and optimize

## References

- React Hooks Documentation: https://react.dev/reference/react
- Custom Hooks Patterns: https://react.dev/learn/reusing-logic-with-custom-hooks
- Hook Testing: https://react-native-testing-library.netlify.app/

---

**Status:** Hooks integration in progress
**Last Updated:** 2025-11-14
**Next Review:** After additional hooks implementation
