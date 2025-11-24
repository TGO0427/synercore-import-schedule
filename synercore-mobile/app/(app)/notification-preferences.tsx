import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Switch, TouchableOpacity, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { storage } from '@/utils/storage';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  shipmentUpdates: boolean;
  productAlerts: boolean;
  warehouseAlerts: boolean;
  weeklyReport: boolean;
  promotions: boolean;
}

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    pushNotifications: true,
    shipmentUpdates: true,
    productAlerts: true,
    warehouseAlerts: true,
    weeklyReport: true,
    promotions: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const stored = await storage.getItem('notificationPreferences');
      if (stored) {
        setPreferences(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    }
  };

  const togglePreference = (key: keyof NotificationPreferences) => {
    const updated = { ...preferences, [key]: !preferences[key] };
    setPreferences(updated);
    savePreferences(updated);
  };

  const savePreferences = async (prefs: NotificationPreferences) => {
    try {
      setIsSaving(true);
      await storage.setItem('notificationPreferences', JSON.stringify(prefs));
      console.log('✅ Notification preferences saved');
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <MaterialIcons name="arrow-back" size={24} color="#2196F3" />
        <ThemedText type="title" style={styles.headerTitle}>
          Notification Preferences
        </ThemedText>
      </TouchableOpacity>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Channels
        </ThemedText>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <MaterialIcons name="email" size={20} color="#2196F3" />
            <View style={styles.preferenceInfo}>
              <ThemedText style={styles.preferenceName}>Email Notifications</ThemedText>
              <ThemedText style={styles.preferenceDesc}>Receive updates via email</ThemedText>
            </View>
          </View>
          <Switch
            value={preferences.emailNotifications}
            onValueChange={() => togglePreference('emailNotifications')}
            disabled={isSaving}
            trackColor={{ false: '#767577', true: '#81C784' }}
            thumbColor={preferences.emailNotifications ? '#2196F3' : '#f4f3f4'}
          />
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <MaterialIcons name="notifications-active" size={20} color="#2196F3" />
            <View style={styles.preferenceInfo}>
              <ThemedText style={styles.preferenceName}>Push Notifications</ThemedText>
              <ThemedText style={styles.preferenceDesc}>Receive push alerts on device</ThemedText>
            </View>
          </View>
          <Switch
            value={preferences.pushNotifications}
            onValueChange={() => togglePreference('pushNotifications')}
            disabled={isSaving}
            trackColor={{ false: '#767577', true: '#81C784' }}
            thumbColor={preferences.pushNotifications ? '#2196F3' : '#f4f3f4'}
          />
        </View>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Updates
        </ThemedText>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <MaterialIcons name="local-shipping" size={20} color="#FF9800" />
            <View style={styles.preferenceInfo}>
              <ThemedText style={styles.preferenceName}>Shipment Updates</ThemedText>
              <ThemedText style={styles.preferenceDesc}>Notifications about shipment status</ThemedText>
            </View>
          </View>
          <Switch
            value={preferences.shipmentUpdates}
            onValueChange={() => togglePreference('shipmentUpdates')}
            disabled={isSaving}
            trackColor={{ false: '#767577', true: '#81C784' }}
            thumbColor={preferences.shipmentUpdates ? '#2196F3' : '#f4f3f4'}
          />
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <MaterialIcons name="inventory" size={20} color="#FF9800" />
            <View style={styles.preferenceInfo}>
              <ThemedText style={styles.preferenceName}>Product Alerts</ThemedText>
              <ThemedText style={styles.preferenceDesc}>Low stock and availability alerts</ThemedText>
            </View>
          </View>
          <Switch
            value={preferences.productAlerts}
            onValueChange={() => togglePreference('productAlerts')}
            disabled={isSaving}
            trackColor={{ false: '#767577', true: '#81C784' }}
            thumbColor={preferences.productAlerts ? '#2196F3' : '#f4f3f4'}
          />
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <MaterialIcons name="warehouse" size={20} color="#4CAF50" />
            <View style={styles.preferenceInfo}>
              <ThemedText style={styles.preferenceName}>Warehouse Alerts</ThemedText>
              <ThemedText style={styles.preferenceDesc}>Capacity and zone notifications</ThemedText>
            </View>
          </View>
          <Switch
            value={preferences.warehouseAlerts}
            onValueChange={() => togglePreference('warehouseAlerts')}
            disabled={isSaving}
            trackColor={{ false: '#767577', true: '#81C784' }}
            thumbColor={preferences.warehouseAlerts ? '#2196F3' : '#f4f3f4'}
          />
        </View>
      </ThemedView>

      <ThemedView style={styles.section}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Reports & Marketing
        </ThemedText>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <MaterialIcons name="description" size={20} color="#9C27B0" />
            <View style={styles.preferenceInfo}>
              <ThemedText style={styles.preferenceName}>Weekly Report</ThemedText>
              <ThemedText style={styles.preferenceDesc}>Summary of weekly activity</ThemedText>
            </View>
          </View>
          <Switch
            value={preferences.weeklyReport}
            onValueChange={() => togglePreference('weeklyReport')}
            disabled={isSaving}
            trackColor={{ false: '#767577', true: '#81C784' }}
            thumbColor={preferences.weeklyReport ? '#2196F3' : '#f4f3f4'}
          />
        </View>

        <View style={styles.preferenceRow}>
          <View style={styles.preferenceContent}>
            <MaterialIcons name="local-offer" size={20} color="#9C27B0" />
            <View style={styles.preferenceInfo}>
              <ThemedText style={styles.preferenceName}>Promotional Offers</ThemedText>
              <ThemedText style={styles.preferenceDesc}>Special deals and announcements</ThemedText>
            </View>
          </View>
          <Switch
            value={preferences.promotions}
            onValueChange={() => togglePreference('promotions')}
            disabled={isSaving}
            trackColor={{ false: '#767577', true: '#81C784' }}
            thumbColor={preferences.promotions ? '#2196F3' : '#f4f3f4'}
          />
        </View>
      </ThemedView>

      <ThemedView style={styles.infoBox}>
        <MaterialIcons name="info" size={20} color="#2196F3" />
        <ThemedText style={styles.infoText}>
          Changes are saved automatically. You can update these preferences at any time.
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
  },
  section: {
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
    fontSize: 16,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  preferenceRow_last: {
    borderBottomWidth: 0,
  },
  preferenceContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceInfo: {
    flex: 1,
  },
  preferenceName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  preferenceDesc: {
    fontSize: 12,
    color: '#999',
  },
  infoBox: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#1565C0',
    lineHeight: 18,
  },
});
