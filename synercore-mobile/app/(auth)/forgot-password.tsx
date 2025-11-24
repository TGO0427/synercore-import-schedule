import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { FormInput } from '@/components/FormInput';
import { Button } from '@/components/Button';
import { ThemedText } from '@/components/themed-text';
import { apiService } from '@/services/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (text: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text);
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailError('');
  };

  const handleSubmit = async () => {
    setEmailError('');

    if (!email) {
      setEmailError('Email is required');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email');
      return;
    }

    try {
      setIsLoading(true);
      await apiService.sendPasswordReset(email);
      console.log('✅ Password reset email sent to:', email);
      setSubmitted(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reset email. Please try again.';
      setEmailError(errorMessage);
      console.error('Password reset error:', error);
    } finally {
      setIsLoading(false);
    }
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
          <MaterialIcons name="lock-reset" size={56} color="#2196F3" />
          <ThemedText type="title" style={styles.title}>Reset Password</ThemedText>
          <ThemedText style={styles.subtitle}>
            {submitted
              ? 'Check your email for reset instructions'
              : 'Enter your email address and we\'ll send you a link to reset your password'}
          </ThemedText>
        </View>

        {!submitted ? (
          <View style={styles.form}>
            <FormInput
              label="Email"
              placeholder="Enter your email address"
              value={email}
              onChangeText={handleEmailChange}
              icon="email"
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
              error={emailError}
              containerStyle={styles.input}
            />

            <Button
              title={isLoading ? 'Sending...' : 'Send Reset Link'}
              onPress={handleSubmit}
              loading={isLoading}
              disabled={isLoading}
              style={styles.submitButton}
            />
          </View>
        ) : (
          <View style={styles.successContainer}>
            <MaterialIcons name="check-circle" size={48} color="#4CAF50" style={styles.successIcon} />
            <ThemedText type="subtitle" style={styles.successTitle}>Email Sent!</ThemedText>
            <ThemedText style={styles.successText}>
              We've sent password reset instructions to {email}. Please check your inbox and follow the link to create a new password.
            </ThemedText>
            <ThemedText style={styles.supportText}>
              Didn't receive the email? Check your spam folder or contact support.
            </ThemedText>
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.back()}
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
    maxWidth: 300,
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
    marginBottom: 16,
  },
  supportText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
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
});
