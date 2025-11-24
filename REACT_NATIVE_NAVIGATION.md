# React Native Navigation Structure

Complete implementation of the Synercore React Native app navigation using Expo Router.

## File-Based Routing Structure

Expo Router uses file-based routing (similar to Next.js). Create these files in the `app/` directory:

```
app/
├── _layout.tsx                  # Root layout
├── index.tsx                    # Root redirect
├── (auth)/
│   ├── _layout.tsx             # Auth layout (stack)
│   ├── index.tsx               # Login screen
│   ├── register.tsx            # Register screen
│   ├── forgot-password.tsx      # Forgot password screen
│   └── reset-password.tsx       # Reset password screen
├── (app)/
│   ├── _layout.tsx             # Main app layout (bottom tabs)
│   ├── shipments/
│   │   ├── index.tsx           # Shipments list
│   │   ├── _layout.tsx         # Shipments stack
│   │   ├── [id].tsx            # Shipment detail
│   │   ├── [id]/update.tsx      # Update status modal
│   │   └── filter.tsx          # Filter modal
│   ├── products/
│   │   ├── _layout.tsx
│   │   └── index.tsx           # Products list
│   ├── warehouse/
│   │   ├── _layout.tsx
│   │   └── index.tsx           # Warehouse status
│   ├── reports/
│   │   ├── _layout.tsx
│   │   └── index.tsx           # Reports/analytics
│   ├── admin/
│   │   ├── _layout.tsx
│   │   └── index.tsx           # Admin dashboard
│   └── profile/
│       ├── _layout.tsx
│       └── index.tsx           # User profile
└── (modals)/
    ├── status-update.tsx       # Status update modal
    └── quick-action.tsx        # Quick action modal
```

## 1. Root Layout (app/_layout.tsx)

```typescript
// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { useAuthStore } from '../stores/auth';
import { useAuth } from '../hooks/useAuth';

export default function RootLayout() {
  const { user, isAuthenticated, loading } = useAuth();
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    if (user) {
      setUser(user);
    }
  }, [user]);

  if (loading) {
    return null; // Splash screen handled by app initialization
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: true,
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      )}
    </Stack>
  );
}
```

## 2. Auth Layout (app/(auth)/_layout.tsx)

```typescript
// app/(auth)/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Login' }} />
      <Stack.Screen name="register" options={{ title: 'Register' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password' }} />
      <Stack.Screen name="reset-password" options={{ title: 'Reset Password' }} />
    </Stack>
  );
}
```

## 3. Login Screen (app/(auth)/index.tsx)

```typescript
// app/(auth)/index.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { colors, spacing, typography } from '../../theme';
import { isValidEmail } from '../../utils/validators';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');

    // Validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      router.replace('/(app)/shipments');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.appName}>Synercore</Text>
          <Text style={styles.tagline}>Supply Chain Management</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.gray[400]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              placeholderTextColor={colors.gray[400]}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
            <Text style={styles.forgotPassword}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between',
  },
  headerSection: {
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },
  appName: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
  },
  formSection: {
    paddingVertical: spacing.xl,
  },
  errorText: {
    backgroundColor: colors.danger + '20',
    color: colors.danger,
    padding: spacing.md,
    borderRadius: 4,
    marginBottom: spacing.md,
    fontSize: typography.sizes.sm,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.gray[900],
    minHeight: 48,
  },
  loginBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: spacing.lg,
    minHeight: 48,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.md,
  },
  forgotPassword: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: typography.weights.medium,
    fontSize: typography.sizes.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: spacing.xl,
  },
  footerText: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
  },
  registerLink: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm,
  },
});
```

## 4. App Layout (app/(app)/_layout.tsx)

```typescript
// app/(app)/_layout.tsx
import React from 'react';
import { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { colors, typography } from '../../theme';

interface TabScreenOptions extends BottomTabNavigationOptions {
  headerShown?: boolean;
  title?: string;
  tabBarLabel?: string;
  tabBarIcon?: ({ color }: { color: string }) => React.ReactNode;
}

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray[500],
        tabBarLabelStyle: {
          fontSize: typography.sizes.xs,
          fontWeight: typography.weights.semibold,
        },
        tabBarStyle: {
          borderTopColor: colors.gray[200],
        },
      }}
    >
      <Tabs.Screen
        name="shipments"
        options={{
          title: 'Shipments',
          tabBarLabel: 'Shipments',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📦</Text>,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarLabel: 'Products',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📊</Text>,
        }}
      />
      <Tabs.Screen
        name="warehouse"
        options={{
          title: 'Warehouse',
          tabBarLabel: 'Warehouse',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🏪</Text>,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📈</Text>,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarLabel: 'Admin',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}

function Text({ style, children }: any) {
  return <span style={style}>{children}</span>;
}
```

## 5. Shipments Stack (app/(app)/shipments/_layout.tsx)

```typescript
// app/(app)/shipments/_layout.tsx
import React from 'react';
import { Stack } from 'expo-router';

export default function ShipmentsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Shipments' }} />
      <Stack.Screen name="[id]" options={{ title: 'Shipment Details' }} />
      <Stack.Screen
        name="[id]/update"
        options={{
          title: 'Update Status',
          presentation: 'modal',
        }}
      />
      <Stack.Screen name="filter" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

## 6. Shipments List (app/(app)/shipments/index.tsx)

```typescript
// app/(app)/shipments/index.tsx
import React, { useEffect } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ShipmentCard } from '../../../components/ShipmentCard';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { useShipments } from '../../../hooks/useShipments';
import { colors, spacing } from '../../../theme';

export default function ShipmentsScreen() {
  const router = useRouter();
  const { shipments, loading, error, refetch } = useShipments();

  useEffect(() => {
    refetch();
  }, []);

  const handleViewDetails = (shipmentId: string) => {
    router.push(`/(app)/shipments/${shipmentId}`);
  };

  const handleUpdateStatus = (shipmentId: string) => {
    router.push(`/(app)/shipments/${shipmentId}/update`);
  };

  const handleFilter = () => {
    router.push('/(app)/shipments/filter');
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load shipments</Text>
          <Text style={styles.errorMessage}>{error.message}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={refetch}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Shipments</Text>
        <TouchableOpacity onPress={handleFilter}>
          <Text style={styles.filterBtn}>🔍</Text>
        </TouchableOpacity>
      </View>

      {shipments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyText}>No shipments found</Text>
        </View>
      ) : (
        <FlatList
          data={shipments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ShipmentCard
              shipment={item}
              onPress={() => handleViewDetails(item.id)}
              onStatusPress={() => handleUpdateStatus(item.id)}
            />
          )}
          onRefresh={refetch}
          refreshing={loading}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.gray[900],
  },
  filterBtn: {
    fontSize: 20,
  },
  listContent: {
    padding: spacing.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.danger,
    marginBottom: spacing.md,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.gray[600],
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 4,
  },
  retryBtnText: {
    color: colors.white,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 16,
    color: colors.gray[600],
  },
});
```

## 7. Shipment Detail (app/(app)/shipments/[id].tsx)

```typescript
// app/(app)/shipments/[id].tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { shipmentService } from '../../../services/shipment';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { colors, spacing, typography } from '../../../theme';
import { Shipment } from '../../../types/shipment';

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadShipment();
  }, [id]);

  const loadShipment = async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const data = await shipmentService.getShipment(id as string);
      setShipment(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shipment');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (error || !shipment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error || 'Shipment not found'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{shipment.orderRef}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Status Banner */}
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>{shipment.latestStatus}</Text>
          <Text style={styles.updatedText}>
            Updated: {new Date(shipment.updatedAt).toLocaleDateString()}
          </Text>
        </View>

        {/* Details Grid */}
        <View style={styles.detailsSection}>
          <DetailRow label="Order Reference" value={shipment.orderRef} />
          <DetailRow label="Product" value={shipment.productName} />
          <DetailRow label="Quantity" value={`${shipment.quantity} units`} />
          <DetailRow label="Warehouse" value={shipment.receivingWarehouse} />
          <DetailRow label="Supplier" value={shipment.supplier} />
          {shipment.incoterm && <DetailRow label="Incoterm" value={shipment.incoterm} />}
          {shipment.weekNumber && <DetailRow label="Week" value={`W${shipment.weekNumber}`} />}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.push(`/(app)/shipments/${shipment.id}/update`)}
          >
            <Text style={styles.btnText}>Update Status</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  backText: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  statusBanner: {
    backgroundColor: colors.primary + '10',
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: 4,
  },
  statusText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },
  updatedText: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    marginTop: spacing.xs,
  },
  detailsSection: {
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  detailLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    fontWeight: typography.weights.semibold,
  },
  detailValue: {
    fontSize: typography.sizes.sm,
    color: colors.gray[900],
    fontWeight: typography.weights.medium,
  },
  actionButtons: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 4,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  btnText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.md,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: typography.sizes.md,
    color: colors.danger,
    marginBottom: spacing.lg,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 4,
  },
  backBtnText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
});
```

## Navigation Summary

### Key Routes:
- **/(auth)** - Authentication screens (login, register, etc.)
- **/(app)** - Main app with bottom tab navigation
  - **shipments** - Shipment list and detail
  - **products** - Product catalog
  - **warehouse** - Warehouse status
  - **reports** - Analytics and reports
  - **admin** - Admin features
  - **profile** - User profile

### Navigation Patterns:
- **Stack**: Auth flows, detail screens
- **Tabs**: Main app navigation
- **Modal**: Filters, status updates
- **Linking**: Deep linking support

### Best Practices:
✅ Type-safe routing
✅ Smooth animations
✅ Proper error handling
✅ Loading states
✅ Proper unmounting

---

**Ready for implementation. Follow this structure for consistent navigation.**
**Last Updated**: 2025-11-14
