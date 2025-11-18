import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Text,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSingleShipment, useFocusRefresh } from '@/hooks';
import { Header, LoadingSpinner, Button, FormInput, StatusBadge, ModalHeader } from '@/components';
import { MaterialIcons } from '@expo/vector-icons';

const STATUS_OPTIONS = ['pending', 'in_transit', 'out_for_delivery', 'delivered', 'failed'];

export default function ShipmentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { shipment, isLoading, error, isUpdating, updateError, refresh } = useSingleShipment(
    id || ''
  );

  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedStatusError, setSelectedStatusError] = useState('');

  // Auto-refresh when screen is focused
  useFocusRefresh(() => {
    refresh();
  });

  const handleUpdateStatus = useCallback(async () => {
    if (!newStatus) {
      setSelectedStatusError('Please select a status');
      return;
    }

    try {
      await updateError ? null : updateError;
      await updateStatus(newStatus, notes);
      setShowUpdateModal(false);
      setNewStatus('');
      setNotes('');
      setSelectedStatusError('');
      Alert.alert('Success', 'Shipment status updated successfully');
    } catch (err) {
      Alert.alert('Error', 'Failed to update shipment status');
    }
  }, [newStatus, notes, updateStatus, updateError]);

  if (!id) {
    return (
      <View style={styles.container}>
        <Header title="Shipment" showBackButton />
        <LoadingSpinner fullScreen visible message="Loading..." />
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Header title="Shipment" showBackButton />
        <LoadingSpinner fullScreen visible message="Loading shipment details..." />
      </View>
    );
  }

  if (error || !shipment) {
    return (
      <View style={styles.container}>
        <Header title="Shipment" showBackButton />
        <View style={styles.centerContent}>
          <MaterialIcons name="error" size={64} color="#F44336" />
          <Text style={styles.errorTitle}>Failed to Load Shipment</Text>
          <Text style={styles.errorMessage}>{error?.message || 'Shipment not found'}</Text>
          <Button title="Retry" onPress={refresh} variant="primary" />
        </View>
      </View>
    );
  }

  const { updateStatus } = useSingleShipment(id);

  return (
    <View style={styles.container}>
      <Header
        title="Shipment Details"
        showBackButton
        rightAction={{
          icon: 'refresh',
          onPress: refresh,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tracking Number Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.label}>Tracking Number</Text>
              <Text style={styles.trackingNumber}>{shipment.trackingNumber}</Text>
            </View>
            <StatusBadge status={shipment.status} size="medium" />
          </View>
        </View>

        {/* Route Information */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Route Information</Text>

          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={24} color="#2196F3" />
            <View style={styles.locationInfo}>
              <Text style={styles.label}>From</Text>
              <Text style={styles.locationName}>{shipment.origin}</Text>
              {shipment.originAddress && (
                <Text style={styles.locationAddress}>{shipment.originAddress}</Text>
              )}
            </View>
          </View>

          <View style={styles.routeDivider}>
            <MaterialIcons name="arrow-downward" size={24} color="#999" />
          </View>

          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={24} color="#4CAF50" />
            <View style={styles.locationInfo}>
              <Text style={styles.label}>To</Text>
              <Text style={styles.locationName}>{shipment.destination}</Text>
              {shipment.destinationAddress && (
                <Text style={styles.locationAddress}>{shipment.destinationAddress}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Shipment Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Details</Text>

          <DetailRow
            icon="calendar-today"
            label="Estimated Delivery"
            value={shipment.estimatedDelivery}
          />

          <DetailRow icon="inventory-2" label="Weight" value={`${shipment.weight} lbs`} />

          {shipment.dimensions && (
            <DetailRow
              icon="straighten"
              label="Dimensions"
              value={`${shipment.dimensions.length} x ${shipment.dimensions.width} x ${shipment.dimensions.height} cm`}
            />
          )}

          {shipment.lastUpdate && (
            <DetailRow icon="access-time" label="Last Update" value={shipment.lastUpdate} />
          )}
        </View>

        {/* Timeline */}
        {shipment.timeline && shipment.timeline.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Timeline</Text>

            {shipment.timeline.map((event, index) => (
              <View key={event.id} style={styles.timelineEvent}>
                <View style={styles.timelineMarker}>
                  <View
                    style={[
                      styles.timelineCircle,
                      {
                        backgroundColor:
                          event.status === 'delivered'
                            ? '#4CAF50'
                            : event.status === 'failed'
                              ? '#F44336'
                              : '#2196F3',
                      },
                    ]}
                  />
                  {index < shipment.timeline.length - 1 && <View style={styles.timelineLine} />}
                </View>

                <View style={styles.timelineContent}>
                  <Text style={styles.timelineStatus}>{event.description}</Text>
                  <Text style={styles.timelineDate}>
                    {event.date} at {event.time}
                  </Text>
                  <Text style={styles.timelineLocation}>{event.location}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Documents */}
        {shipment.documents && shipment.documents.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Documents</Text>

            {shipment.documents.map((doc) => (
              <TouchableOpacity key={doc.id} style={styles.documentItem}>
                <MaterialIcons name="description" size={24} color="#2196F3" />
                <View style={styles.documentInfo}>
                  <Text style={styles.documentName}>{doc.name}</Text>
                  <Text style={styles.documentType}>{doc.type}</Text>
                </View>
                <MaterialIcons name="download" size={20} color="#2196F3" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Update Status Button */}
        <Button
          title="Update Status"
          onPress={() => setShowUpdateModal(true)}
          variant="primary"
          style={styles.updateButton}
        />
      </ScrollView>

      {/* Update Status Modal */}
      <Modal visible={showUpdateModal} animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modal}
        >
          <ModalHeader
            title="Update Status"
            onClose={() => {
              setShowUpdateModal(false);
              setNewStatus('');
              setNotes('');
              setSelectedStatusError('');
            }}
            rightAction={{
              label: 'Save',
              onPress: handleUpdateStatus,
              disabled: isUpdating,
            }}
          />

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Status Selection */}
            <View style={styles.modalSection}>
              <Text style={styles.modalLabel}>Select New Status *</Text>
              {selectedStatusError && (
                <Text style={styles.errorText}>{selectedStatusError}</Text>
              )}

              <View style={styles.statusGrid}>
                {STATUS_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.statusOption,
                      newStatus === option && styles.statusOptionSelected,
                    ]}
                    onPress={() => {
                      setNewStatus(option);
                      setSelectedStatusError('');
                    }}
                  >
                    <View
                      style={[
                        styles.statusOptionCircle,
                        newStatus === option && styles.statusOptionCircleSelected,
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusOptionText,
                        newStatus === option && styles.statusOptionTextSelected,
                      ]}
                    >
                      {option.replace(/_/g, ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.modalSection}>
              <FormInput
                label="Notes (Optional)"
                placeholder="Add any notes about this update..."
                value={notes}
                onChangeText={setNotes}
                icon="note"
                multiline
                numberOfLines={4}
                containerStyle={styles.notesInput}
              />
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowUpdateModal(false);
                  setNewStatus('');
                  setNotes('');
                  setSelectedStatusError('');
                }}
                variant="outline"
                disabled={isUpdating}
              />
              <Button
                title={isUpdating ? 'Updating...' : 'Update Status'}
                onPress={handleUpdateStatus}
                variant="primary"
                loading={isUpdating}
                disabled={isUpdating}
              />
            </View>

            {updateError && (
              <View style={styles.updateErrorBanner}>
                <MaterialIcons name="error" size={16} color="#F44336" />
                <Text style={styles.updateErrorText}>{updateError.message}</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

interface DetailRowProps {
  icon: string;
  label: string;
  value: string;
}

function DetailRow({ icon, label, value }: DetailRowProps) {
  return (
    <View style={styles.detailRow}>
      <MaterialIcons name={icon as any} size={20} color="#999" style={styles.detailIcon} />
      <View style={styles.detailContent}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  label: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    marginBottom: 4,
  },
  trackingNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  locationAddress: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  routeDivider: {
    alignItems: 'center',
    marginVertical: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailIcon: {
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  timelineEvent: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineMarker: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#fff',
  },
  timelineLine: {
    width: 2,
    height: 40,
    backgroundColor: '#ddd',
    marginTop: 8,
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineStatus: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  timelineDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  timelineLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  documentType: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  updateButton: {
    marginBottom: 24,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  modal: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  modalSection: {
    marginBottom: 24,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statusOption: {
    flex: 1,
    minWidth: '48%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
  },
  statusOptionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  statusOptionCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  statusOptionCircleSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#2196F3',
  },
  statusOptionText: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
    textAlign: 'center',
  },
  statusOptionTextSelected: {
    color: '#2196F3',
    fontWeight: '600',
  },
  notesInput: {
    marginBottom: 0,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 32,
  },
  updateErrorBanner: {
    backgroundColor: '#FFEBEE',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 6,
    gap: 8,
    marginTop: 16,
  },
  updateErrorText: {
    color: '#C62828',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  errorText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
});
