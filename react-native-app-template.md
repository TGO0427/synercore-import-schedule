# React Native Component Templates

This document provides template code for React Native components used in the Synercore mobile app.

## Core Components

### 1. ShipmentCard Component

```typescript
// components/ShipmentCard.tsx
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions
} from 'react-native';
import { colors, spacing, typography } from '../theme';

interface Shipment {
  id: string;
  orderRef: string;
  productName: string;
  quantity: number;
  latestStatus: string;
  supplier: string;
  receivingWarehouse: string;
  updatedAt: string;
}

interface ShipmentCardProps {
  shipment: Shipment;
  onPress: (id: string) => void;
  onStatusPress?: (id: string) => void;
  compact?: boolean;
}

const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'planned_airfreight': colors.gray[500],
    'in_transit_airfreight': colors.warning,
    'arrived_pta': colors.info,
    'stored': colors.primary,
    'received': colors.success,
    'inspection_failed': colors.danger,
    'inspection_passed': colors.success
  };
  return statusColors[status] || colors.gray[500];
};

const formatStatus = (status: string): string => {
  const labels: Record<string, string> = {
    'planned_airfreight': '✈️ Planned - Air',
    'in_transit_airfreight': '✈️ In Transit - Air',
    'arrived_pta': '📦 Arrived - PTA',
    'stored': '🏪 Stored',
    'received': '✅ Received',
    'inspection_failed': '❌ Inspection Failed',
    'inspection_passed': '✓ Inspection Passed'
  };
  return labels[status] || status;
};

export const ShipmentCard: React.FC<ShipmentCardProps> = ({
  shipment,
  onPress,
  onStatusPress,
  compact = false
}) => {
  const borderColor = getStatusColor(shipment.latestStatus);

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.compactCard, { borderLeftColor: borderColor }]}
        onPress={() => onPress(shipment.id)}
      >
        <View style={styles.compactContent}>
          <Text style={styles.orderRef}>{shipment.orderRef}</Text>
          <View
            style={[
              styles.statusBadgeSmall,
              { backgroundColor: borderColor }
            ]}
          >
            <Text style={styles.statusBadgeText}>
              {formatStatus(shipment.latestStatus).split(' ')[0]}
            </Text>
          </View>
        </View>
        <Text style={styles.arrow}>→</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: borderColor }]}
      onPress={() => onPress(shipment.id)}
    >
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleSection}>
          <Text style={styles.cardTitle}>{shipment.orderRef}</Text>
          <Text style={styles.productName}>{shipment.productName}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: borderColor }]}>
          <Text style={styles.statusBadgeText}>
            {formatStatus(shipment.latestStatus).split(' ')[0]}
          </Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>📦 Qty</Text>
            <Text style={styles.infoValue}>{shipment.quantity}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>🏪 Warehouse</Text>
            <Text style={styles.infoValue}>{shipment.receivingWarehouse}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>🏢 Supplier</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {shipment.supplier}
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => onPress(shipment.id)}
        >
          <Text style={styles.btnText}>View Details</Text>
        </TouchableOpacity>
        {onStatusPress && (
          <TouchableOpacity
            style={styles.btnSecondary}
            onPress={() => onStatusPress(shipment.id)}
          >
            <Text style={styles.btnSecondaryText}>Update</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4
  },
  compactCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1
  },
  cardHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.gray[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  titleSection: {
    flex: 1
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.xs
  },
  productName: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600]
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    marginLeft: spacing.md
  },
  statusBadgeSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4
  },
  statusBadgeText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold
  },
  cardBody: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  infoGrid: {
    gap: spacing.md
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs
  },
  infoLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.gray[600],
    textTransform: 'uppercase'
  },
  infoValue: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[900]
  },
  cardFooter: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.gray[50],
    flexDirection: 'row',
    gap: spacing.md
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 4,
    alignItems: 'center'
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: colors.gray[100],
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[300]
  },
  btnText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm
  },
  btnSecondaryText: {
    color: colors.gray[900],
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm
  },
  orderRef: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[900],
    flex: 1
  },
  arrow: {
    fontSize: typography.sizes.lg,
    color: colors.primary,
    marginLeft: spacing.md
  }
});
```

### 2. LoadingSpinner Component

```typescript
// components/LoadingSpinner.tsx
import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../theme';

interface LoadingSpinnerProps {
  loading?: boolean;
  size?: 'small' | 'large';
  color?: string;
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  loading = true,
  size = 'large',
  color = colors.primary,
  message
}) => {
  if (!loading) return null;

  return (
    <View style={styles.container}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg
  },
  message: {
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.gray[600],
    textAlign: 'center'
  }
});
```

### 3. ErrorBoundary Component

```typescript
// components/ErrorBoundary.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (error: Error, retry: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('Error caught by boundary:', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      return (
        <View style={styles.container}>
          <Text style={styles.title}>Oops! Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: 'center'
  },
  message: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 24
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 4
  },
  buttonText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.md
  }
});
```

### 4. StatusBadge Component

```typescript
// components/StatusBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'medium' | 'large';
}

const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'planned_airfreight': colors.gray[500],
    'in_transit_airfreight': colors.warning,
    'arrived_pta': colors.info,
    'stored': colors.primary,
    'received': colors.success,
    'inspection_failed': colors.danger,
    'inspection_passed': colors.success
  };
  return statusColors[status] || colors.gray[500];
};

const formatStatus = (status: string): string => {
  const labels: Record<string, string> = {
    'planned_airfreight': 'Planned - Air',
    'in_transit_airfreight': 'In Transit - Air',
    'arrived_pta': 'Arrived - PTA',
    'stored': 'Stored',
    'received': 'Received',
    'inspection_failed': 'Inspection Failed',
    'inspection_passed': 'Inspection Passed'
  };
  return labels[status] || status;
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'medium'
}) => {
  const backgroundColor = getStatusColor(status);
  const sizeStyles = {
    small: styles.badgeSmall,
    medium: styles.badgeMedium,
    large: styles.badgeLarge
  };
  const textSizeStyles = {
    small: styles.textSmall,
    medium: styles.textMedium,
    large: styles.textLarge
  };

  return (
    <View style={[styles.badge, sizeStyles[size], { backgroundColor }]}>
      <Text style={[styles.text, textSizeStyles[size]]}>
        {formatStatus(status)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 4,
    alignSelf: 'flex-start'
  },
  badgeSmall: {
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.xs
  },
  badgeMedium: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm
  },
  badgeLarge: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  text: {
    color: colors.white,
    fontWeight: typography.weights.semibold
  },
  textSmall: {
    fontSize: typography.sizes.xs
  },
  textMedium: {
    fontSize: typography.sizes.sm
  },
  textLarge: {
    fontSize: typography.sizes.md
  }
});
```

## Screen Templates

### Login Screen

```typescript
// app/(auth)/login.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import { authService } from '../../services/auth';
import { colors, spacing, typography } from '../../theme';
import { LoadingSpinner } from '../../components/LoadingSpinner';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await authService.login(email, password);
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
        {/* Logo/Header */}
        <View style={styles.headerSection}>
          <Text style={styles.appName}>Synercore</Text>
          <Text style={styles.tagline}>Supply Chain Management</Text>
        </View>

        {/* Form */}
        <View style={styles.formSection}>
          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              placeholderTextColor={colors.gray[400]}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
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
              <LoadingSpinner loading size="small" color={colors.white} />
            ) : (
              <Text style={styles.loginBtnText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity>
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
    backgroundColor: colors.white
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'space-between'
  },
  headerSection: {
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl,
    alignItems: 'center'
  },
  appName: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.primary,
    marginBottom: spacing.xs
  },
  tagline: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600]
  },
  formSection: {
    paddingVertical: spacing.xl
  },
  errorText: {
    backgroundColor: colors.danger + '20',
    color: colors.danger,
    padding: spacing.md,
    borderRadius: 4,
    marginBottom: spacing.md,
    overflow: 'hidden'
  },
  inputGroup: {
    marginBottom: spacing.lg
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.gray[900],
    marginBottom: spacing.sm
  },
  input: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.gray[900]
  },
  loginBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: spacing.lg
  },
  loginBtnDisabled: {
    opacity: 0.6
  },
  loginBtnText: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.md
  },
  forgotPassword: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.md,
    fontWeight: typography.weights.medium
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg
  },
  footerText: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm
  },
  registerLink: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
    fontSize: typography.sizes.sm
  }
});
```

## Theme Configuration

```typescript
// theme/colors.ts
export const colors = {
  primary: '#003d82',
  secondary: '#0066cc',
  success: '#28a745',
  warning: '#ffc107',
  danger: '#dc3545',
  info: '#17a2b8',
  white: '#ffffff',
  black: '#000000',
  gray: {
    50: '#f9fafb',
    100: '#f3f4f6',
    200: '#e5e7eb',
    300: '#d1d5db',
    400: '#9ca3af',
    500: '#6b7280',
    600: '#4b5563',
    700: '#374151',
    800: '#1f2937',
    900: '#111827'
  }
};

// theme/spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32
};

// theme/typography.ts
export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30
  },
  weights: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800'
  }
};
```

---

**Total Components**: 8+ (and growing)
**Last Updated**: 2025-11-14
**Ready to Use**: Yes - Copy and modify as needed
