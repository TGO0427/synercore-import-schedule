import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

interface ShipmentDetail {
  id: string;
  trackingNumber: string;
  origin: string;
  originAddress: string;
  destination: string;
  destinationAddress: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  estimatedDelivery: string;
  actualDelivery?: string;
  items: number;
  weight: string;
  carrier: string;
  createdDate: string;
  timeline: Array<{
    status: string;
    timestamp: string;
    location: string;
  }>;
}

export default function ShipmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadShipmentDetail();
  }, [id]);

  const loadShipmentDetail = async () => {
    try {
      setIsLoading(true);
      // Simulate API call - replace with real API
      await new Promise((resolve) => setTimeout(resolve, 500));

      const mockShipment: ShipmentDetail = {
        id: id as string,
        trackingNumber: 'SYN-2024-001',
        origin: 'Los Angeles, CA',
        originAddress: '123 West Ave, Los Angeles, CA 90001',
        destination: 'New York, NY',
        destinationAddress: '456 East St, New York, NY 10001',
        status: 'in_transit',
        estimatedDelivery: '2024-11-20',
        items: 5,
        weight: '25.5 lbs',
        carrier: 'DHL Express',
        createdDate: '2024-11-10',
        timeline: [
          {
            status: 'Package picked up',
            timestamp: '2024-11-10 09:00 AM',
            location: 'Los Angeles, CA',
          },
          {
            status: 'In transit',
            timestamp: '2024-11-15 02:30 PM',
            location: 'Chicago, IL',
          },
          {
            status: 'Out for delivery',
            timestamp: '2024-11-18 08:00 AM',
            location: 'New York, NY',
          },
        ],
      };

      setShipment(mockShipment);
    } catch (error) {
      console.error('Failed to load shipment details:', error);
    } finally {
      setIsLoading(false);
    }
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

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={styles.centerContainer}>
        <ThemedText>Shipment not found</ThemedText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={28} color="#2196F3" />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Shipment Details
        </ThemedText>
        <View style={{ width: 28 }} />
      </View>

      <ThemedView style={styles.trackingCard}>
        <ThemedText type="subtitle">{shipment.trackingNumber}</ThemedText>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(shipment.status) },
          ]}
        >
          <MaterialIcons name="check-circle" size={16} color="#fff" />
          <Text style={styles.statusText}>{shipment.status.replace('_', ' ')}</Text>
        </View>
      </ThemedView>

      <ThemedView style={styles.infoSection}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Route Information
        </ThemedText>

        <View style={styles.routeInfo}>
          <View style={styles.routePoint}>
            <MaterialIcons name="location-on" size={20} color="#2196F3" />
            <View style={styles.routePointText}>
              <ThemedText style={styles.label}>From</ThemedText>
              <ThemedText style={styles.value}>{shipment.origin}</ThemedText>
              <ThemedText style={styles.address}>{shipment.originAddress}</ThemedText>
            </View>
          </View>

          <View style={styles.routeDivider}>
            <View style={styles.routeDividerLine} />
            <MaterialIcons name="arrow-downward" size={20} color="#999" />
            <View style={styles.routeDividerLine} />
          </View>

          <View style={styles.routePoint}>
            <MaterialIcons name="location-on" size={20} color="#4CAF50" />
            <View style={styles.routePointText}>
              <ThemedText style={styles.label}>To</ThemedText>
              <ThemedText style={styles.value}>{shipment.destination}</ThemedText>
              <ThemedText style={styles.address}>{shipment.destinationAddress}</ThemedText>
            </View>
          </View>
        </View>
      </ThemedView>

      <ThemedView style={styles.infoSection}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Shipping Details
        </ThemedText>

        <View style={styles.detailRow}>
          <MaterialIcons name="local-shipping" size={20} color="#2196F3" />
          <View style={styles.detailContent}>
            <ThemedText style={styles.label}>Carrier</ThemedText>
            <ThemedText style={styles.value}>{shipment.carrier}</ThemedText>
          </View>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name="inventory-2" size={20} color="#FF9800" />
          <View style={styles.detailContent}>
            <ThemedText style={styles.label}>Items</ThemedText>
            <ThemedText style={styles.value}>{shipment.items} items</ThemedText>
          </View>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name="scale" size={20} color="#9C27B0" />
          <View style={styles.detailContent}>
            <ThemedText style={styles.label}>Weight</ThemedText>
            <ThemedText style={styles.value}>{shipment.weight}</ThemedText>
          </View>
        </View>

        <View style={styles.detailRow}>
          <MaterialIcons name="calendar-today" size={20} color="#4CAF50" />
          <View style={styles.detailContent}>
            <ThemedText style={styles.label}>Est. Delivery</ThemedText>
            <ThemedText style={styles.value}>{shipment.estimatedDelivery}</ThemedText>
          </View>
        </View>
      </ThemedView>

      <ThemedView style={styles.infoSection}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Tracking Timeline
        </ThemedText>

        {shipment.timeline.map((event, index) => (
          <View key={index} style={styles.timelineEvent}>
            <View style={styles.timelineMarker}>
              <View style={styles.timelineDot} />
              {index < shipment.timeline.length - 1 && <View style={styles.timelineLine} />}
            </View>
            <View style={styles.timelineContent}>
              <ThemedText type="subtitle" style={styles.eventStatus}>
                {event.status}
              </ThemedText>
              <ThemedText style={styles.eventTime}>{event.timestamp}</ThemedText>
              <ThemedText style={styles.eventLocation}>{event.location}</ThemedText>
            </View>
          </View>
        ))}
      </ThemedView>

      <TouchableOpacity
        style={styles.actionButton}
        onPress={() => console.log('View more details')}
      >
        <MaterialIcons name="edit" size={20} color="#fff" />
        <Text style={styles.actionButtonText}>Update Shipment</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  trackingCard: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
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
  sectionTitle: {
    marginBottom: 16,
  },
  routeInfo: {
    gap: 16,
  },
  routePoint: {
    flexDirection: 'row',
    gap: 12,
  },
  routePointText: {
    flex: 1,
  },
  routeDivider: {
    alignItems: 'center',
    gap: 8,
  },
  routeDividerLine: {
    height: 12,
    width: 2,
    backgroundColor: '#ddd',
  },
  detailRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  detailContent: {
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
  address: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  timelineEvent: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  timelineMarker: {
    alignItems: 'center',
    width: 30,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2196F3',
  },
  timelineLine: {
    width: 2,
    height: 40,
    backgroundColor: '#ddd',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  eventStatus: {
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 12,
    color: '#666',
  },
  actionButton: {
    backgroundColor: '#2196F3',
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
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
