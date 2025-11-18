import React from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

export interface LoadingSpinnerProps {
  visible?: boolean;
  fullScreen?: boolean;
  message?: string;
  size?: 'small' | 'large';
  color?: string;
  style?: ViewStyle;
}

export function LoadingSpinner({
  visible = true,
  fullScreen = false,
  message,
  size = 'large',
  color = '#2196F3',
  style,
}: LoadingSpinnerProps) {
  if (!visible) {
    return null;
  }

  if (fullScreen) {
    return (
      <View style={[styles.fullScreenContainer, style]}>
        <View style={styles.spinnerBox}>
          <ActivityIndicator size={size} color={color} />
          {message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <ActivityIndicator size={size} color={color} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  fullScreenContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 999,
  },
  spinnerBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  message: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
});
