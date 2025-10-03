import React, { useState, useEffect } from 'react';
import { ShipmentStatus, InspectionStatus, ReceivingStatus } from '../types/shipment';
import { getApiUrl } from '../config/api';

function PostArrivalWorkflow() {
  const [postArrivalShipments, setPostArrivalShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [showWorkflowDialog, setShowWorkflowDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [workflowData, setWorkflowData] = useState({
    inspectedBy: '',
    inspectionNotes: '',
    inspectionPassed: true,
    inspectionOnHold: false,
    holdTypes: [],
    inspectionFailed: false,
    failureReasons: [],
    receivedBy: '',
    receivingNotes: '',
    receivedQuantity: '',
    discrepancies: []
  });

  useEffect(() => {
    fetchPostArrivalShipments();
  }, []);

  const fetchPostArrivalShipments = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/shipments/post-arrival'));
      if (response.ok) {
        const shipments = await response.json();
        setPostArrivalShipments(shipments);
      } else {
        console.error('Failed to fetch post-arrival shipments');
      }
    } catch (error) {
      console.error('Error fetching post-arrival shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'arrived_pta': '#28a745',
      'arrived_klm': '#28a745',
      'unloading': '#fd7e14',
      'inspection_pending': '#ffc107',
      'inspecting': '#17a2b8',
      'inspection_failed': '#dc3545',
      'inspection_passed': '#28a745',
      'receiving': '#6f42c1',
      'received': '#20c997',
      'stored': '#6c757d'
    };
    return colors[status] || '#6c757d';
  };

  const getStatusIcon = (status) => {
    const icons = {
      'arrived_pta': '🚚',
      'arrived_klm': '🚚',
      'unloading': '📦',
      'inspection_pending': '⏳',
      'inspecting': '🔍',
      'inspection_failed': '❌',
      'inspection_passed': '✅',
      'receiving': '📋',
      'received': '✔️',
      'stored': '🏪'
    };
    return icons[status] || '📄';
  };

  const getStatusLabel = (status) => {
    const labels = {
      'arrived_pta': 'Arrived PTA',
      'arrived_klm': 'Arrived KLM',
      'unloading': 'Unloading',
      'inspection_pending': 'Inspection Pending',
      'inspecting': 'Inspecting',
      'inspection_failed': 'Inspection Failed',
      'inspection_passed': 'Inspection Passed',
      'receiving': 'Receiving',
      'received': 'Received',
      'stored': 'Stored'
    };
    return labels[status] || status;
  };

  const getAvailableActions = (shipment) => {
    const actions = [];
    const status = shipment.latestStatus;

    if (status === 'arrived_pta' || status === 'arrived_klm') {
      actions.push({ key: 'start-unloading', label: 'Start Unloading', icon: '📦', color: '#fd7e14' });
    } else if (status === 'unloading') {
      actions.push({ key: 'complete-unloading', label: 'Complete Unloading', icon: '✅', color: '#28a745' });
    } else if (status === 'inspection_pending') {
      actions.push({ key: 'start-inspection', label: 'Start Inspection', icon: '🔍', color: '#17a2b8' });
    } else if (status === 'inspecting') {
      actions.push({ key: 'complete-inspection', label: 'Complete Inspection', icon: '✅', color: '#28a745' });
    } else if (status === 'inspection_passed') {
      actions.push({ key: 'start-receiving', label: 'Start Receiving', icon: '📋', color: '#6f42c1' });
    } else if (status === 'inspection_failed') {
      actions.push({ key: 'start-inspection', label: 'Re-inspect', icon: '🔍', color: '#17a2b8' });
    } else if (status === 'receiving') {
      actions.push({ key: 'complete-receiving', label: 'Complete Receiving', icon: '✔️', color: '#20c997' });
    } else if (status === 'received') {
      actions.push({ key: 'mark-stored', label: 'Mark as Stored', icon: '🏪', color: '#6c757d' });
    }

    // Always add the ability to amend status (revert to shipping schedule)
    actions.push({ key: 'amend-status', label: 'Amend Status', icon: '🔄', color: '#dc3545' });

    return actions;
  };

  const performWorkflowAction = async (shipment, action) => {
    if (action === 'complete-inspection' || action === 'start-inspection' ||
        action === 'complete-receiving' || action === 'start-receiving') {
      setSelectedShipment(shipment);
      setWorkflowData({
        ...workflowData,
        receivedQuantity: shipment.quantity || ''
      });
      setShowWorkflowDialog(true);
      return;
    }

    if (action === 'mark-stored') {
      try {
        setActionLoading(true);
        const response = await fetch(getApiUrl(`/api/shipments/${shipment.id}`), {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            latestStatus: 'stored',
            storedDate: new Date().toISOString()
          })
        });

        if (response.ok) {
          await fetchPostArrivalShipments();
        } else {
          const error = await response.json();
          alert(`Error: ${error.error}`);
        }
      } catch (error) {
        console.error('Error marking shipment as stored:', error);
        alert('Error marking shipment as stored. Please try again.');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (action === 'amend-status') {
      const confirmMessage = `Are you sure you want to amend the status for shipment ${shipment.orderRef}?\n\nThis will revert it back to "In Transit" status and remove it from the Post-Arrival Workflow, making it appear in the Shipping Schedule again.`;

      if (confirm(confirmMessage)) {
        try {
          setActionLoading(true);
          const response = await fetch(getApiUrl(`/api/shipments/${shipment.id}`), {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              latestStatus: 'in_transit_seaway', // Revert to shipping status
              // Reset workflow fields
              inspectionStatus: 'not_started',
              receivingStatus: 'not_started',
              inspectionNotes: '',
              receivingNotes: '',
              inspectedBy: '',
              receivedBy: '',
              inspectionDate: null,
              receivingDate: null,
              receivedQuantity: null,
              discrepancies: [],
              unloadingStartDate: null,
              unloadingCompletedDate: null
            })
          });

          if (response.ok) {
            alert(`Shipment ${shipment.orderRef} has been reverted to shipping status and will now appear in the Shipping Schedule.`);
            await fetchPostArrivalShipments();
          } else {
            const error = await response.json();
            alert(`Error: ${error.error}`);
          }
        } catch (error) {
          console.error('Error amending shipment status:', error);
          alert('Error amending shipment status. Please try again.');
        } finally {
          setActionLoading(false);
        }
      }
      return;
    }

    try {
      setActionLoading(true);
      const endpoint = `/api/shipments/${shipment.id}/${action.replace('_', '-')}`;

      const response = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        await fetchPostArrivalShipments();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error performing workflow action:', error);
      alert('Error performing action. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const submitWorkflowAction = async (action) => {
    try {
      setActionLoading(true);
      const endpoint = `/api/shipments/${selectedShipment.id}/${action.replace('_', '-')}`;

      let requestBody = {};

      if (action === 'start-inspection') {
        requestBody = {
          inspectedBy: workflowData.inspectedBy
        };
      } else if (action === 'complete-inspection') {
        requestBody = {
          passed: workflowData.inspectionPassed && !workflowData.inspectionOnHold && !workflowData.inspectionFailed,
          onHold: workflowData.inspectionOnHold,
          holdTypes: workflowData.holdTypes,
          failed: workflowData.inspectionFailed,
          failureReasons: workflowData.failureReasons,
          notes: workflowData.inspectionNotes,
          inspectedBy: workflowData.inspectedBy
        };
      } else if (action === 'start-receiving') {
        requestBody = {
          receivedBy: workflowData.receivedBy
        };
      } else if (action === 'complete-receiving') {
        requestBody = {
          receivedQuantity: parseInt(workflowData.receivedQuantity) || 0,
          notes: workflowData.receivingNotes,
          receivedBy: workflowData.receivedBy,
          discrepancies: workflowData.discrepancies
        };
      }

      const response = await fetch(getApiUrl(endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        setShowWorkflowDialog(false);
        setSelectedShipment(null);
        setWorkflowData({
          inspectedBy: '',
          inspectionNotes: '',
          inspectionPassed: true,
          inspectionOnHold: false,
          holdTypes: [],
          inspectionFailed: false,
          failureReasons: [],
          receivedBy: '',
          receivingNotes: '',
          receivedQuantity: '',
          discrepancies: []
        });
        await fetchPostArrivalShipments();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting workflow action:', error);
      alert('Error performing action. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getWorkflowProgress = (shipment) => {
    const states = [
      'arrived_pta', 'arrived_klm', 'unloading', 'inspection_pending', 'inspecting',
      'inspection_passed', 'receiving', 'received', 'stored'
    ];

    const currentIndex = states.indexOf(shipment.latestStatus);
    const percentage = Math.round(((currentIndex + 1) / states.length) * 100);

    return {
      currentStep: currentIndex + 1,
      totalSteps: states.length,
      percentage: percentage
    };
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div>Loading post-arrival workflow...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
          📋 Post-Arrival Workflow Management
        </h2>
        <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
          Manage shipments through the post-arrival workflow: unloading → inspection → receiving → storage
        </p>
      </div>

      {postArrivalShipments.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '2px dashed #dee2e6'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: '#6c757d' }}>No Shipments in Post-Arrival Workflow</h3>
          <p style={{ margin: 0, color: '#6c757d' }}>
            Shipments will appear here once they reach "ARRIVED" status.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {postArrivalShipments.map((shipment) => {
            const progress = getWorkflowProgress(shipment);
            const actions = getAvailableActions(shipment);

            return (
              <div key={shipment.id} style={{
                backgroundColor: 'white',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                padding: '1.5rem',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                      {shipment.supplier} - {shipment.orderRef}
                    </h4>
                    <div style={{ color: '#666', fontSize: '0.9rem' }}>
                      📍 {shipment.finalPod} | 📦 {shipment.quantity} units | 🏭 {shipment.receivingWarehouse}
                    </div>
                  </div>

                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: getStatusColor(shipment.latestStatus),
                    color: 'white',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '600'
                  }}>
                    <span>{getStatusIcon(shipment.latestStatus)}</span>
                    {getStatusLabel(shipment.latestStatus)}
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#666' }}>
                      Progress: Step {progress.currentStep} of {progress.totalSteps}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: '600' }}>
                      {progress.percentage}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#e9ecef',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${progress.percentage}%`,
                      height: '100%',
                      backgroundColor: getStatusColor(shipment.latestStatus),
                      borderRadius: '4px',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>

                {/* Workflow Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                  {shipment.unloadingStartDate && (
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                      🚚 <strong>Unloading Started:</strong><br />
                      {new Date(shipment.unloadingStartDate).toLocaleString()}
                    </div>
                  )}
                  {shipment.inspectionDate && (
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                      🔍 <strong>Inspection:</strong><br />
                      {shipment.inspectedBy} ({new Date(shipment.inspectionDate).toLocaleDateString()})
                    </div>
                  )}
                  {shipment.receivingDate && (
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                      📋 <strong>Receiving:</strong><br />
                      {shipment.receivedBy} ({new Date(shipment.receivingDate).toLocaleDateString()})
                    </div>
                  )}
                  {shipment.receivedQuantity !== null && shipment.receivedQuantity !== undefined && (
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                      📦 <strong>Received:</strong><br />
                      {shipment.receivedQuantity} / {shipment.quantity} units
                    </div>
                  )}
                </div>

                {/* Notes */}
                {(shipment.inspectionNotes || shipment.receivingNotes) && (
                  <div style={{ marginBottom: '1rem' }}>
                    {shipment.inspectionNotes && (
                      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem' }}>
                        <strong>Inspection Notes:</strong> {shipment.inspectionNotes}
                      </div>
                    )}
                    {shipment.receivingNotes && (
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>
                        <strong>Receiving Notes:</strong> {shipment.receivingNotes}
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {actions.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {actions.map((action) => (
                      <button
                        key={action.key}
                        onClick={() => performWorkflowAction(shipment, action.key)}
                        disabled={actionLoading}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: action.color,
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: actionLoading ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: '500',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          opacity: actionLoading ? 0.6 : 1
                        }}
                      >
                        <span>{action.icon}</span>
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Workflow Dialog */}
      {showWorkflowDialog && selectedShipment && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>
                {selectedShipment.latestStatus === 'inspection_pending' || selectedShipment.latestStatus === 'inspecting' ? '🔍 Inspection Details' : '📋 Receiving Details'}
              </h3>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>
                {selectedShipment.supplier} - {selectedShipment.orderRef}
              </div>
            </div>

            {(selectedShipment.latestStatus === 'inspection_pending' || selectedShipment.latestStatus === 'inspecting') ? (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                    Inspector Name
                  </label>
                  <input
                    type="text"
                    value={workflowData.inspectedBy}
                    onChange={(e) => setWorkflowData({...workflowData, inspectedBy: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e1e5e9',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                    placeholder="Enter inspector name"
                  />
                </div>

                {selectedShipment.latestStatus === 'inspecting' && (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                        Inspection Result
                      </label>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="radio"
                            checked={workflowData.inspectionPassed && !workflowData.inspectionOnHold && !workflowData.inspectionFailed}
                            onChange={() => setWorkflowData({...workflowData, inspectionPassed: true, inspectionOnHold: false, inspectionFailed: false, holdTypes: [], failureReasons: []})}
                          />
                          ✅ Passed
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="radio"
                            checked={workflowData.inspectionOnHold}
                            onChange={() => setWorkflowData({...workflowData, inspectionOnHold: true, inspectionPassed: false, inspectionFailed: false, failureReasons: []})}
                          />
                          ⏸️ Passed On Hold
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="radio"
                            checked={workflowData.inspectionFailed}
                            onChange={() => setWorkflowData({...workflowData, inspectionFailed: true, inspectionPassed: false, inspectionOnHold: false, holdTypes: []})}
                          />
                          ❌ Failed
                        </label>
                      </div>
                    </div>

                    {workflowData.inspectionOnHold && (
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                          Hold Type(s) <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <div style={{
                          border: '2px solid #e1e5e9',
                          borderRadius: '6px',
                          padding: '0.75rem',
                          backgroundColor: '#f8f9fa'
                        }}>
                          {['Pending Results', 'Damage Stock', 'Non Compliant Documentation', 'Awaiting COA'].map((type) => (
                            <label
                              key={type}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.5rem',
                                cursor: 'pointer'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={workflowData.holdTypes.includes(type)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setWorkflowData({
                                      ...workflowData,
                                      holdTypes: [...workflowData.holdTypes, type]
                                    });
                                  } else {
                                    setWorkflowData({
                                      ...workflowData,
                                      holdTypes: workflowData.holdTypes.filter(t => t !== type)
                                    });
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '0.9rem' }}>{type}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {workflowData.inspectionFailed && (
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                          Failure Reason(s) <span style={{ color: '#dc3545' }}>*</span>
                        </label>
                        <div style={{
                          border: '2px solid #e1e5e9',
                          borderRadius: '6px',
                          padding: '0.75rem',
                          backgroundColor: '#fff5f5'
                        }}>
                          {['No COA', 'Supplier not Approved', 'Damage Stock', 'Expired Stock', 'Non Compliant Documentation'].map((reason) => (
                            <label
                              key={reason}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                marginBottom: '0.5rem',
                                cursor: 'pointer'
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={workflowData.failureReasons.includes(reason)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setWorkflowData({
                                      ...workflowData,
                                      failureReasons: [...workflowData.failureReasons, reason]
                                    });
                                  } else {
                                    setWorkflowData({
                                      ...workflowData,
                                      failureReasons: workflowData.failureReasons.filter(r => r !== reason)
                                    });
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              <span style={{ fontSize: '0.9rem' }}>{reason}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                        Inspection Notes
                      </label>
                      <textarea
                        value={workflowData.inspectionNotes}
                        onChange={(e) => setWorkflowData({...workflowData, inspectionNotes: e.target.value})}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #e1e5e9',
                          borderRadius: '6px',
                          fontSize: '0.9rem',
                          outline: 'none',
                          minHeight: '80px',
                          resize: 'vertical'
                        }}
                        placeholder="Enter inspection notes..."
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                    Receiver Name
                  </label>
                  <input
                    type="text"
                    value={workflowData.receivedBy}
                    onChange={(e) => setWorkflowData({...workflowData, receivedBy: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '2px solid #e1e5e9',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                    placeholder="Enter receiver name"
                  />
                </div>

                {selectedShipment.latestStatus === 'receiving' && (
                  <>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                        Received Quantity
                      </label>
                      <input
                        type="number"
                        value={workflowData.receivedQuantity}
                        onChange={(e) => setWorkflowData({...workflowData, receivedQuantity: e.target.value})}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #e1e5e9',
                          borderRadius: '6px',
                          fontSize: '0.9rem',
                          outline: 'none'
                        }}
                        placeholder={`Expected: ${selectedShipment.quantity}`}
                      />
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                        Receiving Notes
                      </label>
                      <textarea
                        value={workflowData.receivingNotes}
                        onChange={(e) => setWorkflowData({...workflowData, receivingNotes: e.target.value})}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '2px solid #e1e5e9',
                          borderRadius: '6px',
                          fontSize: '0.9rem',
                          outline: 'none',
                          minHeight: '80px',
                          resize: 'vertical'
                        }}
                        placeholder="Enter receiving notes..."
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowWorkflowDialog(false);
                  setSelectedShipment(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>

              <button
                onClick={() => {
                  // Validate hold types if on hold
                  if (selectedShipment.latestStatus === 'inspecting' &&
                      workflowData.inspectionOnHold &&
                      workflowData.holdTypes.length === 0) {
                    alert('Please select at least one hold type');
                    return;
                  }

                  // Validate failure reasons if failed
                  if (selectedShipment.latestStatus === 'inspecting' &&
                      workflowData.inspectionFailed &&
                      workflowData.failureReasons.length === 0) {
                    alert('Please select at least one failure reason');
                    return;
                  }

                  if (selectedShipment.latestStatus === 'inspection_pending') {
                    submitWorkflowAction('start-inspection');
                  } else if (selectedShipment.latestStatus === 'inspecting') {
                    submitWorkflowAction('complete-inspection');
                  } else if (selectedShipment.latestStatus === 'inspection_passed') {
                    submitWorkflowAction('start-receiving');
                  } else if (selectedShipment.latestStatus === 'receiving') {
                    submitWorkflowAction('complete-receiving');
                  }
                }}
                disabled={actionLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: actionLoading ? '#ccc' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                {actionLoading ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PostArrivalWorkflow;