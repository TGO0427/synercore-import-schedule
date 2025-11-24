import React, { useState } from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FormInput } from './FormInput';
import { Button } from './Button';
import { ThemedText } from './themed-text';

interface PasswordChangeModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}

export function PasswordChangeModal({ visible, onClose, onSubmit }: PasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const validatePassword = (pwd: string): boolean => {
    return pwd.length >= 8 && /[A-Z]/.test(pwd) && /[a-z]/.test(pwd) && /\d/.test(pwd);
  };

  const handleReset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPasswordError('');
    setNewPasswordError('');
    setConfirmPasswordError('');
    setSuccessMessage('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async () => {
    setCurrentPasswordError('');
    setNewPasswordError('');
    setConfirmPasswordError('');
    setSuccessMessage('');

    let hasError = false;

    if (!currentPassword) {
      setCurrentPasswordError('Current password is required');
      hasError = true;
    }

    if (!newPassword) {
      setNewPasswordError('New password is required');
      hasError = true;
    } else if (!validatePassword(newPassword)) {
      setNewPasswordError('Password must be 8+ chars with uppercase, lowercase, and number');
      hasError = true;
    }

    if (!confirmPassword) {
      setConfirmPasswordError('Please confirm your password');
      hasError = true;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      hasError = true;
    }

    if (newPassword === currentPassword) {
      setNewPasswordError('New password must be different from current password');
      hasError = true;
    }

    if (hasError) return;

    try {
      setIsLoading(true);
      await onSubmit(currentPassword, newPassword);
      setSuccessMessage('Password changed successfully!');
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1500);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to change password';
      setCurrentPasswordError(errorMsg);
      console.error('Password change error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.header}>
              <ThemedText type="title" style={styles.title}>
                Change Password
              </ThemedText>
              <TouchableOpacity onPress={handleClose} disabled={isLoading}>
                <MaterialIcons name="close" size={24} color="#999" />
              </TouchableOpacity>
            </View>

            {successMessage ? (
              <View style={styles.successContainer}>
                <MaterialIcons name="check-circle" size={48} color="#4CAF50" />
                <ThemedText style={styles.successText}>{successMessage}</ThemedText>
              </View>
            ) : (
              <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                scrollEnabled={!isLoading}
              >
                <FormInput
                  label="Current Password"
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  icon="lock"
                  secureTextEntry
                  editable={!isLoading}
                  error={currentPasswordError}
                  containerStyle={styles.input}
                />

                <View style={styles.divider} />

                <FormInput
                  label="New Password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  icon="lock"
                  secureTextEntry
                  editable={!isLoading}
                  error={newPasswordError}
                  containerStyle={styles.input}
                />

                <View style={styles.requirements}>
                  <ThemedText style={styles.requirementTitle}>Password must contain:</ThemedText>
                  <View style={styles.requirement}>
                    <MaterialIcons
                      name={newPassword.length >= 8 ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={newPassword.length >= 8 ? '#4CAF50' : '#999'}
                    />
                    <ThemedText style={styles.requirementText}>At least 8 characters</ThemedText>
                  </View>
                  <View style={styles.requirement}>
                    <MaterialIcons
                      name={/[A-Z]/.test(newPassword) ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={/[A-Z]/.test(newPassword) ? '#4CAF50' : '#999'}
                    />
                    <ThemedText style={styles.requirementText}>One uppercase letter</ThemedText>
                  </View>
                  <View style={styles.requirement}>
                    <MaterialIcons
                      name={/[a-z]/.test(newPassword) ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={/[a-z]/.test(newPassword) ? '#4CAF50' : '#999'}
                    />
                    <ThemedText style={styles.requirementText}>One lowercase letter</ThemedText>
                  </View>
                  <View style={styles.requirement}>
                    <MaterialIcons
                      name={/\d/.test(newPassword) ? 'check-circle' : 'radio-button-unchecked'}
                      size={16}
                      color={/\d/.test(newPassword) ? '#4CAF50' : '#999'}
                    />
                    <ThemedText style={styles.requirementText}>One number</ThemedText>
                  </View>
                </View>

                <FormInput
                  label="Confirm Password"
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  icon="lock-check"
                  secureTextEntry
                  editable={!isLoading}
                  error={confirmPasswordError}
                  containerStyle={styles.input}
                />

                <Button
                  title={isLoading ? 'Changing...' : 'Change Password'}
                  onPress={handleSubmit}
                  loading={isLoading}
                  disabled={isLoading}
                  style={styles.submitButton}
                />
              </ScrollView>
            )}

            <View style={styles.footer}>
              <Button
                title="Close"
                onPress={handleClose}
                disabled={isLoading}
                style={styles.closeButton}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  input: {
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 20,
  },
  requirements: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
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
  successContainer: {
    paddingVertical: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontSize: 16,
    color: '#4CAF50',
    marginTop: 16,
    fontWeight: '600',
  },
  submitButton: {
    marginBottom: 12,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  closeButton: {
    backgroundColor: '#f5f5f5',
  },
});
