import { Platform, Alert } from 'react-native';

/**
 * Cross-platform alert confirmation
 * Uses native Alert.alert() on mobile, confirm() on web
 */
export const confirmAlert = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void
): void => {
  if (Platform.OS === 'web') {
    // Web: use native confirm dialog
    if (confirm(message)) {
      onConfirm();
    } else {
      onCancel?.();
    }
  } else {
    // Mobile: use React Native Alert
    Alert.alert(title, message, [
      { text: 'Cancel', onPress: onCancel, style: 'cancel' },
      { text: 'OK', onPress: onConfirm, style: 'destructive' },
    ]);
  }
};
