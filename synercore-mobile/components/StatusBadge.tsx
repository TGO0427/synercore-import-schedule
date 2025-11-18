import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface StatusBadgeProps {
  status: string;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  showIcon?: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; backgroundColor: string; icon: string }> = {
  pending: {
    color: '#FFA500',
    backgroundColor: '#FFF3E0',
    icon: 'schedule',
  },
  in_transit: {
    color: '#2196F3',
    backgroundColor: '#E3F2FD',
    icon: 'local-shipping',
  },
  delivered: {
    color: '#4CAF50',
    backgroundColor: '#E8F5E9',
    icon: 'check-circle',
  },
  cancelled: {
    color: '#F44336',
    backgroundColor: '#FFEBEE',
    icon: 'cancel',
  },
  on_hold: {
    color: '#9C27B0',
    backgroundColor: '#F3E5F5',
    icon: 'pause-circle',
  },
  failed: {
    color: '#F44336',
    backgroundColor: '#FFEBEE',
    icon: 'error',
  },
};

export function StatusBadge({
  status,
  size = 'medium',
  style,
  showIcon = true,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status.toLowerCase()] || STATUS_CONFIG.pending;

  const sizeStyles = {
    small: { paddingVertical: 4, paddingHorizontal: 8, gap: 4 },
    medium: { paddingVertical: 6, paddingHorizontal: 12, gap: 6 },
    large: { paddingVertical: 8, paddingHorizontal: 16, gap: 8 },
  };

  const textSizes = {
    small: 12,
    medium: 13,
    large: 14,
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: config.backgroundColor,
          ...sizeStyles[size],
        },
        style,
      ]}
    >
      {showIcon && (
        <MaterialIcons
          name={config.icon as any}
          size={size === 'small' ? 12 : size === 'medium' ? 14 : 16}
          color={config.color}
        />
      )}
      <Text
        style={[
          styles.text,
          {
            color: config.color,
            fontSize: textSizes[size],
          },
        ]}
      >
        {status.replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
