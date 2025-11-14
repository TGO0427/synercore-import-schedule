import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { storage } from '@/utils/storage';
import { confirmAlert } from '@/utils/alerts';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

interface UserProfile {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  joinDate?: string;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setIsLoading(true);
      // Simulate API call - replace with real API
      await new Promise((resolve) => setTimeout(resolve, 500));

      const userJson = await storage.getItem('user');
      if (userJson) {
        const userData = JSON.parse(userJson);
        setUser({
          ...userData,
          phone: '+1 (555) 123-4567',
          company: 'Synercore Inc.',
          role: 'Logistics Manager',
          joinDate: 'January 2024',
        });
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    confirmAlert(
      'Logout',
      'Are you sure you want to logout?',
      async () => {
        try {
          await storage.removeItem('authToken');
          await storage.removeItem('user');
          console.log('Logout successful, redirecting to login...');
          router.replace('/login');
        } catch (error) {
          console.error('Logout failed:', error);
        }
      }
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <MaterialIcons name="account-circle" size={80} color="#2196F3" />
        </View>
        <ThemedText type="title" style={styles.userName}>
          {user?.name || 'User'}
        </ThemedText>
        <ThemedText style={styles.role}>{user?.role || 'User'}</ThemedText>
        <ThemedText style={styles.email}>{user?.email || 'email@example.com'}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.infoSection}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Personal Information
        </ThemedText>

        <View style={styles.infoRow}>
          <MaterialIcons name="email" size={20} color="#2196F3" />
          <View style={styles.infoContent}>
            <ThemedText style={styles.label}>Email</ThemedText>
            <ThemedText style={styles.value}>{user?.email}</ThemedText>
          </View>
        </View>

        <View style={styles.infoRow}>
          <MaterialIcons name="phone" size={20} color="#2196F3" />
          <View style={styles.infoContent}>
            <ThemedText style={styles.label}>Phone</ThemedText>
            <ThemedText style={styles.value}>{user?.phone}</ThemedText>
          </View>
        </View>

        <View style={styles.infoRow}>
          <MaterialIcons name="business" size={20} color="#2196F3" />
          <View style={styles.infoContent}>
            <ThemedText style={styles.label}>Company</ThemedText>
            <ThemedText style={styles.value}>{user?.company}</ThemedText>
          </View>
        </View>

        <View style={styles.infoRow}>
          <MaterialIcons name="work" size={20} color="#2196F3" />
          <View style={styles.infoContent}>
            <ThemedText style={styles.label}>Position</ThemedText>
            <ThemedText style={styles.value}>{user?.role}</ThemedText>
          </View>
        </View>

        <View style={styles.infoRow}>
          <MaterialIcons name="event" size={20} color="#2196F3" />
          <View style={styles.infoContent}>
            <ThemedText style={styles.label}>Member Since</ThemedText>
            <ThemedText style={styles.value}>{user?.joinDate}</ThemedText>
          </View>
        </View>
      </ThemedView>

      <ThemedView style={styles.settingsSection}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Settings
        </ThemedText>

        <TouchableOpacity style={styles.settingRow}>
          <MaterialIcons name="notifications" size={20} color="#2196F3" />
          <View style={styles.settingContent}>
            <ThemedText style={styles.settingLabel}>Notifications</ThemedText>
            <ThemedText style={styles.settingDesc}>Manage notification preferences</ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow}>
          <MaterialIcons name="security" size={20} color="#2196F3" />
          <View style={styles.settingContent}>
            <ThemedText style={styles.settingLabel}>Security</ThemedText>
            <ThemedText style={styles.settingDesc}>Change password and security settings</ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow}>
          <MaterialIcons name="language" size={20} color="#2196F3" />
          <View style={styles.settingContent}>
            <ThemedText style={styles.settingLabel}>Language & Region</ThemedText>
            <ThemedText style={styles.settingDesc}>Change language and regional settings</ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingRow}>
          <MaterialIcons name="info" size={20} color="#2196F3" />
          <View style={styles.settingContent}>
            <ThemedText style={styles.settingLabel}>About</ThemedText>
            <ThemedText style={styles.settingDesc}>App version and information</ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#999" />
        </TouchableOpacity>
      </ThemedView>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <MaterialIcons name="logout" size={20} color="#fff" />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  profileCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  userName: {
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  email: {
    fontSize: 12,
    color: '#999',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  settingsSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'flex-start',
  },
  infoContent: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingContent: {
    flex: 1,
    marginLeft: 0,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDesc: {
    fontSize: 12,
    color: '#999',
  },
  logoutButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
