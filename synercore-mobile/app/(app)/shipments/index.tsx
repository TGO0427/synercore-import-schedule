import React, { useCallback, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusRefresh, useShipments, useNetworkStatus } from '@/hooks';
import { Header, LoadingSpinner, EmptyState, ShipmentCard } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';

export default function ShipmentsScreen() {
  const router = useRouter();
  const [searchText, setSearchText] = useState('');
  const { shipments, isLoading, error, hasMore, refresh, loadMore, setFilter } = useShipments();
  const { isOnline } = useNetworkStatus();

  // Filter shipments based on search text
  const filteredShipments = shipments.filter((shipment: any) =>
    shipment.trackingNumber?.toLowerCase().includes(searchText.toLowerCase()) ||
    shipment.origin?.toLowerCase().includes(searchText.toLowerCase()) ||
    shipment.destination?.toLowerCase().includes(searchText.toLowerCase())
  );

  // Auto-refresh when screen is focused
  useFocusRefresh(() => {
    refresh();
  });

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMore) {
      loadMore();
    }
  }, [isLoading, hasMore, loadMore]);

  const handleShipmentPress = useCallback(
    (shipmentId: string) => {
      router.push(`/(app)/shipments/${shipmentId}`);
    },
    [router]
  );

  const handleFilter = useCallback(() => {
    // Navigate to filter screen (to be implemented)
    router.push('/(app)/shipments/filter');
  }, [router]);

  const renderShipmentCard = ({ item }: any) => (
    <ShipmentCard
      id={item.id}
      trackingNumber={item.trackingNumber}
      status={item.status}
      origin={item.origin}
      destination={item.destination}
      estimatedDelivery={item.estimatedDelivery}
      onPress={() => handleShipmentPress(item.id)}
    />
  );

  const renderFooter = () => {
    if (!isLoading || shipments.length === 0) return null;
    return <LoadingSpinner visible message="Loading more..." />;
  };

  const renderEmpty = () => {
    if (isLoading) {
      return <LoadingSpinner fullScreen visible message="Loading shipments..." />;
    }

    if (error) {
      return (
        <EmptyState
          icon="error"
          title="Failed to Load"
          message={error.message}
          actionLabel="Retry"
          onAction={refresh}
        />
      );
    }

    return (
      <EmptyState
        icon="local-shipping"
        title="No Shipments"
        message="You don't have any shipments yet"
        actionLabel="Refresh"
        onAction={refresh}
      />
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Shipments"
        subtitle={`${filteredShipments.length} of ${shipments.length} total`}
        showBackButton={false}
        rightAction={{
          icon: 'tune',
          onPress: handleFilter,
        }}
      />

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <MaterialIcons name="cloud-off" size={16} color="#F44336" />
          <Text style={styles.offlineText}>You are offline - showing cached data</Text>
        </View>
      )}

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by tracking, origin, or destination..."
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor="#999"
        />
        {searchText !== '' && (
          <TouchableOpacity
            onPress={() => setSearchText('')}
            style={styles.clearButton}
          >
            <MaterialIcons name="close" size={20} color="#666" />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredShipments}
        renderItem={renderShipmentCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && shipments.length > 0}
            onRefresh={refresh}
            colors={['#2196F3']}
            tintColor="#2196F3"
          />
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
  listContent: {
    flexGrow: 1,
    paddingVertical: 8,
  },
  offlineBanner: {
    backgroundColor: '#FFEBEE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F44336',
  },
  offlineText: {
    color: '#F44336',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    gap: 8,
  },
  searchIcon: {
    marginBottom: 0,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
  },
});
