import React from 'react';
import WorkflowWizard from './WorkflowWizard';

/**
 * Step Components for Post-Arrival Workflow Wizard
 */

// Step 1: Arrival Information
const ArrivalInfoStep = ({ formData, updateFormData, errors, touched }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#374151' }}>
      Warehouse Location *
    </label>
    <select
      value={formData.warehouse || ''}
      onChange={(e) => updateFormData('warehouse', e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: `2px solid ${errors.warehouse ? '#ef4444' : '#d1d5db'}`,
        borderRadius: '6px',
        fontSize: '1rem',
        marginBottom: '1rem',
        boxSizing: 'border-box'
      }}
    >
      <option value="">Select warehouse...</option>
      <option value="PRETORIA">PRETORIA</option>
      <option value="KLAPMUTS">KLAPMUTS</option>
      <option value="Offsite">Offsite</option>
    </select>
    {errors.warehouse && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{errors.warehouse}</div>}

    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#374151', marginTop: '1.5rem' }}>
      Unloading Start Date *
    </label>
    <input
      type="date"
      value={formData.unloadingStartDate || ''}
      onChange={(e) => updateFormData('unloadingStartDate', e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: `2px solid ${errors.unloadingStartDate ? '#ef4444' : '#d1d5db'}`,
        borderRadius: '6px',
        fontSize: '1rem',
        boxSizing: 'border-box'
      }}
    />
    {errors.unloadingStartDate && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{errors.unloadingStartDate}</div>}

    <div style={{
      marginTop: '1.5rem',
      padding: '12px',
      backgroundColor: '#fef3c7',
      borderRadius: '6px',
      color: '#92400e',
      fontSize: '0.9rem'
    }}>
      ⚠️ Please ensure the shipment has physically arrived at the warehouse
    </div>
  </div>
);

// Step 2: Inspection
const InspectionStep = ({ formData, updateFormData, errors, touched }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#374151' }}>
      Inspection Status *
    </label>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
      {['inspection_passed', 'inspection_failed', 'inspection_pending'].map((status) => (
        <label key={status} style={{
          padding: '12px',
          border: `2px solid ${formData.inspectionStatus === status ? '#667eea' : '#d1d5db'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          backgroundColor: formData.inspectionStatus === status ? '#eff6ff' : 'white',
          transition: 'all 0.2s ease'
        }}>
          <input
            type="radio"
            name="inspectionStatus"
            value={status}
            checked={formData.inspectionStatus === status}
            onChange={(e) => updateFormData('inspectionStatus', e.target.value)}
            style={{ marginRight: '8px' }}
          />
          {status.replace(/_/g, ' ').toUpperCase()}
        </label>
      ))}
    </div>
    {errors.inspectionStatus && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{errors.inspectionStatus}</div>}

    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#374151', marginTop: '1.5rem' }}>
      Inspection Notes
    </label>
    <textarea
      value={formData.inspectionNotes || ''}
      onChange={(e) => updateFormData('inspectionNotes', e.target.value)}
      placeholder="Add any inspection findings, damages, or issues..."
      style={{
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '0.95rem',
        minHeight: '100px',
        boxSizing: 'border-box',
        fontFamily: 'inherit'
      }}
    />

    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#374151', marginTop: '1.5rem' }}>
      Inspection Date *
    </label>
    <input
      type="date"
      value={formData.inspectionDate || ''}
      onChange={(e) => updateFormData('inspectionDate', e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: `2px solid ${errors.inspectionDate ? '#ef4444' : '#d1d5db'}`,
        borderRadius: '6px',
        fontSize: '1rem',
        boxSizing: 'border-box'
      }}
    />
    {errors.inspectionDate && <div style={{ color: '#ef4444', fontSize: '0.85rem' }}>{errors.inspectionDate}</div>}
  </div>
);

// Step 3: Receiving
const ReceivingStep = ({ formData, updateFormData, errors, touched }) => (
  <div>
    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#374151' }}>
      Quantity Received *
    </label>
    <input
      type="number"
      value={formData.receivedQuantity || ''}
      onChange={(e) => updateFormData('receivedQuantity', parseInt(e.target.value) || 0)}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: `2px solid ${errors.receivedQuantity ? '#ef4444' : '#d1d5db'}`,
        borderRadius: '6px',
        fontSize: '1rem',
        marginBottom: '1rem',
        boxSizing: 'border-box'
      }}
      min="0"
    />
    {errors.receivedQuantity && <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '1rem' }}>{errors.receivedQuantity}</div>}

    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#374151' }}>
      Receiving Status *
    </label>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
      {['receiving_pending', 'received'].map((status) => (
        <label key={status} style={{
          padding: '12px',
          border: `2px solid ${formData.receivingStatus === status ? '#667eea' : '#d1d5db'}`,
          borderRadius: '6px',
          cursor: 'pointer',
          backgroundColor: formData.receivingStatus === status ? '#eff6ff' : 'white',
          transition: 'all 0.2s ease'
        }}>
          <input
            type="radio"
            name="receivingStatus"
            value={status}
            checked={formData.receivingStatus === status}
            onChange={(e) => updateFormData('receivingStatus', e.target.value)}
            style={{ marginRight: '8px' }}
          />
          {status.replace(/_/g, ' ').toUpperCase()}
        </label>
      ))}
    </div>

    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#374151' }}>
      Discrepancies
    </label>
    <textarea
      value={formData.discrepancies || ''}
      onChange={(e) => updateFormData('discrepancies', e.target.value)}
      placeholder="Note any discrepancies, damaged items, shortages, etc..."
      style={{
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '0.95rem',
        minHeight: '100px',
        boxSizing: 'border-box',
        fontFamily: 'inherit'
      }}
    />

    <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500', color: '#374151', marginTop: '1.5rem' }}>
      Receiving Date *
    </label>
    <input
      type="date"
      value={formData.receivingDate || ''}
      onChange={(e) => updateFormData('receivingDate', e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: `2px solid ${errors.receivingDate ? '#ef4444' : '#d1d5db'}`,
        borderRadius: '6px',
        fontSize: '1rem',
        boxSizing: 'border-box'
      }}
    />
  </div>
);

// Step 4: Review
const ReviewStep = ({ formData, updateFormData, errors, touched }) => (
  <div>
    <div style={{
      backgroundColor: '#f0fdf4',
      border: '1px solid #86efac',
      borderRadius: '6px',
      padding: '1.5rem'
    }}>
      <h3 style={{ marginTop: 0, color: '#15803d' }}>Review Your Changes</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Column 1 */}
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Warehouse</label>
            <div style={{ fontWeight: '500', color: '#1f2937' }}>{formData.warehouse || 'Not specified'}</div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Unloading Date</label>
            <div style={{ fontWeight: '500', color: '#1f2937' }}>{formData.unloadingStartDate || 'Not specified'}</div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Inspection Status</label>
            <div style={{ fontWeight: '500', color: '#1f2937' }}>{formData.inspectionStatus?.toUpperCase() || 'Not specified'}</div>
          </div>
        </div>

        {/* Column 2 */}
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Inspection Date</label>
            <div style={{ fontWeight: '500', color: '#1f2937' }}>{formData.inspectionDate || 'Not specified'}</div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Received Quantity</label>
            <div style={{ fontWeight: '500', color: '#1f2937' }}>{formData.receivedQuantity || 0}</div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Receiving Status</label>
            <div style={{ fontWeight: '500', color: '#1f2937' }}>{formData.receivingStatus?.toUpperCase() || 'Not specified'}</div>
          </div>
        </div>
      </div>

      {formData.inspectionNotes && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #86efac' }}>
          <label style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Inspection Notes</label>
          <div style={{ color: '#1f2937', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{formData.inspectionNotes}</div>
        </div>
      )}

      {formData.discrepancies && (
        <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #86efac' }}>
          <label style={{ fontSize: '0.85rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Discrepancies</label>
          <div style={{ color: '#1f2937', fontSize: '0.95rem', whiteSpace: 'pre-wrap' }}>{formData.discrepancies}</div>
        </div>
      )}
    </div>

    <div style={{
      marginTop: '1.5rem',
      padding: '12px',
      backgroundColor: '#eff6ff',
      borderLeft: '4px solid #3b82f6',
      borderRadius: '4px',
      color: '#1e40af',
      fontSize: '0.9rem'
    }}>
      ✓ Click 'Complete' to save all changes
    </div>
  </div>
);

/**
 * PostArrivalWizard Component
 * Guided wizard for post-arrival workflows
 */
function PostArrivalWizard({
  shipment,
  onComplete,
  onCancel
}) {
  // Validation for each step
  const validateArrivalInfo = async (data) => {
    const errors = {};
    if (!data.warehouse) errors.warehouse = 'Warehouse is required';
    if (!data.unloadingStartDate) errors.unloadingStartDate = 'Unloading start date is required';
    return errors;
  };

  const validateInspection = async (data) => {
    const errors = {};
    if (!data.inspectionStatus) errors.inspectionStatus = 'Inspection status is required';
    if (!data.inspectionDate) errors.inspectionDate = 'Inspection date is required';
    return errors;
  };

  const validateReceiving = async (data) => {
    const errors = {};
    if (data.receivedQuantity === undefined || data.receivedQuantity === null) {
      errors.receivedQuantity = 'Received quantity is required';
    }
    if (!data.receivingDate) errors.receivingDate = 'Receiving date is required';
    return errors;
  };

  const steps = [
    {
      id: 'arrival',
      label: 'Arrival Details',
      icon: '📦',
      component: ArrivalInfoStep,
      validate: validateArrivalInfo,
      helpText: 'Confirm the warehouse location and when unloading began'
    },
    {
      id: 'inspection',
      label: 'Inspection',
      icon: '🔍',
      component: InspectionStep,
      validate: validateInspection,
      helpText: 'Document the inspection results and any findings'
    },
    {
      id: 'receiving',
      label: 'Receiving',
      icon: '✓',
      component: ReceivingStep,
      validate: validateReceiving,
      helpText: 'Confirm quantities received and note any discrepancies'
    },
    {
      id: 'review',
      label: 'Review',
      icon: '👀',
      component: ReviewStep,
      helpText: 'Review all information before completing'
    }
  ];

  const initialData = {
    warehouse: shipment?.receivingWarehouse || '',
    unloadingStartDate: shipment?.unloadingStartDate ? new Date(shipment.unloadingStartDate).toISOString().split('T')[0] : '',
    inspectionStatus: shipment?.inspectionStatus || '',
    inspectionDate: shipment?.inspectionDate ? new Date(shipment.inspectionDate).toISOString().split('T')[0] : '',
    inspectionNotes: shipment?.inspectionNotes || '',
    receivingStatus: shipment?.receivingStatus || '',
    receivedQuantity: shipment?.receivedQuantity || 0,
    receivingDate: shipment?.receivingDate ? new Date(shipment.receivingDate).toISOString().split('T')[0] : '',
    discrepancies: shipment?.discrepancies || ''
  };

  return (
    <WorkflowWizard
      title="🚚 Post-Arrival Workflow"
      steps={steps}
      initialData={initialData}
      onComplete={onComplete}
      onCancel={onCancel}
    />
  );
}

export default PostArrivalWizard;
