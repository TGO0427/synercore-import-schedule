import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import useFormDraft from '../hooks/useFormDraft';
import { ShipmentStatus, isDelayedStatus } from '../types/shipment';
import { getCurrentWeekNumber } from '../utils/dateUtils';
import { AIRFREIGHT_AGENTS, SEAFREIGHT_AGENTS, AIRFREIGHT_STATUSES, isAirfreight, getShippingProgress, isAirfreightStatus, getForwardingAgents } from '../utils/shipmentConstants';
import { generatePDF as generateShipmentPDF, generateExcel as generateShipmentExcel } from '../utils/shipmentExport';
import WeekCalendar from './WeekCalendar';
import BulkStatusUpdate from './BulkStatusUpdate';
import ShipmentTableToolbar from './ShipmentTableToolbar';
import ResizableModal from './ResizableModal';
import OrderDetailsModal from './OrderDetailsModal';
import ArchiveDialogs from './ArchiveDialogs';
import { SkeletonShipmentTable } from './SkeletonLoaders';
import { getApiUrl } from '../config/api';
import { authFetch } from '../utils/authFetch';
import { copyToClipboard } from '../utils/clipboard';
import { useNotification } from '../contexts/NotificationContext';

function ShipmentTable({ shipments, onUpdateShipment, onDeleteShipment, onCreateShipment, loading, globalSearchTerm, onClearGlobalSearch }) {
  const { showSuccess, showError, showWarning, confirm: confirmAction } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(['all']);
  const [sortConfig, setSortConfig] = useState({ key: 'weekNumber', direction: 'asc' });
  const currentWeek = getCurrentWeekNumber();
  const [weekFrom, setWeekFrom] = useState(currentWeek);
  const [weekTo, setWeekTo] = useState(currentWeek + 2);
  const [showAddShipmentDialog, setShowAddShipmentDialog] = useState(false);
  const [showAmendShipmentDialog, setShowAmendShipmentDialog] = useState(false);
  const [localTextValues, setLocalTextValues] = useState({});
  const [amendingShipment, setAmendingShipment] = useState(null);
  const [showCustomSupplier, setShowCustomSupplier] = useState(false);
  const [newShipmentSelectedWeekDate, setNewShipmentSelectedWeekDate] = useState(null);
  const [amendShipmentSelectedWeekDate, setAmendShipmentSelectedWeekDate] = useState(null);
  const [productLines, setProductLines] = useState([{ name: '', qty: '' }]);
  const [amendProductLines, setAmendProductLines] = useState([{ name: '', qty: '' }]);
  const [showAutoArchiveDialog, setShowAutoArchiveDialog] = useState(false);
  const [showManualArchiveDialog, setShowManualArchiveDialog] = useState(false);
  const [selectedShipments, setSelectedShipments] = useState([]);
  const [showBulkStatusUpdate, setShowBulkStatusUpdate] = useState(false);
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);
  const [showOrderDetailsModal, setShowOrderDetailsModal] = useState(false);
  const [orderDetailsShipment, setOrderDetailsShipment] = useState(null);
  const [edits, setEdits] = useState({}); // Track unsaved changes per shipment
  const [formErrors, setFormErrors] = useState({});
  const [amendFormErrors, setAmendFormErrors] = useState({});
  const [newShipment, setNewShipment] = useState({
    supplier: '',
    orderRef: '',
    finalPod: '',
    latestStatus: 'planned_airfreight',
    weekNumber: '',
    productName: '',
    quantity: '',
    cbm: '',
    palletQty: '',
    receivingWarehouse: '',
    forwardingAgent: '',
    vesselName: '',
    incoterm: '',
    notes: '',
    reminderDate: '',
    reminderNote: ''
  });

  // Mobile responsiveness
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-save add shipment form
  const { clearDraft: clearNewShipmentDraft, confirmClose: confirmCloseNew } = useFormDraft(
    'shipment_new', newShipment, setNewShipment, { enabled: showAddShipmentDialog }
  );
  // Auto-save amend shipment form
  const { clearDraft: clearAmendShipmentDraft, confirmClose: confirmCloseAmend } = useFormDraft(
    `shipment_${amendingShipment?.id || 'none'}`, amendingShipment, setAmendingShipment,
    { enabled: showAmendShipmentDialog && !!amendingShipment }
  );

  // Pick up search term from global search
  useEffect(() => {
    if (globalSearchTerm) {
      setSearchTerm(globalSearchTerm);
      if (onClearGlobalSearch) onClearGlobalSearch();
    }
  }, [globalSearchTerm, onClearGlobalSearch]);

  // Refs for debounced input timeouts
  const timeoutRefs = useRef({});

  const filteredAndSortedShipments = useMemo(() => {
    let filtered = shipments.filter(shipment => {
      const matchesSearch = searchTerm === '' ||
        shipment.orderRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.finalPod?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.productName?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter.includes('all') ||
        statusFilter.includes(shipment.latestStatus) ||
        (statusFilter.includes('arrived') && (shipment.latestStatus === ShipmentStatus.ARRIVED_PTA || shipment.latestStatus === ShipmentStatus.ARRIVED_KLM || shipment.latestStatus === ShipmentStatus.ARRIVED_OFFSITE));

      const shipWeek = shipment.weekNumber ? parseInt(shipment.weekNumber) : null;
      const matchesWeek = shipWeek === null || (shipWeek >= weekFrom && shipWeek <= weekTo);

      return matchesSearch && matchesStatus && matchesWeek;
    });

    // Sort with planned shipments at the bottom
    filtered.sort((a, b) => {
      // First priority: planned statuses go to bottom
      const aIsPlanned = a.latestStatus?.startsWith('planned_');
      const bIsPlanned = b.latestStatus?.startsWith('planned_');

      if (aIsPlanned && !bIsPlanned) return 1;  // a goes after b
      if (!aIsPlanned && bIsPlanned) return -1; // a goes before b

      // Second priority: apply user-selected sort if any
      if (sortConfig.key) {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        // Handle numeric fields
        const numericFields = ['weekNumber', 'quantity', 'cbm', 'palletQty'];
        if (numericFields.includes(sortConfig.key)) {
          const aNum = Number(aValue) || 0;
          const bNum = Number(bValue) || 0;
          return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
        }

        if (aValue instanceof Date && bValue instanceof Date) {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const comparison = aValue.toString().localeCompare(bValue.toString());
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      }

      return 0;
    });

    return filtered;
  }, [shipments, searchTerm, statusFilter, sortConfig, weekFrom, weekTo]);

  // Extract unique suppliers for dropdown
  const uniqueSuppliers = useMemo(() => {
    const suppliers = shipments
      .map(shipment => shipment.supplier)
      .filter(supplier => supplier && supplier.trim() !== '')
      .filter((supplier, index, self) => self.indexOf(supplier) === index)
      .sort();
    return suppliers;
  }, [shipments]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleStatusUpdate = (shipmentId, newStatus) => {
    onUpdateShipment(shipmentId, { latestStatus: newStatus });
  };

  const handleWeekUpdate = (shipmentId, newWeekNumber, selectedDate) => {
    const updates = { weekNumber: newWeekNumber.toString() };
    if (selectedDate) {
      updates.selectedWeekDate = selectedDate.toISOString();
    }
    onUpdateShipment(shipmentId, updates);
  };

  // Track field changes without auto-saving
  const handleTextInputChange = useCallback((shipmentId, field, value) => {
    const key = `${shipmentId}-${field}`;

    // Update local state immediately for UI responsiveness
    setLocalTextValues(prev => ({ ...prev, [key]: value }));

    // Track as unsaved edit
    setEdits(prev => ({
      ...prev,
      [shipmentId]: {
        ...(prev[shipmentId] || {}),
        [field]: value
      }
    }));

    // Clear any existing timeout
    if (timeoutRefs.current[key]) {
      clearTimeout(timeoutRefs.current[key]);
      delete timeoutRefs.current[key];
    }
  }, []);

  // Handle dropdown changes (incoterm, forwardingAgent)
  const handleDropdownChange = useCallback((shipmentId, field, value) => {
    setEdits(prev => ({
      ...prev,
      [shipmentId]: {
        ...(prev[shipmentId] || {}),
        [field]: value
      }
    }));
  }, []);

  // Save all changes for a specific shipment
  const saveShipment = useCallback((shipmentId) => {
    const changes = edits[shipmentId];
    if (!changes || Object.keys(changes).length === 0) return;

    onUpdateShipment(shipmentId, changes);

    // Clear edits and local text values for this shipment
    setEdits(prev => {
      const copy = { ...prev };
      delete copy[shipmentId];
      return copy;
    });

    // Clear local text values
    setLocalTextValues(prev => {
      const copy = { ...prev };
      Object.keys(changes).forEach(field => {
        delete copy[`${shipmentId}-${field}`];
      });
      return copy;
    });
  }, [edits, onUpdateShipment]);

  // Save all pending changes
  const saveAllChanges = useCallback(() => {
    Object.keys(edits).forEach(shipmentId => {
      saveShipment(shipmentId);
    });
  }, [edits, saveShipment]);

  // Count unsaved changes
  const unsavedCount = Object.keys(edits).length;

  // Cleanup effect to clear timeouts on unmount
  useEffect(() => {
    return () => {
      // Clear all pending timeouts when component unmounts
      Object.values(timeoutRefs.current).forEach(timeoutId => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      timeoutRefs.current = {};
    };
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getDaysUntilArrival = (estimatedArrival) => {
    if (!estimatedArrival) return null;
    const now = new Date();
    const arrivalDate = new Date(estimatedArrival);
    const diffTime = arrivalDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const isDelayed = (shipment) => {
    return isDelayedStatus(shipment.latestStatus);
  };

  const generatePDF = () => {
    generateShipmentPDF(filteredAndSortedShipments, { searchTerm, statusFilter });
  };

  const generateExcel = () => {
    generateShipmentExcel(filteredAndSortedShipments);
  };

  const handleAddShipment = async () => {
    const errors = validateShipmentForm(newShipment);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showWarning('Please fix the validation errors before submitting.');
      return;
    }

    try {
      // Combine product lines into productName and total quantity
      const filledLines = productLines.filter(l => l.name.trim());
      const combinedProductName = filledLines.map(l => l.name.trim()).join('; ');
      const totalQuantity = Math.round(productLines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0));

      // Destructure out productName/quantity from newShipment so they don't override our computed values
      const { productName: _pn, quantity: _qty, ...restNewShipment } = newShipment;
      const shipmentData = {
        ...restNewShipment,
        productName: combinedProductName || null,
        quantity: totalQuantity > 0 ? totalQuantity : null,
        cbm: newShipment.cbm ? Number(newShipment.cbm) : null,
        palletQty: newShipment.palletQty ? Number(newShipment.palletQty) : null,
        weekNumber: newShipment.weekNumber ? Number(newShipment.weekNumber) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Add selected week date if available
      if (newShipmentSelectedWeekDate) {
        shipmentData.selectedWeekDate = newShipmentSelectedWeekDate.toISOString();
      }

      await onCreateShipment(shipmentData);
      clearNewShipmentDraft();
      // Reset form
      setNewShipment({
        supplier: '',
        orderRef: '',
        finalPod: '',
        latestStatus: 'planned_airfreight',
        weekNumber: '',
        productName: '',
        quantity: '',
        cbm: '',
        palletQty: '',
        receivingWarehouse: '',
        forwardingAgent: '',
        vesselName: '',
        incoterm: '',
        notes: ''
      });
      setProductLines([{ name: '', qty: '' }]);
      setShowCustomSupplier(false);
      setNewShipmentSelectedWeekDate(null);
      setFormErrors({});
      setShowAddShipmentDialog(false);
    } catch (error) {
      console.error('Error adding shipment:', error);
      showError('Failed to add shipment. Please try again.');
    }
  };

  const handleInputChange = (field, value) => {
    setNewShipment(prev => ({ ...prev, [field]: value }));
  };

  const handleSupplierChange = (value) => {
    if (value === 'ADD_NEW') {
      setShowCustomSupplier(true);
      setNewShipment(prev => ({ ...prev, supplier: '' }));
    } else {
      setShowCustomSupplier(false);
      setNewShipment(prev => ({ ...prev, supplier: value }));
    }
  };

  const validateShipmentForm = (data) => {
    const errors = {};
    if (!data.orderRef?.trim()) errors.orderRef = 'Order reference is required';
    if (!data.supplier?.trim()) errors.supplier = 'Supplier is required';
    if (!data.finalPod?.trim()) errors.finalPod = 'Final POD is required';
    if (data.quantity !== undefined && data.quantity !== null && data.quantity !== '') {
      if (isNaN(data.quantity) || Number(data.quantity) < 0) errors.quantity = 'Quantity must be a positive number';
    }
    if (data.weekNumber !== undefined && data.weekNumber !== null && data.weekNumber !== '') {
      const wn = Number(data.weekNumber);
      if (isNaN(wn) || wn < 1 || wn > 53) errors.weekNumber = 'Week number must be 1-53';
    }
    if (data.palletQty !== undefined && data.palletQty !== null && data.palletQty !== '') {
      if (isNaN(data.palletQty) || Number(data.palletQty) < 0) errors.palletQty = 'Pallet quantity must be a positive number';
    }
    if (data.cbm !== undefined && data.cbm !== null && data.cbm !== '') {
      if (isNaN(data.cbm) || Number(data.cbm) < 0) errors.cbm = 'CBM must be a positive number';
    }
    return errors;
  };

  const handleNewShipmentWeekUpdate = (weekNumber, selectedDate) => {
    setNewShipment(prev => ({ ...prev, weekNumber: weekNumber.toString() }));
    setNewShipmentSelectedWeekDate(selectedDate);
  };

  const handleAmendShipmentWeekUpdate = (weekNumber, selectedDate) => {
    setAmendingShipment(prev => ({ ...prev, weekNumber: weekNumber.toString() }));
    setAmendShipmentSelectedWeekDate(selectedDate);
  };

  const handleAmendShipment = (shipment) => {
    setAmendingShipment({ ...shipment });
    // Parse existing product name into lines (semicolon-separated)
    if (shipment.productName && shipment.productName.includes(';')) {
      const names = shipment.productName.split(';').map(n => n.trim());
      setAmendProductLines(names.map(n => ({ name: n, qty: '' })));
    } else {
      setAmendProductLines([{ name: shipment.productName || '', qty: shipment.quantity != null ? String(shipment.quantity) : '' }]);
    }
    setAmendShipmentSelectedWeekDate(shipment.selectedWeekDate ? new Date(shipment.selectedWeekDate) : null);
    setShowAmendShipmentDialog(true);
  };

  const handleAmendInputChange = (field, value) => {
    setAmendingShipment(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveAmendment = async () => {
    const errors = validateShipmentForm(amendingShipment);
    setAmendFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showWarning('Please fix the validation errors before saving.');
      return;
    }

    try {
      // Combine amend product lines
      const filledLines = amendProductLines.filter(l => l.name.trim());
      const combinedProductName = filledLines.map(l => l.name.trim()).join('; ');
      const totalQuantity = Math.round(amendProductLines.reduce((sum, l) => sum + (Number(l.qty) || 0), 0));

      const { productName: _pn, quantity: _qty, ...restAmending } = amendingShipment;
      const updatedShipment = {
        ...restAmending,
        productName: combinedProductName || null,
        quantity: totalQuantity > 0 ? totalQuantity : null,
        cbm: amendingShipment.cbm ? Number(amendingShipment.cbm) : null,
        palletQty: amendingShipment.palletQty ? Number(amendingShipment.palletQty) : null,
        weekNumber: amendingShipment.weekNumber ? Number(amendingShipment.weekNumber) : null,
        updatedAt: new Date().toISOString()
      };

      // Add selected week date if available
      if (amendShipmentSelectedWeekDate) {
        updatedShipment.selectedWeekDate = amendShipmentSelectedWeekDate.toISOString();
      }

      await onUpdateShipment(amendingShipment.id, updatedShipment);
      clearAmendShipmentDraft();
      setShowAmendShipmentDialog(false);
      setAmendingShipment(null);
      setAmendShipmentSelectedWeekDate(null);
      setAmendFormErrors({});
    } catch (error) {
      console.error('Error amending shipment:', error);
      showError('Failed to amend shipment. Please try again.');
    }
  };


  const handleShipmentSelect = (shipmentId, isSelected) => {
    if (isSelected) {
      setSelectedShipments(prev => [...prev, shipmentId]);
    } else {
      setSelectedShipments(prev => prev.filter(id => id !== shipmentId));
    }
  };

  const handleSelectAllArrived = () => {
    const arrivedShipments = filteredAndSortedShipments.filter(s => s.latestStatus === 'arrived_pta' || s.latestStatus === 'arrived_klm' || s.latestStatus === 'arrived_offsite');
    setSelectedShipments(arrivedShipments.map(s => s.id));
  };

  const handleSelectAll = () => {
    setSelectedShipments(filteredAndSortedShipments.map(s => s.id));
  };

  const handleClearSelection = () => {
    setSelectedShipments([]);
  };

  const handleBulkArchive = async () => {
    if (selectedShipments.length === 0) return;
    if (!confirm(`Archive ${selectedShipments.length} shipments?`)) return;
    try {
      const res = await authFetch(getApiUrl('/api/shipments/bulk/archive'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedShipments })
      });
      if (res.ok) {
        const data = await res.json();
        showSuccess(`Archived ${data.archived} shipment(s)${data.failed > 0 ? `, ${data.failed} failed` : ''}`);
        setSelectedShipments([]);
        if (typeof onDeleteShipment === 'function') {
          // Trigger a full refresh by calling onDeleteShipment which will cause the parent to refetch
          window.location.reload();
        }
      } else {
        showError('Failed to archive shipments');
      }
    } catch (err) {
      showError('Error archiving shipments');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedShipments.length === 0) return;
    if (!confirm(`Delete ${selectedShipments.length} shipments? This cannot be undone.`)) return;
    try {
      const res = await authFetch(getApiUrl('/api/shipments/bulk/delete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedShipments })
      });
      if (res.ok) {
        const data = await res.json();
        showSuccess(`Deleted ${data.deleted} shipment(s)${data.failed > 0 ? `, ${data.failed} failed` : ''}`);
        setSelectedShipments([]);
        if (typeof onDeleteShipment === 'function') {
          window.location.reload();
        }
      } else {
        showError('Failed to delete shipments');
      }
    } catch (err) {
      showError('Error deleting shipments');
    }
  };


  const handleBulkStatusUpdate = async (shipmentIds, newStatus) => {
    try {
      setBulkUpdateLoading(true);

      // Update all selected shipments
      const updatePromises = shipmentIds.map(id => {
        const shipment = shipments.find(s => s.id === id);
        if (!shipment) return Promise.resolve();

        return onUpdateShipment({
          ...shipment,
          latestStatus: newStatus
        });
      });

      await Promise.all(updatePromises);

      setShowBulkStatusUpdate(false);
      showSuccess(`Successfully updated ${shipmentIds.length} shipment(s) to ${newStatus.replace(/_/g, ' ').toUpperCase()}`);
    } catch (error) {
      console.error('Error updating shipments:', error);
      showError('Error updating shipments. Please try again.');
    } finally {
      setBulkUpdateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="shipments-table card">
        <div className="brand-strip" />
        <div style={{ padding: '1rem 1.25rem 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--navy-900)' }}>Shipping Schedule</h2>
        </div>
        <SkeletonShipmentTable rows={12} />
      </div>
    );
  }

  return (
   <div className="shipments-table card">
      <div className="brand-strip" />

      <ShipmentTableToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        weekFrom={weekFrom}
        weekTo={weekTo}
        onWeekFromChange={setWeekFrom}
        onWeekToChange={setWeekTo}
        totalCount={shipments.length}
        filteredCount={filteredAndSortedShipments.length}
        unsavedCount={unsavedCount}
        onSaveAll={saveAllChanges}
        onAddShipment={() => setShowAddShipmentDialog(true)}
        onGeneratePDF={generatePDF}
        onGenerateExcel={generateExcel}
        onShowAutoArchive={() => setShowAutoArchiveDialog(true)}
        onShowManualArchive={() => setShowManualArchiveDialog(true)}
        onShowBulkUpdate={() => setShowBulkStatusUpdate(true)}
        selectedCount={selectedShipments.length}
        onBulkArchive={handleBulkArchive}
        onBulkDelete={handleBulkDelete}
        onClearSelection={handleClearSelection}
        shipments={shipments}
        currentFilters={{ search: searchTerm, status: statusFilter }}
        currentWeek={currentWeek}
      />

      {/* Mobile card layout */}
      {isMobile && (
        <div className="mobile-card-list">
          {filteredAndSortedShipments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-500)' }}>
              No shipments found
            </div>
          ) : (
            filteredAndSortedShipments.map(shipment => {
              const progress = getShippingProgress(shipment.latestStatus);
              return (
                <div key={shipment.id} className="mobile-shipment-card">
                  <div className="card-header">
                    <span className="order-ref">{shipment.orderRef}</span>
                    <select
                      value={shipment.latestStatus}
                      onChange={(e) => handleStatusUpdate(shipment.id, e.target.value)}
                      className={`select status-badge status-${shipment.latestStatus}`}
                      style={{
                        borderRadius: 20, padding: '3px 10px', fontSize: 10,
                        fontWeight: 600, textTransform: 'uppercase', border: 'none', minWidth: 80,
                      }}
                    >
                      <option value={ShipmentStatus.PLANNED_AIRFREIGHT}>Planned Air</option>
                      <option value={ShipmentStatus.PLANNED_SEAFREIGHT}>Planned Sea</option>
                      <option value={ShipmentStatus.IN_TRANSIT_AIRFREIGHT}>In Transit Air</option>
                      <option value={ShipmentStatus.AIR_CUSTOMS_CLEARANCE}>Air Customs</option>
                      <option value={ShipmentStatus.IN_TRANSIT_ROADWAY}>In Transit Road</option>
                      <option value={ShipmentStatus.IN_TRANSIT_SEAWAY}>In Transit Sea</option>
                      <option value={ShipmentStatus.MOORED}>Moored</option>
                      <option value={ShipmentStatus.BERTH_WORKING}>Berth Working</option>
                      <option value={ShipmentStatus.BERTH_COMPLETE}>Berth Complete</option>
                      <option value={ShipmentStatus.GATED_IN_PORT}>Gated In Port</option>
                      <option value={ShipmentStatus.ARRIVED_PTA}>Arrived PTA</option>
                      <option value={ShipmentStatus.ARRIVED_KLM}>Arrived KLM</option>
                      <option value={ShipmentStatus.ARRIVED_OFFSITE}>Arrived OffSite</option>
                      <optgroup label="Delayed">
                        <option value={ShipmentStatus.DELAYED_PORT}>Delayed - Port</option>
                        <option value={ShipmentStatus.DELAYED_CUSTOMS}>Delayed - Customs</option>
                        <option value={ShipmentStatus.DELAYED_DOCUMENTS}>Delayed - Documents</option>
                        <option value={ShipmentStatus.DELAYED_SUPPLIER}>Delayed - Supplier</option>
                      </optgroup>
                      <option value={ShipmentStatus.CANCELLED}>Cancelled</option>
                    </select>
                  </div>
                  <dl className="card-details">
                    <dt>Supplier</dt><dd>{shipment.supplier || '-'}</dd>
                    <dt>Destination</dt><dd>{shipment.finalPod || '-'}</dd>
                    <dt>Pallets</dt><dd>{shipment.palletQty ? Math.round(shipment.palletQty) : '-'}</dd>
                    <dt>Week</dt><dd>{shipment.weekNumber || '-'}</dd>
                    <dt>Vessel / AWB</dt><dd>{shipment.vesselName || '-'}</dd>
                    <dt>Agent</dt><dd>{shipment.forwardingAgent || '-'}</dd>
                  </dl>
                  {/* Progress bar */}
                  {!isDelayedStatus(shipment.latestStatus) && shipment.latestStatus !== 'cancelled' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: 8 }}>
                      <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
                        {[1,2,3,4,5].map(step => (
                          <div key={step} style={{
                            height: '5px', flex: 1, borderRadius: '3px',
                            backgroundColor: step <= progress.current ? 'var(--accent)' : 'var(--border)',
                          }} />
                        ))}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-500)' }}>
                        {progress.current}/{progress.total}
                      </span>
                    </div>
                  )}
                  <div className="card-actions">
                    <button
                      className="btn btn-ghost"
                      onClick={() => { setOrderDetailsShipment(shipment); setShowOrderDetailsModal(true); }}
                      style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                      Details
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleAmendShipment(shipment)}
                      style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                      Amend
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Desktop table layout */}
      {!isMobile && (
      <div style={{
        overflow: 'auto',
        maxHeight: 'calc(100vh - 260px)',
        position: 'relative',
      }}>
        <table className="table" style={{ minWidth: '1200px' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ width: 36, textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={selectedShipments.length > 0 && selectedShipments.length === filteredAndSortedShipments.length}
                  onChange={(e) => e.target.checked ? handleSelectAll() : handleClearSelection()}
                  title="Select all shipments"
                />
              </th>
              {[
                { key: 'supplier', label: 'Supplier' },
                { key: 'orderRef', label: 'Order / Ref' },
                { key: 'productName', label: 'Product' },
                { key: 'finalPod', label: 'Final POD' },
                { key: 'latestStatus', label: 'Status' },
                { key: null, label: 'Progress', style: { minWidth: 90 } },
                { key: 'weekNumber', label: 'Week' },
                { key: 'palletQty', label: 'Pallets' },
                { key: 'vesselName', label: 'Vessel / AWB' },
                { key: 'incoterm', label: 'Incoterm' },
                { key: 'forwardingAgent', label: 'Agent' },
                { key: null, label: '' },
              ].map((col, i) => (
                <th key={col.key || col.label || i}
                  onClick={col.key ? () => handleSort(col.key) : undefined}
                  style={{ cursor: col.key ? 'pointer' : 'default', userSelect: 'none', ...col.style }}
                >
                  {col.label}
                  {col.key && sortConfig.key === col.key && (
                    <span style={{ marginLeft: 4, opacity: 0.7 }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedShipments.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '2rem' }}>
                  No shipments found
                </td>
              </tr>
            ) : (
              filteredAndSortedShipments.map(shipment => (
                <tr key={shipment.id} style={{
                  backgroundColor: isDelayed(shipment) ? '#fef2f2' : undefined,
                }}>
                  <td style={{ width: 36, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedShipments.includes(shipment.id)}
                      onChange={(e) => handleShipmentSelect(shipment.id, e.target.checked)}
                      title="Select shipment"
                    />
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-900)' }}>{shipment.supplier}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span
                        onClick={() => {
                          setOrderDetailsShipment(shipment);
                          setShowOrderDetailsModal(true);
                        }}
                        style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
                        title="Click to view order details"
                      >
                        {shipment.orderRef}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(shipment.orderRef, showSuccess); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', fontSize: '0.65rem', color: 'var(--text-500)', opacity: 0.4 }}
                        title="Copy order ref"
                        onMouseEnter={(e) => e.target.style.opacity = 1}
                        onMouseLeave={(e) => e.target.style.opacity = 0.4}
                      >
                        📋
                      </button>
                      {isDelayed(shipment) && <span style={{ color: 'var(--danger)', marginLeft: 2, fontSize: 12 }}>⚠️</span>}
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 13, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                      title={shipment.productName || ''}>
                      {shipment.productName || '—'}
                    </span>
                  </td>
                  <td><span style={{ fontSize: 13 }}>{shipment.finalPod}</span></td>
                  <td>
                    <select
                      value={shipment.latestStatus}
                      onChange={(e) => handleStatusUpdate(shipment.id, e.target.value)}
                      className={`select status-badge status-${shipment.latestStatus}`}
                      style={{
                        borderRadius: 20,
                        padding: '3px 10px',
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        minWidth: 90,
                        border: 'none',
                      }}
                    >
                      <option value={ShipmentStatus.PLANNED_AIRFREIGHT}>Planned Airfreight</option>
                      <option value={ShipmentStatus.PLANNED_SEAFREIGHT}>Planned Seafreight</option>
                      <option value={ShipmentStatus.IN_TRANSIT_AIRFREIGHT}>In Transit Airfreight</option>
                      <option value={ShipmentStatus.AIR_CUSTOMS_CLEARANCE}>Air Customs Clearance Event</option>
                      <option value={ShipmentStatus.IN_TRANSIT_ROADWAY}>In Transit Roadway</option>
                      <option value={ShipmentStatus.IN_TRANSIT_SEAWAY}>In Transit Seaway</option>
                      <option value={ShipmentStatus.MOORED}>Moored</option>
                      <option value={ShipmentStatus.BERTH_WORKING}>Berth Working</option>
                      <option value={ShipmentStatus.BERTH_COMPLETE}>Berth Complete</option>
                      <option value={ShipmentStatus.GATED_IN_PORT}>Gated In Port</option>
                      <option value={ShipmentStatus.ARRIVED_PTA}>Arrived PTA</option>
                      <option value={ShipmentStatus.ARRIVED_KLM}>Arrived KLM</option>
                      <option value={ShipmentStatus.ARRIVED_OFFSITE}>Arrived OffSite</option>
                      <optgroup label="Delayed">
                        <option value={ShipmentStatus.DELAYED_PORT}>Delayed - Port</option>
                        <option value={ShipmentStatus.DELAYED_CUSTOMS}>Delayed - Customs</option>
                        <option value={ShipmentStatus.DELAYED_DOCUMENTS}>Delayed - Documents</option>
                        <option value={ShipmentStatus.DELAYED_SUPPLIER}>Delayed - Supplier</option>
                      </optgroup>
                      <option value={ShipmentStatus.CANCELLED}>Cancelled</option>
                    </select>
                  </td>
                  <td>
                    {!isDelayedStatus(shipment.latestStatus) && shipment.latestStatus !== 'cancelled' ? (() => {
                      const progress = getShippingProgress(shipment.latestStatus);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div style={{ display: 'flex', gap: '2px', flex: 1, minWidth: '60px' }}>
                            {[1,2,3,4,5].map(step => (
                              <div key={step} style={{
                                height: '6px', flex: 1, borderRadius: '3px',
                                backgroundColor: step <= progress.current ? 'var(--accent)' : 'var(--border)',
                                transition: 'background-color 0.2s ease'
                              }} />
                            ))}
                          </div>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-500)', whiteSpace: 'nowrap' }}>
                            {progress.current}/{progress.total}
                          </span>
                        </div>
                      );
                    })() : (
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600,
                        color: isDelayedStatus(shipment.latestStatus) ? 'var(--danger)' : 'var(--text-500)'
                      }}>
                        {isDelayedStatus(shipment.latestStatus) ? 'DELAYED' : 'CANCELLED'}
                      </span>
                    )}
                  </td>
                  <td>
                    <WeekCalendar
                      currentWeek={shipment.weekNumber ? parseInt(shipment.weekNumber) : null}
                      onWeekSelect={(weekNumber, selectedDate) => handleWeekUpdate(shipment.id, weekNumber, selectedDate)}
                      selectedWeekDate={shipment.selectedWeekDate}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={(localTextValues[`${shipment.id}-palletQty`] ?? (shipment.palletQty ? (Math.round(shipment.palletQty) || 1) : '')) || ''}
                      onChange={(e) => handleTextInputChange(shipment.id, 'palletQty', e.target.value)}
                      placeholder="Qty"
                      className="input"
                      style={{
                        width: '60px', minWidth: '50px', maxWidth: '70px',
                        border: edits[shipment.id]?.palletQty !== undefined ? '2px solid var(--warning)' : undefined,
                        backgroundColor: edits[shipment.id]?.palletQty !== undefined ? '#fff3e0' : undefined,
                      }}
                      min="0"
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <input
                        type="text"
                        value={(localTextValues[`${shipment.id}-vesselName`] ?? shipment.vesselName) || ''}
                        onChange={(e) => handleTextInputChange(shipment.id, 'vesselName', e.target.value)}
                        placeholder={isAirfreight(shipment.latestStatus) ? 'AWB Number' : 'Vessel Name'}
                        className="input"
                        style={{
                          minWidth: '120px',
                          flex: 1,
                          border: edits[shipment.id]?.vesselName !== undefined ? '2px solid var(--warning)' : undefined,
                          backgroundColor: edits[shipment.id]?.vesselName !== undefined ? '#fff3e0' : undefined,
                        }}
                      />
                      {shipment.vesselName && (
                        <a
                          href={isAirfreight(shipment.latestStatus)
                            ? `https://www.track-trace.com/aircargo?awb=${encodeURIComponent(shipment.vesselName.replace(/\D/g, ''))}`
                            : `https://www.vesselfinder.com/vessels?name=${encodeURIComponent(shipment.vesselName)}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          title={isAirfreight(shipment.latestStatus) ? 'Track AWB' : 'Track vessel on VesselFinder'}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '0.25rem',
                            color: '#1976d2',
                            textDecoration: 'none',
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            transition: 'color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = '#1565c0'}
                          onMouseLeave={(e) => e.currentTarget.style.color = '#1976d2'}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                          </svg>
                        </a>
                      )}
                    </div>
                  </td>
                  <td>
                    <select
                      value={(edits[shipment.id]?.incoterm ?? shipment.incoterm) || ''}
                      onChange={(e) => handleDropdownChange(shipment.id, 'incoterm', e.target.value)}
                      className="select"
                      style={{
                        minWidth: '80px',
                        border: edits[shipment.id]?.incoterm !== undefined ? '2px solid var(--warning)' : undefined,
                        backgroundColor: edits[shipment.id]?.incoterm !== undefined ? '#fff3e0' : undefined,
                      }}
                    >
                      <option value="">Select</option>
                      <option value="EXW">EXW</option>
                      <option value="FCA">FCA</option>
                      <option value="CPT">CPT</option>
                      <option value="CIP">CIP</option>
                      <option value="DAP">DAP</option>
                      <option value="DPU">DPU</option>
                      <option value="DDP">DDP</option>
                      <option value="FAS">FAS</option>
                      <option value="FOB">FOB</option>
                      <option value="CFR">CFR</option>
                      <option value="CIF">CIF</option>
                    </select>
                  </td>
                  <td>
                    <select
                      value={(edits[shipment.id]?.forwardingAgent ?? shipment.forwardingAgent) || ''}
                      onChange={(e) => handleDropdownChange(shipment.id, 'forwardingAgent', e.target.value)}
                      className="select"
                      style={{
                        minWidth: '120px',
                        border: edits[shipment.id]?.forwardingAgent !== undefined ? '2px solid var(--warning)' : undefined,
                        backgroundColor: edits[shipment.id]?.forwardingAgent !== undefined ? '#fff3e0' : undefined,
                      }}
                    >
                      <option value="">Select Agent</option>
                      {getForwardingAgents(edits[shipment.id]?.latestStatus ?? shipment.latestStatus).map(agent => (
                        <option key={agent.value} value={agent.value}>{agent.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <div className="actions" style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {edits[shipment.id] && Object.keys(edits[shipment.id]).length > 0 && (
                        <button
                          onClick={() => saveShipment(shipment.id)}
                          style={{
                            padding: '4px 8px',
                            backgroundColor: 'var(--success)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                          }}
                          title="Save changes for this shipment"
                        >
                          💾 Save
                        </button>
                      )}
                      <button
                        onClick={() => handleAmendShipment(shipment)}
                        className="btn btn-primary btn-small"
                        title="Amend shipment details"
                      >
                        Amend
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      )}

      {/* Add Shipment Dialog */}
      {showAddShipmentDialog && (
        <ResizableModal
          title="Add New Shipment"
          isOpen={showAddShipmentDialog}
          onClose={() => confirmCloseNew(() => {
            setShowCustomSupplier(false);
            setNewShipmentSelectedWeekDate(null);
            setFormErrors({});
            setShowAddShipmentDialog(false);
          })}
          initialWidth={650}
          minWidth={400}
          minHeight={400}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Supplier *
                </label>
                {!showCustomSupplier ? (
                  <select
                    value={newShipment.supplier}
                    onChange={(e) => { handleSupplierChange(e.target.value); setFormErrors(prev => ({ ...prev, supplier: undefined })); }}
                    className="select"
                    style={formErrors.supplier ? { border: '1px solid var(--danger)' } : undefined}
                  >
                    <option value="">Select a supplier...</option>
                    {uniqueSuppliers.map(supplier => (
                      <option key={supplier} value={supplier}>{supplier}</option>
                    ))}
                    <option value="ADD_NEW">+ Add New Supplier</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={newShipment.supplier}
                      onChange={(e) => { handleInputChange('supplier', e.target.value); setFormErrors(prev => ({ ...prev, supplier: undefined })); }}
                      className="input"
                      style={{
                        flex: 1,
                        ...(formErrors.supplier ? { border: '1px solid var(--danger)' } : {})
                      }}
                      placeholder="Enter new supplier name"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomSupplier(false);
                        setNewShipment(prev => ({ ...prev, supplier: '' }));
                      }}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                      title="Back to dropdown"
                    >
                      ↩
                    </button>
                  </div>
                )}
                {formErrors.supplier && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px' }}>{formErrors.supplier}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Order/Ref *
                </label>
                <input
                  type="text"
                  value={newShipment.orderRef}
                  onChange={(e) => { handleInputChange('orderRef', e.target.value); setFormErrors(prev => ({ ...prev, orderRef: undefined })); }}
                  className="input"
                  style={formErrors.orderRef ? { border: '1px solid var(--danger)' } : undefined}
                  placeholder="Order reference"
                />
                {formErrors.orderRef && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px' }}>{formErrors.orderRef}</div>}
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Final POD *
                </label>
                <input
                  type="text"
                  value={newShipment.finalPod}
                  onChange={(e) => { handleInputChange('finalPod', e.target.value); setFormErrors(prev => ({ ...prev, finalPod: undefined })); }}
                  className="input"
                  style={formErrors.finalPod ? { border: '1px solid var(--danger)' } : undefined}
                  placeholder="Port of discharge"
                />
                {formErrors.finalPod && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px' }}>{formErrors.finalPod}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Status
                </label>
                <select
                  value={newShipment.latestStatus}
                  onChange={(e) => handleInputChange('latestStatus', e.target.value)}
                  className="select"
                  style={{
                    width: '100%'
                  }}
                >
                  <option value="planned_airfreight">Planned Airfreight</option>
                  <option value="planned_seafreight">Planned Seafreight</option>
                  <option value="in_transit_airfreight">In Transit Airfreight</option>
                  <option value="air_customs_clearance">Air Customs Clearance Event</option>
                  <option value="in_transit_roadway">In Transit Roadway</option>
                  <option value="in_transit_seaway">In Transit Seaway</option>
                  <option value="moored">Moored</option>
                  <option value="berth_working">Berth Working</option>
                  <option value="berth_complete">Berth Complete</option>
                  <option value="gated_in_port">Gated In Port</option>
                  <option value="arrived_pta">Arrived PTA</option>
                  <option value="arrived_klm">Arrived KLM</option>
                  <option value="arrived_offsite">Arrived OffSite</option>
                  <optgroup label="Delayed">
                    <option value="delayed_port">Delayed - Port</option>
                    <option value="delayed_customs">Delayed - Customs</option>
                    <option value="delayed_documents">Delayed - Documents</option>
                    <option value="delayed_supplier">Delayed - Supplier</option>
                  </optgroup>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Week Number
                </label>
                <WeekCalendar
                  currentWeek={newShipment.weekNumber ? parseInt(newShipment.weekNumber) : null}
                  onWeekSelect={handleNewShipmentWeekUpdate}
                  selectedWeekDate={newShipmentSelectedWeekDate}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Expected Arrival Date <span style={{ color: '#999', fontSize: '0.85em' }}>Optional</span>
                </label>
                <input
                  type="date"
                  value={newShipment.selectedWeekDate ? new Date(newShipment.selectedWeekDate).toISOString().split('T')[0] : ''}
                  onChange={(e) => {
                    if (e.target.value) {
                      const selectedDate = new Date(e.target.value);
                      handleInputChange('selectedWeekDate', selectedDate.toISOString());
                      // Auto-calculate week number from selected date
                      const yearStart = new Date(selectedDate.getFullYear(), 0, 1);
                      const weekNumber = Math.ceil((((selectedDate - yearStart) / 86400000) + yearStart.getDay() + 1) / 7);
                      handleInputChange('weekNumber', weekNumber.toString());
                    } else {
                      handleInputChange('selectedWeekDate', '');
                    }
                  }}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: '500', color: 'var(--text-900)' }}>
                    Products
                  </label>
                  <button
                    type="button"
                    onClick={() => setProductLines(prev => [...prev, { name: '', qty: '' }])}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '2px 10px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: 'var(--primary)',
                      fontWeight: '600'
                    }}
                  >
                    + Add Product
                  </button>
                </div>
                {productLines.map((line, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={line.name}
                      onChange={(e) => {
                        const updated = [...productLines];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setProductLines(updated);
                      }}
                      className="input"
                      style={{ flex: 2 }}
                      placeholder="Product name"
                    />
                    <input
                      type="number"
                      value={line.qty}
                      onChange={(e) => {
                        const updated = [...productLines];
                        updated[idx] = { ...updated[idx], qty: e.target.value };
                        setProductLines(updated);
                      }}
                      className="input"
                      style={{ flex: 1 }}
                      placeholder="Qty"
                      min="0"
                    />
                    {productLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setProductLines(prev => prev.filter((_, i) => i !== idx))}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#d32f2f',
                          fontSize: '1.2rem',
                          padding: '0 4px',
                          lineHeight: 1
                        }}
                        title="Remove product"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-500)' }}>
                  CBM (Cubic Meters) <span style={{ color: '#999', fontSize: '0.85em' }}>Optional</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newShipment.cbm}
                  onChange={(e) => { handleInputChange('cbm', e.target.value); setFormErrors(prev => ({ ...prev, cbm: undefined })); }}
                  className="input"
                  style={{
                    width: '100%',
                    ...(formErrors.cbm ? { border: '1px solid var(--danger)' } : {})
                  }}
                  placeholder="Cubic meters (optional)"
                  min="0"
                />
                {formErrors.cbm && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px' }}>{formErrors.cbm}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Pallet Qty
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newShipment.palletQty}
                  onChange={(e) => { handleInputChange('palletQty', e.target.value); setFormErrors(prev => ({ ...prev, palletQty: undefined })); }}
                  className="input"
                  style={{
                    width: '100%',
                    ...(formErrors.palletQty ? { border: '1px solid var(--danger)' } : {})
                  }}
                  placeholder="Pallet quantity"
                  min="0"
                />
                {formErrors.palletQty && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px' }}>{formErrors.palletQty}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Receiving Warehouse
                </label>
                <select
                  value={newShipment.receivingWarehouse}
                  onChange={(e) => handleInputChange('receivingWarehouse', e.target.value)}
                  className="select"
                  style={{
                    width: '100%'
                  }}
                >
                  <option value="">Select Warehouse</option>
                  <option value="PRETORIA">PRETORIA</option>
                  <option value="KLAPMUTS">KLAPMUTS</option>
                  <option value="OFFSITE">OFFSITE</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Forwarding Agent
                </label>
                <select
                  value={newShipment.forwardingAgent}
                  onChange={(e) => handleInputChange('forwardingAgent', e.target.value)}
                  className="select"
                  style={{
                    width: '100%'
                  }}
                >
                  <option value="">Select Forwarding Agent</option>
                  {getForwardingAgents(newShipment.latestStatus).map(agent => (
                    <option key={agent.value} value={agent.value}>{agent.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  {isAirfreight(newShipment.latestStatus) ? 'AWB Number' : 'Vessel Name'}
                </label>
                <input
                  type="text"
                  value={newShipment.vesselName}
                  onChange={(e) => handleInputChange('vesselName', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder={isAirfreight(newShipment.latestStatus) ? 'AWB number' : 'Vessel name'}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Incoterm
                </label>
                <select
                  value={newShipment.incoterm}
                  onChange={(e) => handleInputChange('incoterm', e.target.value)}
                  className="select"
                  style={{
                    width: '100%'
                  }}
                >
                  <option value="">Select Incoterm</option>
                  <option value="EXW">EXW - Ex Works</option>
                  <option value="FCA">FCA - Free Carrier</option>
                  <option value="CPT">CPT - Carriage Paid To</option>
                  <option value="CIP">CIP - Carriage and Insurance Paid To</option>
                  <option value="DAP">DAP - Delivered At Place</option>
                  <option value="DPU">DPU - Delivered At Place Unloaded</option>
                  <option value="DDP">DDP - Delivered Duty Paid</option>
                  <option value="FAS">FAS - Free Alongside Ship</option>
                  <option value="FOB">FOB - Free On Board</option>
                  <option value="CFR">CFR - Cost and Freight</option>
                  <option value="CIF">CIF - Cost, Insurance and Freight</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Notes
                </label>
                <textarea
                  value={newShipment.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="input"
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="Additional notes or comments"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Reminder Date
                </label>
                <input
                  type="date"
                  value={newShipment.reminderDate || ''}
                  onChange={(e) => handleInputChange('reminderDate', e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Reminder Note
                </label>
                <input
                  type="text"
                  value={newShipment.reminderNote || ''}
                  onChange={(e) => handleInputChange('reminderNote', e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="e.g., Payment due, Follow up with supplier..."
                />
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
              marginTop: '2rem'
            }}>
              <button
                onClick={() => {
                  setShowCustomSupplier(false);
                  setNewShipmentSelectedWeekDate(null);
                  setShowAddShipmentDialog(false);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#545b62'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#6c757d'}
              >
                Cancel
              </button>
              <button
                onClick={handleAddShipment}
                disabled={!newShipment.supplier || !newShipment.orderRef || !newShipment.finalPod || Object.values(formErrors).some(Boolean)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: (!newShipment.supplier || !newShipment.orderRef || !newShipment.finalPod || Object.values(formErrors).some(Boolean)) ? '#6c757d' : 'var(--success)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (!newShipment.supplier || !newShipment.orderRef || !newShipment.finalPod || Object.values(formErrors).some(Boolean)) ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (newShipment.supplier && newShipment.orderRef && newShipment.finalPod && !Object.values(formErrors).some(Boolean)) {
                    e.target.style.backgroundColor = '#218838';
                  }
                }}
                onMouseLeave={(e) => {
                  if (newShipment.supplier && newShipment.orderRef && newShipment.finalPod && !Object.values(formErrors).some(Boolean)) {
                    e.target.style.backgroundColor = 'var(--success)';
                  }
                }}
              >
                Add Shipment
              </button>
            </div>

            <div style={{
              fontSize: '0.8rem',
              color: '#6c757d',
              marginTop: '1rem',
              fontStyle: 'italic'
            }}>
              * Required fields
            </div>
        </ResizableModal>
      )}

      {/* Amend Shipment Dialog */}
      {showAmendShipmentDialog && amendingShipment && (
        <ResizableModal
          title="Amend Shipment"
          isOpen={showAmendShipmentDialog}
          onClose={() => confirmCloseAmend(() => {
            setShowAmendShipmentDialog(false);
            setAmendingShipment(null);
            setAmendShipmentSelectedWeekDate(null);
            setAmendFormErrors({});
          })}
          initialWidth={650}
          minWidth={400}
          minHeight={400}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Supplier *
                </label>
                <input
                  type="text"
                  value={amendingShipment.supplier}
                  onChange={(e) => { handleAmendInputChange('supplier', e.target.value); setAmendFormErrors(prev => ({ ...prev, supplier: undefined })); }}
                  className="input"
                  style={{
                    width: '100%',
                    ...(amendFormErrors.supplier ? { border: '1px solid var(--danger)' } : {})
                  }}
                  placeholder="Supplier name"
                />
                {amendFormErrors.supplier && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px' }}>{amendFormErrors.supplier}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Order/Ref *
                </label>
                <input
                  type="text"
                  value={amendingShipment.orderRef}
                  onChange={(e) => { handleAmendInputChange('orderRef', e.target.value); setAmendFormErrors(prev => ({ ...prev, orderRef: undefined })); }}
                  className="input"
                  style={{
                    width: '100%',
                    ...(amendFormErrors.orderRef ? { border: '1px solid var(--danger)' } : {})
                  }}
                  placeholder="Order reference"
                />
                {amendFormErrors.orderRef && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px' }}>{amendFormErrors.orderRef}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Final POD *
                </label>
                <input
                  type="text"
                  value={amendingShipment.finalPod}
                  onChange={(e) => { handleAmendInputChange('finalPod', e.target.value); setAmendFormErrors(prev => ({ ...prev, finalPod: undefined })); }}
                  className="input"
                  style={{
                    width: '100%',
                    ...(amendFormErrors.finalPod ? { border: '1px solid var(--danger)' } : {})
                  }}
                  placeholder="Port of discharge"
                />
                {amendFormErrors.finalPod && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px' }}>{amendFormErrors.finalPod}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Status
                </label>
                <select
                  value={amendingShipment.latestStatus}
                  onChange={(e) => handleAmendInputChange('latestStatus', e.target.value)}
                  className="select"
                  style={{
                    width: '100%'
                  }}
                >
                  <option value="planned_airfreight">Planned Airfreight</option>
                  <option value="planned_seafreight">Planned Seafreight</option>
                  <option value="in_transit_airfreight">In Transit Airfreight</option>
                  <option value="air_customs_clearance">Air Customs Clearance Event</option>
                  <option value="in_transit_roadway">In Transit Roadway</option>
                  <option value="in_transit_seaway">In Transit Seaway</option>
                  <option value="moored">Moored</option>
                  <option value="berth_working">Berth Working</option>
                  <option value="berth_complete">Berth Complete</option>
                  <option value="gated_in_port">Gated In Port</option>
                  <option value="arrived_pta">Arrived PTA</option>
                  <option value="arrived_klm">Arrived KLM</option>
                  <option value="arrived_offsite">Arrived OffSite</option>
                  <optgroup label="Delayed">
                    <option value="delayed_port">Delayed - Port</option>
                    <option value="delayed_customs">Delayed - Customs</option>
                    <option value="delayed_documents">Delayed - Documents</option>
                    <option value="delayed_supplier">Delayed - Supplier</option>
                  </optgroup>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Week Number
                </label>
                <WeekCalendar
                  currentWeek={amendingShipment.weekNumber ? parseInt(amendingShipment.weekNumber) : null}
                  onWeekSelect={handleAmendShipmentWeekUpdate}
                  selectedWeekDate={amendShipmentSelectedWeekDate}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: '500', color: 'var(--text-900)' }}>
                    Products
                  </label>
                  <button
                    type="button"
                    onClick={() => setAmendProductLines(prev => [...prev, { name: '', qty: '' }])}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '2px 10px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      color: 'var(--primary)',
                      fontWeight: '600'
                    }}
                  >
                    + Add Product
                  </button>
                </div>
                {amendProductLines.map((line, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={line.name}
                      onChange={(e) => {
                        const updated = [...amendProductLines];
                        updated[idx] = { ...updated[idx], name: e.target.value };
                        setAmendProductLines(updated);
                      }}
                      className="input"
                      style={{ flex: 2 }}
                      placeholder="Product name"
                    />
                    <input
                      type="number"
                      value={line.qty}
                      onChange={(e) => {
                        const updated = [...amendProductLines];
                        updated[idx] = { ...updated[idx], qty: e.target.value };
                        setAmendProductLines(updated);
                      }}
                      className="input"
                      style={{ flex: 1 }}
                      placeholder="Qty"
                      min="0"
                    />
                    {amendProductLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setAmendProductLines(prev => prev.filter((_, i) => i !== idx))}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#d32f2f',
                          fontSize: '1.2rem',
                          padding: '0 4px',
                          lineHeight: 1
                        }}
                        title="Remove product"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Pallet Qty
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amendingShipment.palletQty || ''}
                  onChange={(e) => { handleAmendInputChange('palletQty', e.target.value); setAmendFormErrors(prev => ({ ...prev, palletQty: undefined })); }}
                  className="input"
                  style={{
                    width: '100%',
                    ...(amendFormErrors.palletQty ? { border: '1px solid var(--danger)' } : {})
                  }}
                  placeholder="Pallet quantity"
                  min="0"
                />
                {amendFormErrors.palletQty && <div style={{ color: 'var(--danger)', fontSize: '0.75rem', marginTop: '2px' }}>{amendFormErrors.palletQty}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Receiving Warehouse
                </label>
                <select
                  value={amendingShipment.receivingWarehouse || ''}
                  onChange={(e) => handleAmendInputChange('receivingWarehouse', e.target.value)}
                  className="select"
                  style={{
                    width: '100%'
                  }}
                >
                  <option value="">Select Warehouse</option>
                  <option value="PRETORIA">PRETORIA</option>
                  <option value="KLAPMUTS">KLAPMUTS</option>
                  <option value="OFFSITE">OFFSITE</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Forwarding Agent
                </label>
                <select
                  value={amendingShipment.forwardingAgent || ''}
                  onChange={(e) => handleAmendInputChange('forwardingAgent', e.target.value)}
                  className="select"
                  style={{
                    width: '100%'
                  }}
                >
                  <option value="">Select Forwarding Agent</option>
                  {getForwardingAgents(amendingShipment.latestStatus).map(agent => (
                    <option key={agent.value} value={agent.value}>{agent.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  {isAirfreight(amendingShipment.latestStatus) ? 'AWB Number' : 'Vessel Name'}
                </label>
                <input
                  type="text"
                  value={amendingShipment.vesselName || ''}
                  onChange={(e) => handleAmendInputChange('vesselName', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder={isAirfreight(amendingShipment.latestStatus) ? 'AWB number' : 'Vessel name'}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Incoterm
                </label>
                <select
                  value={amendingShipment.incoterm || ''}
                  onChange={(e) => handleAmendInputChange('incoterm', e.target.value)}
                  className="select"
                  style={{
                    width: '100%'
                  }}
                >
                  <option value="">Select Incoterm</option>
                  <option value="EXW">EXW - Ex Works</option>
                  <option value="FCA">FCA - Free Carrier</option>
                  <option value="CPT">CPT - Carriage Paid To</option>
                  <option value="CIP">CIP - Carriage and Insurance Paid To</option>
                  <option value="DAP">DAP - Delivered At Place</option>
                  <option value="DPU">DPU - Delivered At Place Unloaded</option>
                  <option value="DDP">DDP - Delivered Duty Paid</option>
                  <option value="FAS">FAS - Free Alongside Ship</option>
                  <option value="FOB">FOB - Free On Board</option>
                  <option value="CFR">CFR - Cost and Freight</option>
                  <option value="CIF">CIF - Cost, Insurance and Freight</option>
                </select>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Notes
                </label>
                <textarea
                  value={amendingShipment.notes || ''}
                  onChange={(e) => handleAmendInputChange('notes', e.target.value)}
                  className="input"
                  style={{
                    width: '100%',
                    minHeight: '80px',
                    resize: 'vertical'
                  }}
                  placeholder="Additional notes or comments"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Reminder Date
                </label>
                <input
                  type="date"
                  value={amendingShipment.reminderDate ? amendingShipment.reminderDate.split('T')[0] : ''}
                  onChange={(e) => handleAmendInputChange('reminderDate', e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: 'var(--text-900)' }}>
                  Reminder Note
                </label>
                <input
                  type="text"
                  value={amendingShipment.reminderNote || ''}
                  onChange={(e) => handleAmendInputChange('reminderNote', e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="e.g., Payment due, Follow up with supplier..."
                />
              </div>
            </div>

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
              marginTop: '2rem'
            }}>
              <button
                onClick={() => {
                  setShowAmendShipmentDialog(false);
                  setAmendingShipment(null);
                  setAmendShipmentSelectedWeekDate(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#545b62'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#6c757d'}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (await confirmAction({ title: 'Remove Shipment', message: 'Are you sure you want to remove this shipment? This action cannot be undone.', type: 'danger', confirmText: 'Remove' })) {
                    onDeleteShipment(amendingShipment.id);
                    setShowAmendShipmentDialog(false);
                    setAmendingShipment(null);
                    setAmendShipmentSelectedWeekDate(null);
                  }
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'var(--danger)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#c82333'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--danger)'}
              >
                Remove Shipment
              </button>
              <button
                onClick={handleSaveAmendment}
                disabled={!amendingShipment.supplier || !amendingShipment.orderRef || !amendingShipment.finalPod || Object.values(amendFormErrors).some(Boolean)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: (!amendingShipment.supplier || !amendingShipment.orderRef || !amendingShipment.finalPod || Object.values(amendFormErrors).some(Boolean)) ? '#6c757d' : 'var(--info)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (!amendingShipment.supplier || !amendingShipment.orderRef || !amendingShipment.finalPod || Object.values(amendFormErrors).some(Boolean)) ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (amendingShipment.supplier && amendingShipment.orderRef && amendingShipment.finalPod && !Object.values(amendFormErrors).some(Boolean)) {
                    e.target.style.backgroundColor = '#0056b3';
                  }
                }}
                onMouseLeave={(e) => {
                  if (amendingShipment.supplier && amendingShipment.orderRef && amendingShipment.finalPod && !Object.values(amendFormErrors).some(Boolean)) {
                    e.target.style.backgroundColor = 'var(--info)';
                  }
                }}
              >
                Save Changes
              </button>
            </div>

            <div style={{
              fontSize: '0.8rem',
              color: '#6c757d',
              marginTop: '1rem',
              fontStyle: 'italic'
            }}>
              * Required fields
            </div>
        </ResizableModal>
      )}

      {/* Archive Dialogs */}
      <ArchiveDialogs
        showAutoArchive={showAutoArchiveDialog}
        onCloseAutoArchive={() => setShowAutoArchiveDialog(false)}
        showManualArchive={showManualArchiveDialog}
        onCloseManualArchive={() => setShowManualArchiveDialog(false)}
        selectedShipments={selectedShipments}
        shipments={shipments}
        onArchiveComplete={() => {
          setSelectedShipments([]);
          window.location.reload();
        }}
      />

      {/* Bulk Status Update Modal */}
      {showBulkStatusUpdate && (
        <BulkStatusUpdate
          shipments={filteredAndSortedShipments}
          onBulkUpdate={handleBulkStatusUpdate}
          onClose={() => setShowBulkStatusUpdate(false)}
        />
      )}

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={showOrderDetailsModal}
        shipment={orderDetailsShipment}
        onClose={() => {
          setShowOrderDetailsModal(false);
          setOrderDetailsShipment(null);
        }}
      />
    </div>
  );
}

export default ShipmentTable;