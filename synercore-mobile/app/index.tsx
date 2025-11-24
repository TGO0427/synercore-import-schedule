import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { storage } from '@/utils/storage';

export default function Index() {
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await storage.getItem('authToken');
        const isAuthenticated = !!token;

        console.log('Auth check:', { isAuthenticated, token: token ? 'exists' : 'none' });

        // Route to appropriate screen
        setInitialRoute(isAuthenticated ? '/(app)' : '/(auth)/login');
      } catch (error) {
        console.error('Auth check failed:', error);
        setInitialRoute('/(auth)/login');
      } finally {
        setIsReady(true);
      }
    };

    checkAuth();
  }, []);

  if (!isReady || !initialRoute) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return <Redirect href={initialRoute} />;
}
