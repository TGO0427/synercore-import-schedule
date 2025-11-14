import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { storage } from '@/utils/storage';
import { confirmAlert } from '@/utils/alerts';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

export default function DashboardScreen() {
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userJson = await storage.getItem('user');
        if (userJson) {
          setUser(JSON.parse(userJson));
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

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
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.card}>
        <MaterialIcons name="account-circle" size={64} color="#2196F3" style={styles.avatar} />
        <ThemedText type="title" style={styles.userName}>{user?.name || 'User'}</ThemedText>
        <ThemedText style={styles.userEmail}>{user?.email || 'test@example.com'}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.infoCard}>
        <MaterialIcons name="info" size={24} color="#2196F3" style={styles.infoIcon} />
        <View style={styles.infoContent}>
          <ThemedText type="subtitle">Dashboard Overview</ThemedText>
          <ThemedText style={styles.infoText}>
            Manage your shipments, products, and warehouse inventory from here.
          </ThemedText>
        </View>
      </ThemedView>

      <ThemedView style={styles.statsContainer}>
        <ThemedText type="subtitle" style={styles.statsTitle}>Quick Stats</ThemedText>

        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(app)/shipments')}>
          <MaterialIcons name="local-shipping" size={32} color="#2196F3" />
          <ThemedText type="subtitle">0</ThemedText>
          <ThemedText style={styles.statLabel}>Active Shipments</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(app)/products')}>
          <MaterialIcons name="inventory" size={32} color="#FF9800" />
          <ThemedText type="subtitle">0</ThemedText>
          <ThemedText style={styles.statLabel}>Products</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.statCard} onPress={() => router.push('/(app)/warehouse')}>
          <MaterialIcons name="warehouse" size={32} color="#4CAF50" />
          <ThemedText type="subtitle">0</ThemedText>
          <ThemedText style={styles.statLabel}>Warehouse Capacity</ThemedText>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  avatar: {
    marginBottom: 16,
  },
  userName: {
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIcon: {
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoText: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },
  statsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  statsTitle: {
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statLabel: {
    marginTop: 8,
    fontSize: 12,
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
    marginVertical: 20,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
