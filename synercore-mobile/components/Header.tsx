import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  SafeAreaView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: {
    icon: string;
    onPress: () => void;
  };
  rightText?: {
    label: string;
    onPress: () => void;
  };
  backgroundColor?: string;
  titleColor?: string;
  showBackButton?: boolean;
  style?: ViewStyle;
  containerStyle?: ViewStyle;
}

export function Header({
  title,
  subtitle,
  onBack,
  rightAction,
  rightText,
  backgroundColor = '#fff',
  titleColor = '#333',
  showBackButton = true,
  style,
  containerStyle,
}: HeaderProps) {
  const router = useRouter();

  const handleBack = onBack ? onBack : () => router.back();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]}>
      <View style={[styles.container, { backgroundColor }, containerStyle]}>
        <View style={styles.leftContainer}>
          {showBackButton && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color={titleColor} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.centerContainer}>
          <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.rightContainer}>
          {rightAction && (
            <TouchableOpacity onPress={rightAction.onPress} style={styles.actionButton}>
              <MaterialIcons name={rightAction.icon as any} size={24} color={titleColor} />
            </TouchableOpacity>
          )}

          {rightText && (
            <TouchableOpacity onPress={rightText.onPress}>
              <Text style={[styles.rightTextButton, { color: titleColor }]}>
                {rightText.label}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#fff',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 56,
  },
  leftContainer: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  rightContainer: {
    width: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    marginRight: -8,
  },
  rightTextButton: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
