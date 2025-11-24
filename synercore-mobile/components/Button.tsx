import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[`button${variant}`],
        styles[`size${size}`],
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.7}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? '#2196F3' : '#fff'}
          size="small"
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, styles[`text${variant}`], textStyle]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonprimary: {
    backgroundColor: '#2196F3',
  },
  buttonsecondary: {
    backgroundColor: '#f5f5f5',
  },
  buttondanger: {
    backgroundColor: '#F44336',
  },
  buttonoutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  sizesmall: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  sizemedium: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  sizelarge: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    fontWeight: '600',
    fontSize: 14,
  },
  textprimary: {
    color: '#fff',
  },
  textsecondary: {
    color: '#333',
  },
  textdanger: {
    color: '#fff',
  },
  textoutline: {
    color: '#2196F3',
  },
});
