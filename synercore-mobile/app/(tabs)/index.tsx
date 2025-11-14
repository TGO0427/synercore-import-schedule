import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { storage } from '@/utils/storage';
import { confirmAlert } from '@/utils/alerts';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

export default function HomeScreen() {
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
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="local-shipping" size={48} color="#2196F3" />
        <ThemedText type="title" style={styles.title}>Synercore</ThemedText>
        <ThemedText style={styles.subtitle}>Shipment Management System</ThemedText>
      </View>

      <ThemedView style={styles.card}>
        <MaterialIcons name="account-circle" size={64} color="#2196F3" style={styles.avatar} />
        <ThemedText type="title" style={styles.userName}>{user?.name || 'User'}</ThemedText>
        <ThemedText style={styles.userEmail}>{user?.email || 'test@example.com'}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.infoCard}>
        <ThemedText type="subtitle">✅ Authentication Working!</ThemedText>
        <ThemedText style={styles.infoText}>
          You have successfully logged in. Your token is securely stored in AsyncStorage.
        </ThemedText>
      </ThemedView>

      <ThemedView style={styles.stepsCard}>
        <ThemedText type="subtitle" style={styles.stepsTitle}>Next Steps:</ThemedText>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>1</Text>
          <ThemedText style={styles.stepText}>Explore the app tabs</ThemedText>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>2</Text>
          <ThemedText style={styles.stepText}>Check the Explore tab</ThemedText>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>3</Text>
          <ThemedText style={styles.stepText}>Integrate your API endpoints</ThemedText>
        </View>
      </ThemedView>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        activeOpacity={0.7}
      >
        <MaterialIcons name="logout" size={20} color="#fff" />
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#f5f5f5',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  title: {
    marginTop: 12,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
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
  },
  infoText: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 20,
  },
  stepsCard: {
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
  stepsTitle: {
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2196F3',
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  stepText: {
    flex: 1,
    paddingTop: 4,
    fontSize: 13,
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
    marginTop: 'auto',
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
