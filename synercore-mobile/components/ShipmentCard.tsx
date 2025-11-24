import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface Shipment {
  id: string;
  orderRef: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'cancelled';
  supplier: string;
  destination: string;
  weight: number;
  estimatedDelivery: string;
  updatedAt: string;
}

interface ShipmentCardProps {
  shipment: Shipment;
  onPress?: () => void;
  onStatusPress?: () => void;
  variant?: 'default' | 'compact' | 'expanded';
  showActions?: boolean;
}

const statusColors = {
  pending: '#FFA500',
  in_transit: '#2196F3',
  delivered: '#4CAF50',
  cancelled: '#F44336',
};

const statusLabels = {
  pending: 'Pending',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function ShipmentCard({
  shipment,
  onPress,
  onStatusPress,
  variant = 'default',
  showActions = true,
}: ShipmentCardProps) {
  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[styles.card, styles.compactCard]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.compactHeader}>
          <Text style={styles.orderRef}>{shipment.orderRef}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors[shipment.status] },
            ]}
          >
            <Text style={styles.statusText}>{statusLabels[shipment.status]}</Text>
          </View>
        </View>
        <Text style={styles.supplier}>{shipment.supplier}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'expanded') {
    return (
      <TouchableOpacity
        style={[styles.card, styles.expandedCard]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.expandedHeader}>
          <View>
            <Text style={styles.orderRef}>{shipment.orderRef}</Text>
            <Text style={styles.supplier}>{shipment.supplier}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.statusBadge,
              { backgroundColor: statusColors[shipment.status] },
            ]}
            onPress={onStatusPress}
          >
            <Text style={styles.statusText}>{statusLabels[shipment.status]}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <MaterialIcons name="local-shipping" size={20} color="#666" />
            <Text style={styles.gridLabel}>Destination</Text>
            <Text style={styles.gridValue}>{shipment.destination}</Text>
          </View>
          <View style={styles.gridItem}>
            <MaterialIcons name="weight" size={20} color="#666" />
            <Text style={styles.gridLabel}>Weight</Text>
            <Text style={styles.gridValue}>{shipment.weight} kg</Text>
          </View>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridItem}>
            <MaterialIcons name="calendar-today" size={20} color="#666" />
            <Text style={styles.gridLabel}>Est. Delivery</Text>
            <Text style={styles.gridValue}>{formatDate(shipment.estimatedDelivery)}</Text>
          </View>
          <View style={styles.gridItem}>
            <MaterialIcons name="update" size={20} color="#666" />
            <Text style={styles.gridLabel}>Last Updated</Text>
            <Text style={styles.gridValue}>{formatTime(shipment.updatedAt)}</Text>
          </View>
        </View>

        {showActions && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={onPress}>
              <MaterialIcons name="visibility" size={18} color="#2196F3" />
              <Text style={styles.actionText}>View Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={onStatusPress}>
              <MaterialIcons name="edit" size={18} color="#FF9800" />
              <Text style={styles.actionText}>Update Status</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Default variant
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.orderRef}>{shipment.orderRef}</Text>
          <Text style={styles.supplier}>{shipment.supplier}</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusColors[shipment.status] },
          ]}
        >
          <Text style={styles.statusText}>{statusLabels[shipment.status]}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.row}>
          <MaterialIcons name="location-on" size={16} color="#666" />
          <Text style={styles.text}>{shipment.destination}</Text>
        </View>
        <View style={styles.row}>
          <MaterialIcons name="calendar-today" size={16} color="#666" />
          <Text style={styles.text}>{formatDate(shipment.estimatedDelivery)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 12,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  compactCard: {
    paddingVertical: 12,
  },
  expandedCard: {
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderRef: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  supplier: {
    fontSize: 14,
    color: '#666',
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    fontSize: 14,
    color: '#555',
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  gridLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  gridValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
    gap: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
});

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
