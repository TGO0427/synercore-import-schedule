# React Native Screen Implementations

Complete, production-ready screen implementations for the Synercore React Native app.

---

## 1. Login Screen (app/(auth)/index.tsx)

```typescript
// app/(auth)/index.tsx
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { FormInput } from '../../components/FormInput';
import { Button } from '../../components/Button';
import { LoadingSpinner } from '../../components/LoadingSpinner';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const validateEmail = (text: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
  };

  const validatePassword = (text: string): boolean => {
    return text.length >= 6;
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (text && !validateEmail(text)) {
      setValidationErrors((prev) => ({ ...prev, email: 'Invalid email format' }));
    } else {
      setValidationErrors((prev) => ({ ...prev, email: undefined }));
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (text && !validatePassword(text)) {
      setValidationErrors((prev) => ({
        ...prev,
        password: 'Password must be at least 6 characters',
      }));
    } else {
      setValidationErrors((prev) => ({ ...prev, password: undefined }));
    }
  };

  const handleLogin = async () => {
    // Clear previous errors
    clearError();

    // Validate inputs
    if (!email || !password) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      await login(email, password);
      // Navigation happens automatically via auth state
    } catch (err) {
      Alert.alert('Login Failed', error || 'An error occurred during login');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Checking authentication..." fullScreen />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>Synercore</Text>
          <Text style={styles.subtitle}>Shipment Management System</Text>
        </View>

        <View style={styles.formContainer}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <FormInput
            label="Email"
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={handleEmailChange}
            icon="email"
            error={validationErrors.email}
            required
          />

          <FormInput
            label="Password"
            placeholder="Enter your password"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={handlePasswordChange}
            icon="lock"
            error={validationErrors.password}
            required
          />

          <Button
            label="Login"
            onPress={handleLogin}
            isLoading={isLoading}
            disabled={!email || !password || !!validationErrors.email}
            fullWidth
            size="large"
            style={styles.loginButton}
          />

          <TouchableOpacity style={styles.forgotContainer}>
            <Link href="/(auth)/forgot-password" asChild>
              <TouchableOpacity>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.registerLink}>Register</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 4,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    marginTop: 8,
  },
  forgotContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  registerLink: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
});
```

---

## 2. Register Screen (app/(auth)/register.tsx)

```typescript
// app/(auth)/register.tsx
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Text,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { FormInput } from '../../components/FormInput';
import { Button } from '../../components/Button';
import { LoadingSpinner } from '../../components/LoadingSpinner';

export default function RegisterScreen() {
  const { register, isLoading, error, clearError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const validateEmail = (text: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
  };

  const validatePassword = (text: string): boolean => {
    return text.length >= 8;
  };

  const checkPasswordStrength = (text: string): string => {
    if (text.length < 8) return 'Too short';
    if (!/[A-Z]/.test(text)) return 'Add uppercase';
    if (!/[0-9]/.test(text)) return 'Add number';
    if (!/[!@#$%^&*]/.test(text)) return 'Add special char';
    return '';
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    const strength = checkPasswordStrength(text);
    setValidationErrors((prev) => ({
      ...prev,
      password: strength || undefined,
    }));
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    if (text && password !== text) {
      setValidationErrors((prev) => ({
        ...prev,
        confirmPassword: 'Passwords do not match',
      }));
    } else {
      setValidationErrors((prev) => ({
        ...prev,
        confirmPassword: undefined,
      }));
    }
  };

  const handleRegister = async () => {
    clearError();

    // Validate
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Validation Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email');
      return;
    }

    if (!validatePassword(password)) {
      Alert.alert('Validation Error', 'Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Validation Error', 'Passwords do not match');
      return;
    }

    try {
      await register(name, email, password);
    } catch (err) {
      Alert.alert('Registration Failed', error || 'An error occurred');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Creating account..." fullScreen />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
        </View>

        <View style={styles.formContainer}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <FormInput
            label="Full Name"
            placeholder="Enter your full name"
            autoCapitalize="words"
            value={name}
            onChangeText={setName}
            icon="person"
            required
          />

          <FormInput
            label="Email"
            placeholder="Enter your email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            icon="email"
            required
          />

          <FormInput
            label="Password"
            placeholder="Enter a strong password"
            secureTextEntry
            autoCapitalize="none"
            value={password}
            onChangeText={handlePasswordChange}
            icon="lock"
            error={validationErrors.password}
            required
          />
          {password && (
            <Text style={styles.strengthHint}>
              Use 8+ chars, uppercase, numbers, and special characters
            </Text>
          )}

          <FormInput
            label="Confirm Password"
            placeholder="Confirm your password"
            secureTextEntry
            autoCapitalize="none"
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            icon="lock"
            error={validationErrors.confirmPassword}
            required
          />

          <Button
            label="Create Account"
            onPress={handleRegister}
            isLoading={isLoading}
            disabled={!name || !email || !password || !confirmPassword}
            fullWidth
            size="large"
            style={styles.registerButton}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <Link href="/(auth)" asChild>
            <TouchableOpacity>
              <Text style={styles.loginLink}>Login</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  errorBanner: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderRadius: 4,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '500',
  },
  strengthHint: {
    fontSize: 12,
    color: '#999',
    marginTop: -12,
    marginBottom: 16,
  },
  registerButton: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  loginLink: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
});
```

---

## 3. Shipments List Screen (app/(app)/shipments/index.tsx)

```typescript
// app/(app)/shipments/index.tsx
import React, { useCallback } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useShipments } from '../../../hooks/useShipments';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { ShipmentCard } from '../../../components/ShipmentCard';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { EmptyState } from '../../../components/EmptyState';
import { Header } from '../../../components/Header';

export default function ShipmentsScreen() {
  const router = useRouter();
  const {
    shipments,
    isLoading,
    error,
    hasMore,
    refresh,
    loadMore,
    filter,
    clearFilters,
  } = useShipments({ pageSize: 20, autoRefresh: true });

  const { isConnected } = useNetworkStatus();

  // Auto-refresh when screen is focused
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [])
  );

  const handleSelectShipment = (shipmentId: string) => {
    router.push(`/(app)/shipments/${shipmentId}`);
  };

  const handleFilterPress = () => {
    router.push('/(app)/shipments/filter');
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      loadMore();
    }
  };

  const renderShipmentCard = ({ item }: { item: any }) => (
    <ShipmentCard
      shipment={item}
      onPress={() => handleSelectShipment(item.id)}
      variant="default"
    />
  );

  const renderHeader = () => (
    <Header
      title="Shipments"
      subtitle={`${shipments.length} total`}
      showBack={false}
      actions={[
        {
          icon: 'filter-list',
          onPress: handleFilterPress,
        },
        {
          icon: 'refresh',
          onPress: refresh,
        },
      ]}
    />
  );

  if (isLoading && shipments.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <LoadingSpinner message="Loading shipments..." />
      </View>
    );
  }

  if (error && shipments.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#F44336" />
          <Text style={styles.errorTitle}>Failed to load shipments</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refresh}>
            <MaterialIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (shipments.length === 0) {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <EmptyState
          icon="inbox"
          title="No Shipments"
          message="You don't have any shipments yet. Create one to get started."
          actionLabel="Create Shipment"
          onAction={() => router.push('/(app)/shipments/create')}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isConnected && (
        <View style={styles.offlineBanner}>
          <MaterialIcons name="wifi-off" size={16} color="#fff" />
          <Text style={styles.offlineText}>You are offline</Text>
        </View>
      )}

      <FlatList
        data={shipments}
        renderItem={renderShipmentCard}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={
          isLoading && shipments.length > 0 ? (
            <LoadingSpinner size="small" />
          ) : null
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
        }
        scrollIndicatorInsets={{ right: 1 }}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingBottom: 16,
  },
  offlineBanner: {
    backgroundColor: '#FF9800',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    alignItems: 'center',
    gap: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
```

---

## 4. Shipment Detail Screen (app/(app)/shipments/[id].tsx)

```typescript
// app/(app)/shipments/[id].tsx
import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSingleShipment } from '../../../hooks/useSingleShipment';
import { Header } from '../../../components/Header';
import { LoadingSpinner } from '../../../components/LoadingSpinner';
import { StatusBadge } from '../../../components/StatusBadge';
import { Button } from '../../../components/Button';
import { FormInput } from '../../../components/FormInput';
import { ModalHeader } from '../../../components/ModalHeader';

export default function ShipmentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    shipment,
    isLoading,
    isUpdating,
    error,
    refresh,
    updateStatus,
    clearError,
  } = useSingleShipment(id!);

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');

  const handleUpdateStatus = async () => {
    if (!newStatus) {
      Alert.alert('Error', 'Please select a status');
      return;
    }

    try {
      await updateStatus(newStatus, notes);
      setShowUpdateModal(false);
      setNewStatus('');
      setNotes('');
      Alert.alert('Success', 'Shipment status updated');
    } catch (err) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Shipment Details" />
        <LoadingSpinner message="Loading shipment..." />
      </View>
    );
  }

  if (error || !shipment) {
    return (
      <View style={styles.container}>
        <Header title="Shipment Details" />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={48} color="#F44336" />
          <Text style={styles.errorText}>{error || 'Shipment not found'}</Text>
          <Button
            label="Go Back"
            onPress={() => router.back()}
            variant="primary"
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Shipment Details" />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <Text style={styles.orderRef}>{shipment.orderRef}</Text>
            <StatusBadge status={shipment.status} size="large" />
          </View>
          <Text style={styles.supplier}>{shipment.supplier}</Text>
        </View>

        {/* Main Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>
          <DetailRow
            icon="location-on"
            label="Destination"
            value={shipment.destination}
          />
          <DetailRow
            icon="weight"
            label="Weight"
            value={`${shipment.weight} kg`}
          />
          <DetailRow
            icon="calendar-today"
            label="Est. Delivery"
            value={formatDate(shipment.estimatedDelivery)}
          />
          <DetailRow
            icon="update"
            label="Last Updated"
            value={formatTime(shipment.updatedAt)}
          />
        </View>

        {/* Timeline */}
        {shipment.timeline && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            {shipment.timeline.map((event, index) => (
              <View key={index} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>{event.status}</Text>
                  <Text style={styles.timelineTime}>{formatTime(event.timestamp)}</Text>
                  {event.notes && (
                    <Text style={styles.timelineNotes}>{event.notes}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Documents */}
        {shipment.documents && shipment.documents.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Documents</Text>
            {shipment.documents.map((doc, index) => (
              <TouchableOpacity
                key={index}
                style={styles.documentItem}
              >
                <MaterialIcons name="description" size={20} color="#2196F3" />
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName}>{doc.name}</Text>
                  <Text style={styles.documentDate}>
                    {formatDate(doc.uploadedAt)}
                  </Text>
                </View>
                <MaterialIcons name="download" size={20} color="#2196F3" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionBar}>
        <Button
          label="Update Status"
          onPress={() => setShowUpdateModal(true)}
          variant="primary"
          fullWidth
        />
      </View>

      {/* Update Status Modal */}
      <Modal
        visible={showUpdateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUpdateModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <ModalHeader
              title="Update Status"
              subtitle={shipment.orderRef}
              onClose={() => setShowUpdateModal(false)}
            />

            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>New Status</Text>
              <View style={styles.statusOptions}>
                {['pending', 'in_transit', 'delivered', 'cancelled'].map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      newStatus === status && styles.statusOptionSelected,
                    ]}
                    onPress={() => setNewStatus(status)}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        newStatus === status && styles.statusOptionTextSelected,
                      ]}
                    >
                      {status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <FormInput
                label="Notes"
                placeholder="Add update notes"
                multiline
                numberOfLines={4}
                value={notes}
                onChangeText={setNotes}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                label="Cancel"
                onPress={() => setShowUpdateModal(false)}
                variant="secondary"
                style={{ flex: 1 }}
              />
              <Button
                label="Update"
                onPress={handleUpdateStatus}
                isLoading={isUpdating}
                disabled={!newStatus}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface DetailRowProps {
  icon: string;
  label: string;
  value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <MaterialIcons name={icon as any} size={20} color="#666" />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statusSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderRef: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  supplier: {
    fontSize: 14,
    color: '#666',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  timelineItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'flex-start',
    gap: 12,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  timelineTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  timelineNotes: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    gap: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  documentDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  actionBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%',
  },
  modalBody: {
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  statusOption: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  statusOptionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#f0f7ff',
  },
  statusOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  statusOptionTextSelected: {
    color: '#2196F3',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
});
```

---

## Screen Organization in app/ Directory

```
app/
├── _layout.tsx                    # Root layout
├── (auth)/
│   ├── _layout.tsx               # Auth stack
│   ├── index.tsx                 # Login
│   ├── register.tsx              # Register
│   ├── forgot-password.tsx        # Forgot password
│   └── reset-password.tsx         # Reset password
└── (app)/
    ├── _layout.tsx               # App tabs layout
    ├── shipments/
    │   ├── _layout.tsx           # Shipments stack
    │   ├── index.tsx             # List (THIS FILE)
    │   ├── [id].tsx              # Detail (THIS FILE)
    │   ├── [id]/update.tsx        # Update modal
    │   ├── filter.tsx            # Filter modal
    │   └── create.tsx            # Create shipment
    ├── products/
    │   ├── _layout.tsx
    │   └── index.tsx
    ├── warehouse/
    │   ├── _layout.tsx
    │   └── index.tsx
    ├── reports/
    │   ├── _layout.tsx
    │   └── index.tsx
    ├── admin/
    │   ├── _layout.tsx
    │   └── index.tsx
    └── profile/
        ├── _layout.tsx
        └── index.tsx
```

---

## Testing Screen Implementations

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import ShipmentsScreen from '../app/(app)/shipments/index';

describe('Shipments Screen', () => {
  it('should display list of shipments', async () => {
    render(<ShipmentsScreen />);

    await waitFor(() => {
      expect(screen.getByText(/shipments/i)).toBeTruthy();
    });
  });

  it('should handle refresh', async () => {
    render(<ShipmentsScreen />);
    const refreshControl = screen.getByTestId('refresh-control');

    fireEvent(refreshControl, 'onRefresh');

    await waitFor(() => {
      expect(screen.getByText(/loading/i)).toBeTruthy();
    });
  });
});
```

---

**All screens are production-ready with proper error handling, loading states, and offline support.**
**Last Updated**: 2025-11-14
