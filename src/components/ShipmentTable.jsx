import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ShipmentStatus } from '../types/shipment';
import WeekCalendar from './WeekCalendar';
import BulkStatusUpdate from './BulkStatusUpdate';
import FilterPresetManager from './FilterPresetManager';
import ResizableModal from './ResizableModal';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { getApiUrl } from '../config/api';
import { authFetch } from '../utils/authFetch';
import filterPreferencesManager from '../utils/filterPreferences';

// Forwarding agent options for airfreight (major passenger airlines with cargo divisions)
const AIRFREIGHT_AGENTS = [
  { value: 'Emirates SkyCargo', label: 'Emirates SkyCargo' },
  { value: 'Qatar Airways Cargo', label: 'Qatar Airways Cargo' },
  { value: 'Lufthansa Cargo', label: 'Lufthansa Cargo' },
  { value: 'Singapore Airlines Cargo', label: 'Singapore Airlines Cargo' },
  { value: 'Korean Air Cargo', label: 'Korean Air Cargo' },
  { value: 'Turkish Airlines Cargo', label: 'Turkish Airlines Cargo' },
  { value: 'Cathay Pacific Cargo', label: 'Cathay Pacific Cargo' },
  { value: 'British Airways World Cargo', label: 'British Airways World Cargo' },
  { value: 'Air France-KLM Cargo', label: 'Air France-KLM Cargo' },
  { value: 'Ethiopian Airlines Cargo', label: 'Ethiopian Airlines Cargo' },
  { value: 'SAA Cargo', label: 'SAA Cargo' },
  { value: 'Kenya Airways Cargo', label: 'Kenya Airways Cargo' },
];

// Forwarding agent options for sea freight and other modes
const SEAFREIGHT_AGENTS = [
  { value: 'DHL', label: 'DHL' },
  { value: 'DSV', label: 'DSV' },
  { value: 'Afrigistics', label: 'Afrigistics' },
  { value: 'MSC', label: 'MSC' },
  { value: 'COSCO', label: 'COSCO' },
  { value: 'ONE', label: 'ONE' },
  { value: 'Hapag-Lloyd', label: 'Hapag-Lloyd' },
  { value: 'Maersk', label: 'Maersk' },
  { value: 'CMA CGM', label: 'CMA CGM' },
  { value: 'Evergreen', label: 'Evergreen' },
  { value: 'Yang Ming', label: 'Yang Ming' },
  { value: 'HMM', label: 'HMM' },
  { value: 'OOCL', label: 'OOCL' },
];

// Helper to check if status is airfreight-related
const isAirfreightStatus = (status) => {
  return status === 'planned_airfreight' || status === 'in_transit_airfreight' || status === 'air_customs_clearance';
};

// Get forwarding agents based on shipment status
const getForwardingAgents = (status) => {
  return isAirfreightStatus(status) ? AIRFREIGHT_AGENTS : SEAFREIGHT_AGENTS;
};

function ShipmentTable({ shipments, onUpdateShipment, onDeleteShipment, onCreateShipment, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(['all']);
  const [sortConfig, setSortConfig] = useState({ key: 'weekNumber', direction: 'asc' });
  const [showAddShipmentDialog, setShowAddShipmentDialog] = useState(false);
  const [showAmendShipmentDialog, setShowAmendShipmentDialog] = useState(false);
  const [localTextValues, setLocalTextValues] = useState({});
  const [amendingShipment, setAmendingShipment] = useState(null);
  const [showCustomSupplier, setShowCustomSupplier] = useState(false);
  const [newShipmentSelectedWeekDate, setNewShipmentSelectedWeekDate] = useState(null);
  const [amendShipmentSelectedWeekDate, setAmendShipmentSelectedWeekDate] = useState(null);
  const [showAutoArchiveDialog, setShowAutoArchiveDialog] = useState(false);
  const [autoArchiveStats, setAutoArchiveStats] = useState(null);
  const [autoArchiveLoading, setAutoArchiveLoading] = useState(false);
  const [autoArchiveDays, setAutoArchiveDays] = useState(30);
  const [showManualArchiveDialog, setShowManualArchiveDialog] = useState(false);
  const [selectedShipments, setSelectedShipments] = useState([]);
  const [manualArchiveLoading, setManualArchiveLoading] = useState(false);
  const [showBulkStatusUpdate, setShowBulkStatusUpdate] = useState(false);
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);
  const [edits, setEdits] = useState({}); // Track unsaved changes per shipment
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
    notes: ''
  });

  // Refs for debounced input timeouts
  const timeoutRefs = useRef({});

  const filteredAndSortedShipments = useMemo(() => {
    let filtered = shipments.filter(shipment => {
      const matchesSearch = searchTerm === '' ||
        shipment.orderRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.supplier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        shipment.finalPod?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter.includes('all') ||
        statusFilter.includes(shipment.latestStatus) ||
        (statusFilter.includes('arrived') && (shipment.latestStatus === ShipmentStatus.ARRIVED_PTA || shipment.latestStatus === ShipmentStatus.ARRIVED_KLM || shipment.latestStatus === ShipmentStatus.ARRIVED_OFFSITE));

      return matchesSearch && matchesStatus;
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
  }, [shipments, searchTerm, statusFilter, sortConfig]);

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
    return shipment.latestStatus === ShipmentStatus.DELAYED;
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Shipment Schedule Report', 14, 20);
    
    // Add generation date
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, 14, 30);
    
    // Add summary info
    doc.text(`Total Shipments: ${filteredAndSortedShipments.length}`, 14, 40);
    const delayedCount = filteredAndSortedShipments.filter(isDelayed).length;
    doc.text(`Delayed Shipments: ${delayedCount}`, 14, 47);
    
    if (searchTerm || !statusFilter.includes('all')) {
      let filterText = 'Applied Filters: ';
      if (searchTerm) filterText += `Search: "${searchTerm}"`;
      if (!statusFilter.includes('all')) {
        if (searchTerm) filterText += ', ';
        filterText += `Status: ${statusFilter.join(', ')}`;
      }
      doc.text(filterText, 14, 54);
    }
    
    // Prepare table data
    const tableData = filteredAndSortedShipments.map(shipment => [
      shipment.supplier,
      shipment.orderRef,
      shipment.finalPod,
      shipment.latestStatus.charAt(0).toUpperCase() + shipment.latestStatus.slice(1).replace('_', ' '),
      shipment.weekNumber || '-',
      shipment.productName || '-',
      shipment.quantity || '-',
      shipment.receivingWarehouse || '-',
      shipment.forwardingAgent || '-',
      shipment.vesselName || '-',
      shipment.incoterm || '-',
      shipment.palletQty || '-'
    ]);
    
    // Add table
    doc.autoTable({
      head: [[
        'Supplier',
        'Order/Ref',
        'Final POD',
        'Status',
        'Week #',
        'Product',
        'Quantity',
        'Warehouse',
        'Forwarding Agent',
        'Vessel Name',
        'Incoterm',
        'Pallet Qty'
      ]],
      body: tableData,
      startY: searchTerm || !statusFilter.includes('all') ? 60 : 53,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [102, 126, 234],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      columnStyles: {
        0: { cellWidth: 20 }, // Supplier
        1: { cellWidth: 25 }, // Order/Ref
        2: { cellWidth: 20 }, // Final POD
        3: { cellWidth: 18 }, // Status
        4: { cellWidth: 12 }, // Week #
        5: { cellWidth: 25 }, // Product
        6: { cellWidth: 15 }, // Quantity
        7: { cellWidth: 22 }, // Warehouse
        8: { cellWidth: 20 }, // Forwarding Agent
        9: { cellWidth: 12 }  // Pallet Qty
      },
      didParseCell: function(data) {
        // Highlight delayed shipments
        const shipment = filteredAndSortedShipments[data.row.index];
        if (shipment && isDelayed(shipment) && data.section === 'body') {
          data.cell.styles.fillColor = [255, 245, 245]; // Light red background
          data.cell.styles.textColor = [211, 47, 47]; // Dark red text
        }
      }
    });
    
    // Add footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Import Supply Chain Management - Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    // Save the PDF
    const fileName = `shipment-schedule-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  const generateExcel = () => {
    // Create worksheet data
    const worksheetData = [
      // Header row
      [
        'Supplier',
        'Order/Ref',
        'Final POD',
        'Latest Status',
        'Week Number',
        'Estimated Arrival',
        'Product',
        'Quantity',
        'Warehouse',
        'Forwarding Agent',
        'Vessel Name',
        'Incoterm',
        'Pallet Qty'
      ],
      // Data rows
      ...filteredAndSortedShipments.map(shipment => [
        shipment.supplier || '',
        shipment.orderRef || '',
        shipment.finalPod || '',
        shipment.latestStatus || '',
        shipment.weekNumber || '',
        shipment.estimatedArrival ? new Date(shipment.estimatedArrival).toLocaleDateString() : '',
        shipment.product || '',
        shipment.quantity || '',
        shipment.warehouse || '',
        shipment.forwardingAgent || '',
        shipment.vesselName || '',
        shipment.incoterm || '',
        shipment.palletQty || ''
      ])
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);

    // Set column widths
    const colWidths = [
      { wch: 20 }, // Supplier
      { wch: 15 }, // Order/Ref
      { wch: 15 }, // Final POD
      { wch: 15 }, // Latest Status
      { wch: 12 }, // Week Number
      { wch: 15 }, // Estimated Arrival
      { wch: 20 }, // Product
      { wch: 10 }, // Quantity
      { wch: 15 }, // Warehouse
      { wch: 18 }, // Forwarding Agent
      { wch: 12 }  // Pallet Qty
    ];
    ws['!cols'] = colWidths;

    // Add some basic styling to header row
    const headerRange = XLSX.utils.decode_range(ws['!ref']);
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "CCCCCC" } }
      };
    }

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Shipment Schedule');

    // Generate filename with current date
    const fileName = `shipment-schedule-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    // Save the file
    XLSX.writeFile(wb, fileName);
  };

  const handleAddShipment = async () => {
    if (!newShipment.supplier || !newShipment.orderRef || !newShipment.finalPod) {
      alert('Please fill in at least Supplier, Order/Ref, and Final POD fields.');
      return;
    }

    try {
      const shipmentData = {
        ...newShipment,
        quantity: newShipment.quantity ? Number(newShipment.quantity) : null,
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
      setShowCustomSupplier(false);
      setNewShipmentSelectedWeekDate(null);
      setShowAddShipmentDialog(false);
    } catch (error) {
      console.error('Error adding shipment:', error);
      alert('Failed to add shipment. Please try again.');
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
    setAmendShipmentSelectedWeekDate(shipment.selectedWeekDate ? new Date(shipment.selectedWeekDate) : null);
    setShowAmendShipmentDialog(true);
  };

  const handleAmendInputChange = (field, value) => {
    setAmendingShipment(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveAmendment = async () => {
    if (!amendingShipment.supplier || !amendingShipment.orderRef || !amendingShipment.finalPod) {
      alert('Please fill in at least Supplier, Order/Ref, and Final POD fields.');
      return;
    }

    try {
      const updatedShipment = {
        ...amendingShipment,
        quantity: amendingShipment.quantity ? Number(amendingShipment.quantity) : null,
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

      setShowAmendShipmentDialog(false);
      setAmendingShipment(null);
      setAmendShipmentSelectedWeekDate(null);
    } catch (error) {
      console.error('Error amending shipment:', error);
      alert('Failed to amend shipment. Please try again.');
    }
  };

  const fetchAutoArchiveStats = async () => {
    try {
      setAutoArchiveLoading(true);
      const response = await fetch(getApiUrl(`/api/shipments/auto-archive/stats?daysOld=${autoArchiveDays}`));
      if (response.ok) {
        const stats = await response.json();
        setAutoArchiveStats(stats);
      } else {
        console.error('Failed to fetch auto-archive stats');
      }
    } catch (error) {
      console.error('Error fetching auto-archive stats:', error);
    } finally {
      setAutoArchiveLoading(false);
    }
  };

  const performAutoArchive = async () => {
    if (!autoArchiveStats?.eligibleForArchive) {
      alert('No shipments eligible for auto-archive.');
      return;
    }

    if (!confirm(`Are you sure you want to archive ${autoArchiveStats.eligibleForArchive} old ARRIVED shipments?`)) {
      return;
    }

    try {
      setAutoArchiveLoading(true);
      const response = await fetch(getApiUrl('/api/shipments/auto-archive/perform'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ daysOld: autoArchiveDays }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully archived ${result.archivedCount} shipments to ${result.archiveFileName}`);
        setShowAutoArchiveDialog(false);
        setAutoArchiveStats(null);
        // Trigger a reload of shipments
        window.location.reload();
      } else {
        const error = await response.json();
        console.error('Failed to perform auto-archive:', error);
        alert('Failed to perform auto-archive. Please try again.');
      }
    } catch (error) {
      console.error('Error performing auto-archive:', error);
      alert('Error performing auto-archive. Please try again.');
    } finally {
      setAutoArchiveLoading(false);
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

  const handleClearSelection = () => {
    setSelectedShipments([]);
  };

  const performManualArchive = async () => {
    if (selectedShipments.length === 0) {
      alert('No shipments selected for archive.');
      setShowManualArchiveDialog(false);
      return;
    }

    const arrivedShipments = selectedShipments.filter(id => {
      const shipment = shipments.find(s => s.id === id);
      return shipment && (shipment.latestStatus === 'arrived_pta' || shipment.latestStatus === 'arrived_klm' || shipment.latestStatus === 'arrived_offsite');
    });

    if (arrivedShipments.length === 0) {
      alert('No ARRIVED shipments selected for archive.');
      setShowManualArchiveDialog(false);
      return;
    }

    try {
      setManualArchiveLoading(true);
      const response = await fetch(getApiUrl('/api/shipments/manual-archive'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shipmentIds: arrivedShipments }),
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Successfully archived ${result.archivedCount} shipments to ${result.archiveFileName}`);
        setShowManualArchiveDialog(false);
        setSelectedShipments([]);
        // Trigger a reload of shipments
        window.location.reload();
      } else {
        const error = await response.json();
        console.error('Failed to perform manual archive:', error);
        alert('Failed to perform manual archive. Please try again.');
      }
    } catch (error) {
      console.error('Error performing manual archive:', error);
      alert('Error performing manual archive. Please try again.');
    } finally {
      setManualArchiveLoading(false);
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
      alert(`Successfully updated ${shipmentIds.length} shipment(s) to ${newStatus.replace(/_/g, ' ').toUpperCase()}`);
    } catch (error) {
      console.error('Error updating shipments:', error);
      alert('Error updating shipments. Please try again.');
    } finally {
      setBulkUpdateLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading shipments...</div>;
  }

  return (
   <div className="shipments-table card">
      <div className="table-header">
        <h2>Shipment Schedule</h2>

        {/* Save All Button */}
        {unsavedCount > 0 && (
          <button
            onClick={saveAllChanges}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ff9800',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
            title={`Save ${unsavedCount} unsaved ${unsavedCount === 1 ? 'change' : 'changes'}`}
          >
            💾 Save All Changes ({unsavedCount})
          </button>
        )}

        <div className="table-controls" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="search-box">
            <input
              type="text"
              placeholder="Search shipments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input"
            />
            <div className="multi-select-container" style={{ position: 'relative' }}>
              <select
                multiple
                value={statusFilter}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  if (selected.includes('all')) {
                    setStatusFilter(['all']);
                  } else if (selected.length === 0) {
                    setStatusFilter(['all']);
                  } else {
                    setStatusFilter(selected);
                  }
                }}
                className="select"
                style={{
                  minHeight: '40px',
                  maxHeight: '120px',
                  overflowY: 'auto'
                }}
              >
                <option value="all">All Status</option>
                <option value={ShipmentStatus.PLANNED_AIRFREIGHT}>Planned Airfreight</option>
                <option value={ShipmentStatus.PLANNED_SEAFREIGHT}>Planned Seafreight</option>
                <option value={ShipmentStatus.IN_TRANSIT_AIRFREIGHT}>In Transit Airfreight</option>
                <option value={ShipmentStatus.AIR_CUSTOMS_CLEARANCE}>Air Customs Clearance Event</option>
                <option value={ShipmentStatus.IN_TRANSIT_ROADWAY}>In Transit Roadway</option>
                <option value={ShipmentStatus.IN_TRANSIT_SEAWAY}>In Transit Seaway</option>
                <option value={ShipmentStatus.MOORED}>Moored</option>
                <option value={ShipmentStatus.BERTH_WORKING}>Berth Working</option>
                <option value={ShipmentStatus.BERTH_COMPLETE}>Berth Complete</option>
                <option value={ShipmentStatus.ARRIVED_PTA}>Arrived PTA</option>
                <option value={ShipmentStatus.ARRIVED_KLM}>Arrived KLM</option>
                <option value={ShipmentStatus.ARRIVED_OFFSITE}>Arrived OffSite</option>
                <option value={ShipmentStatus.DELAYED}>Delayed</option>
                <option value={ShipmentStatus.CANCELLED}>Cancelled</option>
                <option value="arrived">Arrived (Combined)</option>
              </select>
              <div style={{
                fontSize: '0.8rem',
                color: '#666',
                marginTop: '2px',
                fontStyle: 'italic'
              }}>
                Hold Ctrl/Cmd to select multiple
              </div>
            </div>
          </div>

          {/* Quick Filter Buttons */}
          <div className="quick-filters" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={statusFilter.includes('all') ? 'btn btn-primary' : 'btn'}
              onClick={() => setStatusFilter(['all'])}
            >
              All ({shipments.length})
            </button>
            <button
              className={(statusFilter.includes(ShipmentStatus.ARRIVED_PTA) || statusFilter.includes(ShipmentStatus.ARRIVED_KLM) || statusFilter.includes(ShipmentStatus.ARRIVED_OFFSITE) || statusFilter.includes('arrived')) ? 'btn btn-success' : 'btn'}
              onClick={() => {
                if (statusFilter.includes('arrived') || statusFilter.includes(ShipmentStatus.ARRIVED_PTA) || statusFilter.includes(ShipmentStatus.ARRIVED_KLM) || statusFilter.includes(ShipmentStatus.ARRIVED_OFFSITE)) {
                  setStatusFilter(['all']);
                } else {
                  setStatusFilter(['arrived']);
                }
              }}
            >
              ✅ Arrived ({shipments.filter(s => s.latestStatus === ShipmentStatus.ARRIVED_PTA || s.latestStatus === ShipmentStatus.ARRIVED_KLM || s.latestStatus === ShipmentStatus.ARRIVED_OFFSITE).length})
            </button>
          </div>

          <FilterPresetManager
            viewName="shipments"
            currentFilters={{
              search: searchTerm,
              status: statusFilter
            }}
            onLoadPreset={(filters) => {
              if (filters.search) setSearchTerm(filters.search);
              if (filters.status) setStatusFilter(filters.status);
              // Auto-save to search history when loading
              filterPreferencesManager.addSearchHistory('shipments', filters.search || '');
            }}
            onSavePreset={(presetName) => {
              // Save search term to history when saving preset
              if (searchTerm) {
                filterPreferencesManager.addSearchHistory('shipments', searchTerm);
              }
            }}
          />

          <button
            className="btn btn-primary"
            onClick={() => setShowAddShipmentDialog(true)}
            title="Add new shipment to schedule"
          >
            ➕ Add Shipment
          </button>
          <button
            className="btn btn-danger"
            onClick={generatePDF}
            disabled={filteredAndSortedShipments.length === 0}
            title="Export shipment schedule to PDF"
          >
            📄 Print PDF
          </button>
          <button
            className="btn btn-info"
            onClick={generateExcel}
            disabled={filteredAndSortedShipments.length === 0}
            title="Export shipment schedule to Excel"
          >
            📊 Print Excel
          </button>
          <button
            className="btn btn-accent"
            onClick={() => setShowAutoArchiveDialog(true)}
            title="Auto-archive old ARRIVED shipments"
          >
            📁 Auto-Archive
          </button>
          <button
            className="btn btn-info"
            onClick={() => setShowManualArchiveDialog(true)}
            disabled={selectedShipments.length === 0}
            title="Manually select and archive ARRIVED shipments"
          >
            🗂️ Manual Archive
          </button>
          <button
            className="btn btn-warning"
            onClick={() => setShowBulkStatusUpdate(true)}
            disabled={filteredAndSortedShipments.length === 0}
            title="Bulk update status for multiple shipments"
          >
            📋 Bulk Status Update
          </button>
        </div>
      </div>

      <div style={{
        overflow: 'auto',
        maxHeight: 'calc(100vh - 280px)',
        position: 'relative'
      }}>
        <table className="table" style={{ minWidth: '1200px' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
            <tr>
              <th style={{ width: '40px', textAlign: 'center', backgroundColor: '#f8f9fa' }}>
                <input
                  type="checkbox"
                  checked={selectedShipments.length > 0 && selectedShipments.length === filteredAndSortedShipments.filter(s => s.latestStatus === 'arrived_pta' || s.latestStatus === 'arrived_klm' || s.latestStatus === 'arrived_offsite').length}
                  onChange={(e) => e.target.checked ? handleSelectAllArrived() : handleClearSelection()}
                  title="Select all ARRIVED shipments"
                />
              </th>
              <th onClick={() => handleSort('supplier')} style={{ cursor: 'pointer' }}>
                SUPPLIER {sortConfig.key === 'supplier' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('orderRef')} style={{ cursor: 'pointer' }}>
                ORDER/REF {sortConfig.key === 'orderRef' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('finalPod')} style={{ cursor: 'pointer' }}>
                FINAL POD {sortConfig.key === 'finalPod' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('latestStatus')} style={{ cursor: 'pointer' }}>
                LATEST STATUS {sortConfig.key === 'latestStatus' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('weekNumber')} style={{ cursor: 'pointer' }}>
                WEEK NUMBER {sortConfig.key === 'weekNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('palletQty')} style={{ cursor: 'pointer' }}>
                PALLET QTY {sortConfig.key === 'palletQty' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('vesselName')} style={{ cursor: 'pointer' }}>
                VESSEL NAME {sortConfig.key === 'vesselName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('incoterm')} style={{ cursor: 'pointer' }}>
                INCOTERM {sortConfig.key === 'incoterm' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('forwardingAgent')} style={{ cursor: 'pointer' }}>
                FORWARDING AGENT {sortConfig.key === 'forwardingAgent' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedShipments.length === 0 ? (
              <tr>
                <td colSpan="11" style={{ textAlign: 'center', padding: '2rem' }}>
                  No shipments found
                </td>
              </tr>
            ) : (
              filteredAndSortedShipments.map(shipment => (
                <tr key={shipment.id} style={{ backgroundColor: isDelayed(shipment) ? '#fff5f5' : 'white' }}>
                  <td style={{ width: '40px', textAlign: 'center' }}>
                    {(shipment.latestStatus === 'arrived_pta' || shipment.latestStatus === 'arrived_klm' || shipment.latestStatus === 'arrived_offsite') && (
                      <input
                        type="checkbox"
                        checked={selectedShipments.includes(shipment.id)}
                        onChange={(e) => handleShipmentSelect(shipment.id, e.target.checked)}
                        title="Select for manual archive"
                      />
                    )}
                  </td>
                  <td>
                    <strong>{shipment.supplier}</strong>
                  </td>
                  <td>
                    {shipment.orderRef}
                    {isDelayed(shipment) && <span style={{ color: '#d32f2f', marginLeft: '0.5rem' }}>⚠️</span>}
                  </td>
                  <td>{shipment.finalPod}</td>
                  <td>
                    <select
                      value={shipment.latestStatus}
                      onChange={(e) => handleStatusUpdate(shipment.id, e.target.value)}
                      className={`select status-badge status-${shipment.latestStatus}`}
                      style={{
                        borderRadius: '20px',
                        padding: '4px 12px',
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        textTransform: 'uppercase',
                        minWidth: '100px'
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
                      <option value={ShipmentStatus.ARRIVED_PTA}>Arrived PTA</option>
                      <option value={ShipmentStatus.ARRIVED_KLM}>Arrived KLM</option>
                      <option value={ShipmentStatus.ARRIVED_OFFSITE}>Arrived OffSite</option>
                      <option value={ShipmentStatus.DELAYED}>Delayed</option>
                      <option value={ShipmentStatus.CANCELLED}>Cancelled</option>
                    </select>
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
                      value={(localTextValues[`${shipment.id}-palletQty`] ?? shipment.palletQty) || ''}
                      onChange={(e) => handleTextInputChange(shipment.id, 'palletQty', e.target.value)}
                      placeholder="Pallet Qty"
                      className="input"
                      style={{
                        minWidth: '80px',
                        border: edits[shipment.id]?.palletQty !== undefined ? '2px solid #ff9800' : undefined,
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
                        placeholder="Vessel Name"
                        className="input"
                        style={{
                          minWidth: '120px',
                          flex: 1,
                          border: edits[shipment.id]?.vesselName !== undefined ? '2px solid #ff9800' : undefined,
                          backgroundColor: edits[shipment.id]?.vesselName !== undefined ? '#fff3e0' : undefined,
                        }}
                      />
                      {shipment.vesselName && (
                        <a
                          href={`https://www.vesselfinder.com/vessels?name=${encodeURIComponent(shipment.vesselName)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Track vessel on VesselFinder"
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
                        border: edits[shipment.id]?.incoterm !== undefined ? '2px solid #ff9800' : undefined,
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
                        border: edits[shipment.id]?.forwardingAgent !== undefined ? '2px solid #ff9800' : undefined,
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
                            backgroundColor: '#4caf50',
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
      
      {/* Add Shipment Dialog */}
      {showAddShipmentDialog && (
        <ResizableModal
          title="Add New Shipment"
          isOpen={showAddShipmentDialog}
          onClose={() => {
            setShowCustomSupplier(false);
            setNewShipmentSelectedWeekDate(null);
            setShowAddShipmentDialog(false);
          }}
          initialWidth={650}
          minWidth={400}
          minHeight={400}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Supplier *
                </label>
                {!showCustomSupplier ? (
                  <select
                    value={newShipment.supplier}
                    onChange={(e) => handleSupplierChange(e.target.value)}
                    className="select"
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
                      onChange={(e) => handleInputChange('supplier', e.target.value)}
                      className="input"
                      style={{
                        flex: 1
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
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Order/Ref *
                </label>
                <input
                  type="text"
                  value={newShipment.orderRef}
                  onChange={(e) => handleInputChange('orderRef', e.target.value)}
                  className="input"
                  placeholder="Order reference"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Final POD *
                </label>
                <input
                  type="text"
                  value={newShipment.finalPod}
                  onChange={(e) => handleInputChange('finalPod', e.target.value)}
                  className="input"
                  placeholder="Port of discharge"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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
                  <option value="in_transit">In Transit</option>
                  <option value="arrived">Arrived</option>
                  <option value="delayed">Delayed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Week Number
                </label>
                <WeekCalendar
                  currentWeek={newShipment.weekNumber ? parseInt(newShipment.weekNumber) : null}
                  onWeekSelect={handleNewShipmentWeekUpdate}
                  selectedWeekDate={newShipmentSelectedWeekDate}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Product Name
                </label>
                <input
                  type="text"
                  value={newShipment.productName}
                  onChange={(e) => handleInputChange('productName', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Product name"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Quantity
                </label>
                <input
                  type="number"
                  value={newShipment.quantity}
                  onChange={(e) => handleInputChange('quantity', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Quantity"
                  min="0"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#666' }}>
                  CBM (Cubic Meters) <span style={{ color: '#999', fontSize: '0.85em' }}>Optional</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newShipment.cbm}
                  onChange={(e) => handleInputChange('cbm', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Cubic meters (optional)"
                  min="0"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Pallet Qty
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newShipment.palletQty}
                  onChange={(e) => handleInputChange('palletQty', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Pallet quantity"
                  min="0"
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Vessel Name
                </label>
                <input
                  type="text"
                  value={newShipment.vesselName}
                  onChange={(e) => handleInputChange('vesselName', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Vessel name"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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
                disabled={!newShipment.supplier || !newShipment.orderRef || !newShipment.finalPod}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: (!newShipment.supplier || !newShipment.orderRef || !newShipment.finalPod) ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (!newShipment.supplier || !newShipment.orderRef || !newShipment.finalPod) ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (newShipment.supplier && newShipment.orderRef && newShipment.finalPod) {
                    e.target.style.backgroundColor = '#218838';
                  }
                }}
                onMouseLeave={(e) => {
                  if (newShipment.supplier && newShipment.orderRef && newShipment.finalPod) {
                    e.target.style.backgroundColor = '#28a745';
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
          onClose={() => {
            setShowAmendShipmentDialog(false);
            setAmendingShipment(null);
            setAmendShipmentSelectedWeekDate(null);
          }}
          initialWidth={650}
          minWidth={400}
          minHeight={400}
        >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Supplier *
                </label>
                <input
                  type="text"
                  value={amendingShipment.supplier}
                  onChange={(e) => handleAmendInputChange('supplier', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Supplier name"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Order/Ref *
                </label>
                <input
                  type="text"
                  value={amendingShipment.orderRef}
                  onChange={(e) => handleAmendInputChange('orderRef', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Order reference"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Final POD *
                </label>
                <input
                  type="text"
                  value={amendingShipment.finalPod}
                  onChange={(e) => handleAmendInputChange('finalPod', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Port of discharge"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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
                  <option value="in_transit">In Transit</option>
                  <option value="arrived">Arrived</option>
                  <option value="delayed">Delayed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Week Number
                </label>
                <WeekCalendar
                  currentWeek={amendingShipment.weekNumber ? parseInt(amendingShipment.weekNumber) : null}
                  onWeekSelect={handleAmendShipmentWeekUpdate}
                  selectedWeekDate={amendShipmentSelectedWeekDate}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Product Name
                </label>
                <input
                  type="text"
                  value={amendingShipment.productName || ''}
                  onChange={(e) => handleAmendInputChange('productName', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Product name"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Quantity
                </label>
                <input
                  type="number"
                  value={amendingShipment.quantity || ''}
                  onChange={(e) => handleAmendInputChange('quantity', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Quantity"
                  min="0"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Pallet Qty
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={amendingShipment.palletQty || ''}
                  onChange={(e) => handleAmendInputChange('palletQty', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Pallet quantity"
                  min="0"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                  Vessel Name
                </label>
                <input
                  type="text"
                  value={amendingShipment.vesselName || ''}
                  onChange={(e) => handleAmendInputChange('vesselName', e.target.value)}
                  className="input"
                  style={{
                    width: '100%'
                  }}
                  placeholder="Vessel name"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
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
                onClick={() => {
                  if (window.confirm('Are you sure you want to remove this shipment? This action cannot be undone.')) {
                    onDeleteShipment(amendingShipment.id);
                    setShowAmendShipmentDialog(false);
                    setAmendingShipment(null);
                    setAmendShipmentSelectedWeekDate(null);
                  }
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#c82333'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#dc3545'}
              >
                Remove Shipment
              </button>
              <button
                onClick={handleSaveAmendment}
                disabled={!amendingShipment.supplier || !amendingShipment.orderRef || !amendingShipment.finalPod}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: (!amendingShipment.supplier || !amendingShipment.orderRef || !amendingShipment.finalPod) ? '#6c757d' : '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: (!amendingShipment.supplier || !amendingShipment.orderRef || !amendingShipment.finalPod) ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  transition: 'background-color 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (amendingShipment.supplier && amendingShipment.orderRef && amendingShipment.finalPod) {
                    e.target.style.backgroundColor = '#0056b3';
                  }
                }}
                onMouseLeave={(e) => {
                  if (amendingShipment.supplier && amendingShipment.orderRef && amendingShipment.finalPod) {
                    e.target.style.backgroundColor = '#007bff';
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

      {/* Auto-Archive Dialog */}
      {showAutoArchiveDialog && (
        <ResizableModal
          title="Auto-Archive Old ARRIVED Shipments"
          isOpen={showAutoArchiveDialog}
          onClose={() => {
            setShowAutoArchiveDialog(false);
            setAutoArchiveStats(null);
          }}
          initialWidth={600}
          minWidth={400}
          minHeight={300}
        >
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
                Archive shipments older than (days):
              </label>
              <input
                type="number"
                value={autoArchiveDays}
                onChange={(e) => setAutoArchiveDays(parseInt(e.target.value) || 30)}
                className="input"
                style={{
                  width: '100px'
                }}
                min="1"
                max="365"
              />
              <span style={{ marginLeft: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
                days
              </span>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <button
                onClick={fetchAutoArchiveStats}
                disabled={autoArchiveLoading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: autoArchiveLoading ? '#ccc' : '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: autoArchiveLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {autoArchiveLoading ? '🔄 Loading...' : '🔍 Check Eligible Shipments'}
              </button>
            </div>

            {autoArchiveStats && (
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '1px solid #e9ecef'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#333' }}>Archive Statistics</h4>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Eligible for archive:</strong> {autoArchiveStats.eligibleForArchive} shipments
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <strong>Total ARRIVED:</strong> {autoArchiveStats.totalArrived} shipments
                </div>

                {autoArchiveStats.eligibleShipments.length > 0 && (
                  <div>
                    <h5 style={{ margin: '0 0 0.5rem 0', color: '#666' }}>Shipments to be archived:</h5>
                    <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                      {autoArchiveStats.eligibleShipments.map((shipment, index) => (
                        <div key={index} style={{
                          padding: '0.5rem',
                          backgroundColor: 'white',
                          border: '1px solid #e9ecef',
                          borderRadius: '4px',
                          marginBottom: '0.25rem',
                          fontSize: '0.85rem'
                        }}>
                          <div><strong>{shipment.supplier}</strong> - {shipment.orderRef}</div>
                          <div style={{ color: '#666' }}>
                            Arrived: {new Date(shipment.arrivedDate).toLocaleDateString()}
                            ({shipment.daysOld} days ago)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowAutoArchiveDialog(false);
                  setAutoArchiveStats(null);
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

              {autoArchiveStats?.eligibleForArchive > 0 && (
                <button
                  onClick={performAutoArchive}
                  disabled={autoArchiveLoading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: autoArchiveLoading ? '#ccc' : '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: autoArchiveLoading ? 'not-allowed' : 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  {autoArchiveLoading ? '🔄 Archiving...' : `📁 Archive ${autoArchiveStats.eligibleForArchive} Shipments`}
                </button>
              )}
            </div>
        </ResizableModal>
      )}

      {/* Manual Archive Dialog */}
      {showManualArchiveDialog && (
        <ResizableModal
          title="Manual Archive Confirmation"
          isOpen={showManualArchiveDialog}
          onClose={() => setShowManualArchiveDialog(false)}
          initialWidth={500}
          minWidth={350}
          minHeight={250}
        >
            <p>
              You are about to archive <strong>{selectedShipments.length}</strong> selected ARRIVED shipments.
              This action cannot be undone.
            </p>
            <p>The shipments will be removed from the active list and saved to an archive file.</p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button
                onClick={() => setShowManualArchiveDialog(false)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #ccc',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                disabled={manualArchiveLoading}
              >
                Cancel
              </button>
              <button
                onClick={performManualArchive}
                disabled={manualArchiveLoading}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#17a2b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: manualArchiveLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {manualArchiveLoading ? '🔄 Archiving...' : `📁 Archive ${selectedShipments.length} Shipments`}
              </button>
            </div>
        </ResizableModal>
      )}

      {/* Bulk Status Update Modal */}
      {showBulkStatusUpdate && (
        <BulkStatusUpdate
          shipments={filteredAndSortedShipments}
          onBulkUpdate={handleBulkStatusUpdate}
          onClose={() => setShowBulkStatusUpdate(false)}
        />
      )}
    </div>
  );
}

export default ShipmentTable;