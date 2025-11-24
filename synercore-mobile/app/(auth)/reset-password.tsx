import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { FormInput } from '@/components/FormInput';
import { Button } from '@/components/Button';
import { ThemedText } from '@/components/themed-text';
import { apiService } from '@/services/api';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const token = params.token as string;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validatePassword = (pwd: string): boolean => {
    return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setPasswordError('');
  };

  const handleConfirmChange = (text: string) => {
    setConfirmPassword(text);
    setConfirmError('');
  };

  const handleSubmit = async () => {
    setPasswordError('');
    setConfirmError('');

    let hasError = false;

    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    } else if (!validatePassword(password)) {
      setPasswordError('Password must be 8+ chars with uppercase, lowercase, and number');
      hasError = true;
    }

    if (!confirmPassword) {
      setConfirmError('Please confirm your password');
      hasError = true;
    } else if (password !== confirmPassword) {
      setConfirmError('Passwords do not match');
      hasError = true;
    }

    if (hasError) return;

    try {
      setIsLoading(true);
      const email = params.email as string;
      if (!email || !token) {
        throw new Error('Missing email or reset token');
      }

      await apiService.resetPassword(token, email, password);
      console.log('✅ Password reset successfully');

      setSubmitted(true);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.replace('/(auth)/login');
      }, 2000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reset password. Please try again.';
      setPasswordError(errorMessage);
      console.error('Password reset error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <View style={styles.errorContainer}>
        <MaterialIcons name="error" size={48} color="#F44336" />
        <ThemedText type="subtitle" style={styles.errorTitle}>Invalid Link</ThemedText>
        <ThemedText style={styles.errorText}>
          The password reset link is invalid or has expired.
        </ThemedText>
        <Button
          title="Request New Link"
          onPress={() => router.back()}
          style={styles.button}
        />
      </View>
    );
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
          <MaterialIcons name="lock" size={56} color="#2196F3" />
          <ThemedText type="title" style={styles.title}>Create New Password</ThemedText>
          <ThemedText style={styles.subtitle}>
            {submitted
              ? 'Your password has been reset successfully!'
              : 'Enter a new password for your account'}
          </ThemedText>
        </View>

        {!submitted ? (
          <View style={styles.form}>
            <FormInput
              label="New Password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={handlePasswordChange}
              icon="lock"
              secureTextEntry
              editable={!isLoading}
              error={passwordError}
              containerStyle={styles.input}
            />

            <FormInput
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={handleConfirmChange}
              icon="lock-check"
              secureTextEntry
              editable={!isLoading}
              error={confirmError}
              containerStyle={styles.input}
            />

            <View style={styles.requirements}>
              <ThemedText style={styles.requirementTitle}>Password must contain:</ThemedText>
              <View style={styles.requirement}>
                <MaterialIcons
                  name={password.length >= 8 ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={password.length >= 8 ? '#4CAF50' : '#999'}
                />
                <ThemedText style={styles.requirementText}>At least 8 characters</ThemedText>
              </View>
              <View style={styles.requirement}>
                <MaterialIcons
                  name={/[A-Z]/.test(password) ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={/[A-Z]/.test(password) ? '#4CAF50' : '#999'}
                />
                <ThemedText style={styles.requirementText}>One uppercase letter</ThemedText>
              </View>
              <View style={styles.requirement}>
                <MaterialIcons
                  name={/[a-z]/.test(password) ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={/[a-z]/.test(password) ? '#4CAF50' : '#999'}
                />
                <ThemedText style={styles.requirementText}>One lowercase letter</ThemedText>
              </View>
              <View style={styles.requirement}>
                <MaterialIcons
                  name={/\d/.test(password) ? 'check-circle' : 'radio-button-unchecked'}
                  size={16}
                  color={/\d/.test(password) ? '#4CAF50' : '#999'}
                />
                <ThemedText style={styles.requirementText}>One number</ThemedText>
              </View>
            </View>

            <Button
              title={isLoading ? 'Resetting...' : 'Reset Password'}
              onPress={handleSubmit}
              loading={isLoading}
              disabled={isLoading}
              style={styles.submitButton}
            />
          </View>
        ) : (
          <View style={styles.successContainer}>
            <MaterialIcons name="check-circle" size={48} color="#4CAF50" style={styles.successIcon} />
            <ThemedText type="subtitle" style={styles.successTitle}>Success!</ThemedText>
            <ThemedText style={styles.successText}>
              Your password has been reset successfully. Redirecting to login...
            </ThemedText>
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.replace('/(auth)/login')}
          style={styles.backButton}
          disabled={isLoading}
        >
          <MaterialIcons name="arrow-back" size={20} color="#2196F3" />
          <ThemedText style={styles.backText}>Back to Login</ThemedText>
        </TouchableOpacity>
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#f5f5f5',
  },
  errorTitle: {
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
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
  input: {
    marginBottom: 20,
  },
  requirements: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  requirementTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  requirementText: {
    fontSize: 12,
    color: '#666',
  },
  submitButton: {
    marginTop: 12,
  },
  successContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    marginBottom: 12,
    textAlign: 'center',
  },
  successText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  backButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  backText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    minWidth: 200,
  },
});
