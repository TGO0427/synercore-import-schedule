import React, { useState } from 'react';
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

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const { isLoading, error, isAuthenticated, register, clearError } = useAuth();

  // Validate email format
  const validateEmail = (text: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
  };

  // Check password strength
  const checkPasswordStrength = (text: string): string => {
    if (text.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(text)) return 'Add uppercase letter';
    if (!/[0-9]/.test(text)) return 'Add number';
    if (!/[!@#$%^&*]/.test(text)) return 'Add special character (!@#$%^&*)';
    return '';
  };

  const handleNameChange = (text: string) => {
    setName(text);
    setNameError('');
    clearError();
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailError('');
    clearError();
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setPasswordError('');
    setConfirmPasswordError('');
    clearError();
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    setConfirmPasswordError('');
    clearError();
  };

  const handleRegister = async () => {
    // Clear previous errors
    setNameError('');
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    clearError();

    // Validation
    if (!name) {
      setNameError('Name is required');
      return;
    }

    if (name.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }

    if (!email) {
      setEmailError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email');
      return;
    }

    if (!password) {
      setPasswordError('Password is required');
      return;
    }

    const passwordStrengthError = checkPasswordStrength(password);
    if (passwordStrengthError) {
      setPasswordError(passwordStrengthError);
      return;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }

    try {
      await register(name, email, password);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      console.error('Registration error:', errorMessage);
    }
  };

  const handleLogin = () => {
    router.back();
  };

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
          <MaterialIcons name="person-add" size={56} color="#2196F3" />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Sign up to get started</Text>
        </View>

        <View style={styles.formContainer}>
          {error && (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error" size={18} color="#F44336" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <FormInput
            label="Full Name"
            placeholder="Enter your full name"
            value={name}
            onChangeText={handleNameChange}
            icon="person"
            autoCapitalize="words"
            editable={!isLoading}
            error={nameError}
            containerStyle={styles.inputGroup}
          />

          <FormInput
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={handleEmailChange}
            icon="email"
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
            error={emailError}
            containerStyle={styles.inputGroup}
          />

          <FormInput
            label="Password"
            placeholder="Create a strong password"
            value={password}
            onChangeText={handlePasswordChange}
            icon="lock"
            secureTextEntry
            editable={!isLoading}
            error={passwordError}
            hint="Minimum 8 characters, uppercase, number, and special character"
            containerStyle={styles.inputGroup}
          />

          <FormInput
            label="Confirm Password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChangeText={handleConfirmPasswordChange}
            icon="lock"
            secureTextEntry
            editable={!isLoading}
            error={confirmPasswordError}
            containerStyle={styles.inputGroup}
          />

          <Button
            title={isLoading ? 'Creating Account...' : 'Create Account'}
            onPress={handleRegister}
            loading={isLoading}
            disabled={isLoading}
            style={styles.registerButton}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={handleLogin} disabled={isLoading}>
            <Text style={styles.loginLink}>Login</Text>
          </TouchableOpacity>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
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
    marginBottom: 16,
  },
  registerButton: {
    marginTop: 16,
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
