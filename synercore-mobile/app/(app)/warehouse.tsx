import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { apiService } from '@/services';

interface WarehouseStats {
  totalCapacity: number;
  usedCapacity: number;
  availableCapacity: number;
  occupancyRate: number;
  zones: Array<{
    name: string;
    capacity: number;
    used: number;
    status: 'optimal' | 'warning' | 'critical';
  }>;
}

export default function WarehouseScreen() {
  const [stats, setStats] = useState<WarehouseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadWarehouseStats();
  }, []);

  const loadWarehouseStats = async () => {
    try {
      setIsLoading(true);
      console.log('🏭 Fetching warehouse stats from API...');

      // Call real API to get warehouse status
      const response = await apiService.getWarehouseStatus();
      console.log('✅ Warehouse stats loaded:', response);

      if (response && response.data) {
        const data = response.data;
        const stats: WarehouseStats = {
          totalCapacity: data.total_capacity || data.totalCapacity || 0,
          usedCapacity: data.used_capacity || data.usedCapacity || 0,
          availableCapacity: data.available_capacity || data.availableCapacity || 0,
          occupancyRate: data.occupancy_rate || data.occupancyRate || 0,
          zones: (data.zones || []).map((zone: any) => ({
            name: zone.name || zone.zone_name,
            capacity: zone.capacity || zone.total_capacity,
            used: zone.used || zone.used_capacity,
            status: zone.status || 'optimal',
          })),
        };
        setStats(stats);
      } else {
        console.warn('⚠️ No warehouse data returned from API');
      }
    } catch (error) {
      console.error('❌ Failed to load warehouse stats:', error);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  const getZoneStatusColor = (status: string): string => {
    switch (status) {
      case 'optimal':
        return '#4CAF50';
      case 'warning':
        return '#FF9800';
      case 'critical':
        return '#F44336';
      default:
        return '#666';
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!stats) {
    return (
      <View style={styles.centerContainer}>
        <ThemedText>Unable to load warehouse data</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.summaryCard}>
        <ThemedText type="subtitle" style={styles.cardTitle}>
          Overall Capacity
        </ThemedText>

        <View style={styles.capacityMetrics}>
          <View style={styles.metric}>
            <MaterialIcons name="storage" size={28} color="#2196F3" />
            <ThemedText style={styles.metricLabel}>Total</ThemedText>
            <ThemedText style={styles.metricValue}>{stats.totalCapacity} units</ThemedText>
          </View>

          <View style={styles.metric}>
            <MaterialIcons name="inventory-2" size={28} color="#FF9800" />
            <ThemedText style={styles.metricLabel}>Used</ThemedText>
            <ThemedText style={styles.metricValue}>{stats.usedCapacity} units</ThemedText>
          </View>

          <View style={styles.metric}>
            <MaterialIcons name="space-dashboard" size={28} color="#4CAF50" />
            <ThemedText style={styles.metricLabel}>Available</ThemedText>
            <ThemedText style={styles.metricValue}>{stats.availableCapacity} units</ThemedText>
          </View>
        </View>

        <View style={styles.occupancyContainer}>
          <View style={styles.occupancyLabel}>
            <ThemedText style={styles.occupancyText}>Occupancy Rate</ThemedText>
            <ThemedText style={styles.occupancyRate}>{stats.occupancyRate}%</ThemedText>
          </View>
          <View style={styles.occupancyBar}>
            <View
              style={[
                styles.occupancyFill,
                { width: `${stats.occupancyRate}%` },
              ]}
            />
          </View>
        </View>
      </ThemedView>

      <ThemedView style={styles.zonesContainer}>
        <ThemedText type="subtitle" style={styles.cardTitle}>
          Zone Details
        </ThemedText>

        {stats.zones.map((zone, index) => {
          const occupancy = (zone.used / zone.capacity) * 100;
          return (
            <View key={index} style={styles.zoneCard}>
              <View style={styles.zoneHeader}>
                <View style={styles.zoneInfo}>
                  <ThemedText style={styles.zoneName}>{zone.name}</ThemedText>
                  <ThemedText style={styles.zoneCapacity}>
                    {zone.used} / {zone.capacity} units
                  </ThemedText>
                </View>
                <View
                  style={[
                    styles.zoneBadge,
                    { backgroundColor: getZoneStatusColor(zone.status) },
                  ]}
                >
                  <ThemedText style={styles.zoneBadgeText}>{zone.status}</ThemedText>
                </View>
              </View>

              <View style={styles.zoneProgressBar}>
                <View
                  style={[
                    styles.zoneProgressFill,
                    {
                      width: `${occupancy}%`,
                      backgroundColor: getZoneStatusColor(zone.status),
                    },
                  ]}
                />
              </View>
              <ThemedText style={styles.occupancyPercent}>{occupancy.toFixed(0)}% Full</ThemedText>
            </View>
          );
        })}
      </ThemedView>

      <ThemedView style={styles.alertsContainer}>
        <ThemedText type="subtitle" style={styles.cardTitle}>
          Alerts
        </ThemedText>

        <View style={styles.alertItem}>
          <MaterialIcons name="warning" size={20} color="#FF9800" />
          <View style={styles.alertContent}>
            <ThemedText style={styles.alertTitle}>Zone B Near Capacity</ThemedText>
            <ThemedText style={styles.alertText}>80% occupied - Consider reorganizing</ThemedText>
          </View>
        </View>
      </ThemedView>
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
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardTitle: {
    marginBottom: 16,
  },
  capacityMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  metricLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 8,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  occupancyContainer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  occupancyLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  occupancyText: {
    fontSize: 14,
    fontWeight: '500',
  },
  occupancyRate: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2196F3',
  },
  occupancyBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  occupancyFill: {
    height: '100%',
    backgroundColor: '#2196F3',
  },
  zonesContainer: {
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
  zoneCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  zoneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  zoneCapacity: {
    fontSize: 12,
    color: '#666',
  },
  zoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  zoneBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  zoneProgressBar: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  zoneProgressFill: {
    height: '100%',
  },
  occupancyPercent: {
    fontSize: 11,
    color: '#999',
    textAlign: 'right',
  },
  alertsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  alertItem: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: '#fff3e0',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 12,
    color: '#666',
  },
});
