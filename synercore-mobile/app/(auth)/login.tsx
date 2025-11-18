import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks';
import { FormInput, Button, LoadingSpinner } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('testuser');
  const [password, setPassword] = useState('TestPass123');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const { isLoading, error, isAuthenticated, login, clearError } = useAuth();

  // Validate username/email format (username: 3-50 chars, alphanumeric + hyphens/underscores; or email: standard format)
  const validateUsername = (text: string): boolean => {
    // Check if it looks like an email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(text)) {
      return true;
    }
    // Check if it's a valid username (3-50 chars, alphanumeric + hyphens/underscores)
    const usernameRegex = /^[a-zA-Z0-9_-]{3,50}$/;
    return usernameRegex.test(text);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailError('');
    clearError();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setPasswordError('');
    clearError();
  };

  // Redirect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setIsCheckingAuth(false);
      router.replace('/(app)');
    } else {
      setIsCheckingAuth(false);
    }
  }, [isAuthenticated]);

  const handleLogin = async () => {
    // Clear previous errors
    setEmailError('');
    setPasswordError('');
    clearError();

    // Validation
    if (!email) {
      setEmailError('Username or email is required');
      return;
    }

    if (!validateUsername(email)) {
      setEmailError('Please enter a valid username (3+ characters) or email');
      return;
    }

    if (!password) {
      setPasswordError('Password is required');
      return;
    }

    try {
      await login(email, password);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      console.error('Login error:', errorMessage);
    }
  };

  const handleRegister = () => {
    router.push('/(auth)/register');
  };

  const handleForgotPassword = () => {
    console.log('📧 Navigating to forgot password screen');
    router.push('/(auth)/forgot-password');
  };

  if (isCheckingAuth) {
    return <LoadingSpinner fullScreen visible message="Checking authentication..." />;
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
          <MaterialIcons name="local-shipping" size={56} color="#2196F3" />
          <Text style={styles.logo}>Synercore</Text>
          <Text style={styles.subtitle}>Shipment Management</Text>
        </View>

        <View style={styles.formContainer}>
          {error && (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error" size={18} color="#F44336" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <FormInput
            label="Username or Email"
            placeholder="Enter your username or email"
            value={email}
            onChangeText={handleEmailChange}
            icon="person"
            keyboardType="default"
            autoCapitalize="none"
            editable={!isLoading}
            error={emailError}
            containerStyle={styles.inputGroup}
          />

          <FormInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={handlePasswordChange}
            icon="lock"
            secureTextEntry
            editable={!isLoading}
            error={passwordError}
            containerStyle={styles.inputGroup}
          />

          <Button
            title={isLoading ? 'Logging in...' : 'Login'}
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            style={styles.loginButton}
          />

          <TouchableOpacity
            onPress={handleForgotPassword}
            style={styles.forgotContainer}
            disabled={isLoading}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={handleRegister} disabled={isLoading}>
            <Text style={styles.registerLink}>Register</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.demoHint}>
          <Text style={styles.demoHintText}>Demo credentials (pre-filled):</Text>
          <Text style={styles.demoHintEmail}>testuser</Text>
          <Text style={styles.demoHintEmail}>TestPass123</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2196F3',
    marginTop: 12,
    marginBottom: 4,
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
    marginBottom: 20,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  loginButton: {
    marginTop: 12,
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
    marginBottom: 20,
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
  demoHint: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  demoHintText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
    marginBottom: 8,
  },
  demoHintEmail: {
    fontSize: 13,
    color: '#1565C0',
    fontFamily: 'monospace',
    marginVertical: 2,
  },
});
