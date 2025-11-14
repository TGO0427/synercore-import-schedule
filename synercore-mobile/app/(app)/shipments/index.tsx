import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Text, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

interface Shipment {
  id: string;
  trackingNumber: string;
  origin: string;
  destination: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  estimatedDelivery: string;
  items: number;
}

export default function ShipmentsScreen() {
  const router = useRouter();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      setIsLoading(true);
      // Simulate API call - replace with real API
      await new Promise((resolve) => setTimeout(resolve, 500));

      const mockShipments: Shipment[] = [
        {
          id: '1',
          trackingNumber: 'SYN-2024-001',
          origin: 'Los Angeles, CA',
          destination: 'New York, NY',
          status: 'in_transit',
          estimatedDelivery: '2024-11-20',
          items: 5,
        },
        {
          id: '2',
          trackingNumber: 'SYN-2024-002',
          origin: 'Chicago, IL',
          destination: 'Boston, MA',
          status: 'delivered',
          estimatedDelivery: '2024-11-15',
          items: 3,
        },
        {
          id: '3',
          trackingNumber: 'SYN-2024-003',
          origin: 'Denver, CO',
          destination: 'Seattle, WA',
          status: 'pending',
          estimatedDelivery: '2024-11-22',
          items: 8,
        },
      ];

      setShipments(mockShipments);
    } catch (error) {
      console.error('Failed to load shipments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadShipments();
    setIsRefreshing(false);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'delivered':
        return '#4CAF50';
      case 'in_transit':
        return '#2196F3';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      default:
        return '#666';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'delivered':
        return 'check-circle';
      case 'in_transit':
        return 'local-shipping';
      case 'pending':
        return 'pending-actions';
      case 'cancelled':
        return 'cancel';
      default:
        return 'info';
    }
  };

  const ShipmentCard = ({ shipment }: { shipment: Shipment }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/(app)/shipments/${shipment.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.trackingInfo}>
          <ThemedText type="subtitle" style={styles.trackingNumber}>
            {shipment.trackingNumber}
          </ThemedText>
          <ThemedText style={styles.cardDate}>{shipment.estimatedDelivery}</ThemedText>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(shipment.status) },
          ]}
        >
          <MaterialIcons
            name={getStatusIcon(shipment.status) as any}
            size={16}
            color="#fff"
          />
          <ThemedText style={styles.statusText}>
            {shipment.status.replace('_', ' ')}
          </ThemedText>
        </View>
      </View>

      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <MaterialIcons name="location-on" size={16} color="#2196F3" />
          <ThemedText style={styles.routeText} numberOfLines={1}>
            {shipment.origin}
          </ThemedText>
        </View>

        <View style={styles.routeLine} />

        <View style={styles.routePoint}>
          <MaterialIcons name="location-on" size={16} color="#4CAF50" />
          <ThemedText style={styles.routeText} numberOfLines={1}>
            {shipment.destination}
          </ThemedText>
        </View>
      </View>

      <View style={styles.itemsContainer}>
        <MaterialIcons name="inventory-2" size={16} color="#999" />
        <ThemedText style={styles.itemsText}>{shipment.items} items</ThemedText>
      </View>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={shipments}
        renderItem={({ item }) => <ShipmentCard shipment={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inbox" size={64} color="#ccc" />
            <ThemedText style={styles.emptyText}>No shipments found</ThemedText>
          </View>
        }
      />
    </View>
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
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  trackingInfo: {
    flex: 1,
  },
  trackingNumber: {
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  routeContainer: {
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
  },
  routeText: {
    flex: 1,
    fontSize: 13,
  },
  routeLine: {
    height: 16,
    width: 2,
    backgroundColor: '#ddd',
    marginLeft: 7,
    marginVertical: 2,
  },
  itemsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  itemsText: {
    fontSize: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: '#ccc',
  },
});
