import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface ModalHeaderProps {
  title: string;
  onClose: () => void;
  subtitle?: string;
  rightAction?: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  };
  style?: ViewStyle;
}

export function ModalHeader({
  title,
  onClose,
  subtitle,
  rightAction,
  style,
}: ModalHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftSection}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color="#333" />
        </TouchableOpacity>
      </View>

      <View style={styles.centerSection}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      <View style={styles.rightSection}>
        {rightAction && (
          <TouchableOpacity
            onPress={rightAction.onPress}
            disabled={rightAction.disabled}
            style={rightAction.disabled && styles.actionDisabled}
          >
            <Text
              style={[
                styles.actionText,
                rightAction.disabled && styles.actionTextDisabled,
              ]}
            >
              {rightAction.label}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 56,
  },
  leftSection: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
  },
  centerSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  rightSection: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  actionText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionTextDisabled: {
    color: '#ccc',
  },
  actionDisabled: {
    opacity: 0.5,
  },
});
