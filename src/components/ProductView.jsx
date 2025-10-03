import React, { useState, useMemo, useCallback } from 'react';
import WeekCalendar from './WeekCalendar';
import IncomingProductsChart from './IncomingProductsChart';
import CurrentWeekStoredReport from './CurrentWeekStoredReport';
import * as XLSX from 'xlsx';
import { ShipmentStatus } from '../types/shipment';

function ProductView({ shipments, onUpdateShipment, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'weekNumber', direction: 'asc' });
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // local edit buffer so we only commit on blur / Enter
  const [edits, setEdits] = useState({}); // { [id]: { quantity?, palletQty?, receivingWarehouse? } }

  const normStr = (v) => (v ?? '').toString().toLowerCase();
  const normNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const labelForKey = (k) =>
    ({
      productName: 'Product',
      quantity: 'Quantity',
      palletQty: 'Pallet Qty',
      receivingWarehouse: 'Receiving Warehouse',
      weekNumber: 'ETA Week',
    }[k] || k);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const clearSort = () => setSortConfig({ key: null, direction: 'asc' });

  const handleQuantityUpdate = useCallback(
    (shipmentId, newQuantity) => {
      onUpdateShipment(shipmentId, { quantity: Number(newQuantity) || 0 });
    },
    [onUpdateShipment]
  );

  const handlePalletQtyUpdate = useCallback(
    (shipmentId, newPalletQty) => {
      onUpdateShipment(shipmentId, { palletQty: Number(newPalletQty) || 0 });
    },
    [onUpdateShipment]
  );

  const handleWarehouseUpdate = useCallback(
    (shipmentId, newWarehouse) => {
      onUpdateShipment(shipmentId, { receivingWarehouse: newWarehouse });
    },
    [onUpdateShipment]
  );

  const handleWeekUpdate = useCallback(
    (shipmentId, newWeekNumber) => {
      onUpdateShipment(shipmentId, { weekNumber: Number(newWeekNumber) || 0 });
    },
    [onUpdateShipment]
  );

  const handleWarehouseCardClick = useCallback((warehouse) => {
    // Toggle between selected warehouse and "all"
    setSelectedWarehouse(prevSelected => 
      prevSelected === warehouse ? 'all' : warehouse
    );
  }, []);


  // Edit buffer helpers
  const setEdit = (id, field, value) =>
    setEdits((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));

  const cancelEdit = (id, field) =>
    setEdits((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev[id] };
      delete next[field];
      const copy = { ...prev, [id]: next };
      if (Object.keys(next).length === 0) delete copy[id];
      return copy;
    });

  const commitEdit = (shipment, field) => {
    const pending = edits[shipment.id]?.[field];
    if (pending === undefined) return; // nothing to commit
    if (field === 'quantity') handleQuantityUpdate(shipment.id, pending);
    else if (field === 'palletQty') handlePalletQtyUpdate(shipment.id, pending);
    else if (field === 'receivingWarehouse') handleWarehouseUpdate(shipment.id, pending);
    cancelEdit(shipment.id, field);
  };

  // Save all changes for a specific shipment
  const saveShipment = (shipmentId) => {
    const changes = edits[shipmentId];
    if (!changes || Object.keys(changes).length === 0) return;

    const updates = {};
    if (changes.quantity !== undefined) updates.quantity = Number(changes.quantity) || 0;
    if (changes.palletQty !== undefined) updates.palletQty = Number(changes.palletQty) || 0;
    if (changes.receivingWarehouse !== undefined) updates.receivingWarehouse = changes.receivingWarehouse;

    onUpdateShipment(shipmentId, updates);

    // Clear edits for this shipment
    setEdits((prev) => {
      const copy = { ...prev };
      delete copy[shipmentId];
      return copy;
    });
  };

  // Save all pending changes
  const saveAllChanges = () => {
    Object.keys(edits).forEach((shipmentId) => {
      saveShipment(shipmentId);
    });
  };

  // Count unsaved changes
  const unsavedCount = Object.keys(edits).length;

  const onFieldKeyDown = (e, shipment, field) => {
    if (e.key === 'Enter') {
      // Just blur, don't save automatically
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      // revert
      cancelEdit(shipment.id, field);
      // restore displayed value to original
      e.currentTarget.value =
        field === 'quantity'
          ? normNum(shipment.quantity)
          : field === 'palletQty'
          ? normNum(shipment.palletQty)
          : shipment.receivingWarehouse || '';
      e.currentTarget.blur();
    }
  };

  const filteredAndSortedProducts = useMemo(() => {
    const s = normStr(searchTerm);
    const input = Array.isArray(shipments) ? shipments : [];

    const filtered = input.filter((sh) => {
      // Exclude stored shipments from ETA Week view
      const notStored = sh.latestStatus !== ShipmentStatus.STORED;

      const matchesSearch =
        s === '' ||
        normStr(sh.productName).includes(s) ||
        normStr(sh.receivingWarehouse).includes(s) ||
        normStr(sh.supplier).includes(s) ||
        normStr(sh.orderRef).includes(s);

      const matchesWarehouse =
        selectedWarehouse === 'all' ||
        (sh.receivingWarehouse || 'Unassigned') === selectedWarehouse;

      const matchesStatus = statusFilter === 'all' ||
        sh.latestStatus === statusFilter ||
        (statusFilter === 'arrived' && (sh.latestStatus === ShipmentStatus.ARRIVED_PTA || sh.latestStatus === ShipmentStatus.ARRIVED_KLM));

      return notStored && matchesSearch && matchesWarehouse && matchesStatus;
    });

    if (!sortConfig.key) return filtered;

    const key = sortConfig.key;
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    const numericKeys = new Set(['quantity', 'palletQty', 'weekNumber']);

    const toComparable = (item) => {
      const val = item?.[key];
      if (val === null || val === undefined) return { isNull: true, v: 0 };
      return numericKeys.has(key)
        ? { isNull: false, v: normNum(val) }
        : { isNull: false, v: normStr(val) };
    };

    return [...filtered].sort((a, b) => {
      const A = toComparable(a);
      const B = toComparable(b);
      if (A.isNull && !B.isNull) return 1;
      if (!A.isNull && B.isNull) return -1;
      if (A.isNull && B.isNull) return 0;

      if (numericKeys.has(key)) {
        return (A.v - B.v) * dir;
      }
      const cmp = A.v.localeCompare(B.v);
      return cmp * dir;
    });
  }, [shipments, searchTerm, sortConfig, selectedWarehouse, statusFilter]);

  const handleExportToExcel = useCallback(() => {
    try {
      // Create a 2D array for the data
      const worksheetData = [];

      // Define current date and time
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      // Add title and metadata rows
      worksheetData.push(['SYNERCORE IMPORT CAPACITY PLANNER']);
      worksheetData.push(['Product & Warehouse Report']);
      worksheetData.push([`Generated: ${dateStr} at ${timeStr}`]);
      worksheetData.push([]);
      
      // Add summary statistics
      const totalQuantity = filteredAndSortedProducts.reduce((sum, p) => sum + normNum(p.quantity), 0);
      const totalPalletQty = filteredAndSortedProducts.reduce((sum, p) => sum + normNum(p.palletQty), 0);
      const uniqueWarehouses = new Set(filteredAndSortedProducts.map(p => p.receivingWarehouse || 'Unassigned')).size;

      worksheetData.push([`Total Products: ${filteredAndSortedProducts.length}`, '', `Total Quantity: ${totalQuantity}`, '', `Total Pallet Qty: ${totalPalletQty}`, '', `Warehouses: ${uniqueWarehouses}`]);
      
      if (selectedWarehouse !== 'all') {
        worksheetData.push([`Filtered by Warehouse: ${selectedWarehouse}`]);
      }
      if (searchTerm) {
        worksheetData.push([`Search Filter: "${searchTerm}"`]);
      }
      worksheetData.push([]);

      // Table headers
      const headers = [
        'Product Name',
        'Quantity', 
        'Pallet Qty',
        'Receiving Warehouse',
        'Week ETA',
        'Supplier',
        'Order/Ref',
        'Status',
        'Final POD',
        'Notes'
      ];
      worksheetData.push(headers);

      // Add separator row for visual clarity
      worksheetData.push(Array(headers.length).fill('─'));

      // Add product data with color indicators for status
      filteredAndSortedProducts.forEach((shipment, index) => {
        const statusIndicator = shipment.latestStatus === 'delayed' ? '⚠️ ' : 
                               shipment.latestStatus === 'arrived' ? '✅ ' :
                               shipment.latestStatus === 'cancelled' ? '❌ ' :
                               shipment.latestStatus === 'in_transit' ? '🚚 ' : '';
        
        worksheetData.push([
          shipment.productName || '',
          normNum(shipment.quantity),
          normNum(shipment.palletQty),
          shipment.receivingWarehouse || 'Unassigned',
          `Week ${normNum(shipment.weekNumber)}`,
          shipment.supplier || '',
          shipment.orderRef || '',
          `${statusIndicator}${(shipment.latestStatus || '').replace('_', ' ').toUpperCase()}`,
          shipment.finalPod || '',
          shipment.notes || ''
        ]);
      });

      // Add footer totals
      worksheetData.push(Array(headers.length).fill('─'));
      worksheetData.push([
        'TOTALS:',
        totalQuantity,
        totalPalletQty,
        `${uniqueWarehouses} warehouses`,
        '',
        '',
        '',
        `${filteredAndSortedProducts.length} products`,
        '',
        ''
      ]);

      // Create worksheet
      const ws = XLSX.utils.aoa_to_sheet(worksheetData);

      // Set column widths for better readability
      ws['!cols'] = [
        { wch: 35 }, // Product Name
        { wch: 10 }, // Quantity  
        { wch: 12 }, // Pallet Qty
        { wch: 25 }, // Receiving Warehouse
        { wch: 12 }, // Week ETA
        { wch: 25 }, // Supplier
        { wch: 18 }, // Order/Ref
        { wch: 18 }, // Status
        { wch: 18 }, // Final POD
        { wch: 40 }  // Notes
      ];

      // Create data table range (excluding headers and footers)
      const headerRowIndex = 8; // The row with column headers (0-indexed)
      const dataStartRow = headerRowIndex + 2; // Skip header and separator
      const dataEndRow = dataStartRow + filteredAndSortedProducts.length - 1;
      
      // Add table format (works with standard xlsx)
      ws['!autofilter'] = { ref: `A${headerRowIndex + 1}:J${dataEndRow + 1}` };

      // Freeze header rows
      ws['!freeze'] = { xSplit: 0, ySplit: headerRowIndex + 2 };

      // Create workbook and add worksheet
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Product Warehouse Report');

      // Add a summary worksheet
      const summaryData = [
        ['IMPORT CAPACITY SUMMARY'],
        [''],
        ['Key Metrics'],
        ['Total Products:', filteredAndSortedProducts.length],
        ['Total Quantity:', totalQuantity],
        ['Total Pallet Qty:', totalPalletQty],
        ['Unique Warehouses:', uniqueWarehouses],
        [''],
        ['Status Breakdown'],
      ];

      // Calculate status counts
      const statusCounts = {};
      filteredAndSortedProducts.forEach(p => {
        const status = (p.latestStatus || 'unknown').replace('_', ' ').toUpperCase();
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      Object.entries(statusCounts).forEach(([status, count]) => {
        const indicator = status === 'DELAYED' ? '⚠️' :
                         (status === 'ARRIVED_PTA' || status === 'ARRIVED_KLM') ? '✅' :
                         status === 'CANCELLED' ? '❌' :
                         (status === 'IN_TRANSIT_ROADWAY' || status === 'IN_TRANSIT_SEAWAY') ? '🚚' :
                         status === 'MOORED' ? '⚓' :
                         (status === 'BERTH_WORKING' || status === 'BERTH_COMPLETE') ? '🚢' : '📋';
        summaryData.push([`${indicator} ${status}:`, count]);
      });

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 25 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      // Generate filename
      const dateForFile = now.toISOString().split('T')[0];
      const timeForFile = now.toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `Synercore_Import_Report_${dateForFile}_${timeForFile}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);
      
      alert(`Excel report exported successfully!\nFile: ${filename}\nContains: ${filteredAndSortedProducts.length} products across ${uniqueWarehouses} warehouses`);
    } catch (error) {
      console.error('Error exporting Excel report:', error);
      alert('Failed to export report to Excel. Please check your browser settings and try again.');
    }
  }, [filteredAndSortedProducts, normNum, selectedWarehouse, searchTerm]);

  const warehouseTotals = useMemo(() => {
    const totals = {};
    console.log('🔍 WAREHOUSE TOTALS - Total shipments to process:', (shipments || []).length);

    (shipments || []).forEach((sh) => {
      // Only exclude STORED shipments (they're shown separately in Warehouse Stored view)
      if (sh.latestStatus === ShipmentStatus.STORED) {
        console.log('❌ FILTERED OUT (stored):', sh.orderRef);
        return;
      }

      const warehouse = sh.receivingWarehouse || 'Unassigned';
      const palletQty = normNum(sh.palletQty);
      totals[warehouse] = (totals[warehouse] || 0) + palletQty;

      console.log('✅ INCLUDED:', sh.orderRef, 'warehouse:', warehouse, 'palletQty:', palletQty, 'running total:', totals[warehouse]);
    });

    console.log('🏁 FINAL WAREHOUSE TOTALS:', totals);
    return totals;
  }, [shipments]);

  if (loading) {
    return <div className="loading">Loading products...</div>;
  }

  return (
    <div className="product-view">
      <div className="table-header" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <h2 style={{ marginRight: 'auto' }}>Product & Warehouse View</h2>

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

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="search-box" style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search products or warehouses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              style={{ paddingRight: 28 }}
            />
            {searchTerm && (
              <button
                aria-label="Clear search"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 4,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>

          {/* Quick Status Filter Buttons */}
          <div className="quick-filters" style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '6px 10px',
                backgroundColor: statusFilter === 'all' ? '#007bff' : '#f8f9fa',
                color: statusFilter === 'all' ? 'white' : '#495057',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: statusFilter === 'all' ? '600' : '400',
                transition: 'all 0.2s ease'
              }}
            >
              All ({shipments.length})
            </button>
            <button
              onClick={() => setStatusFilter('arrived')}
              style={{
                padding: '6px 10px',
                backgroundColor: (statusFilter === ShipmentStatus.ARRIVED_PTA || statusFilter === ShipmentStatus.ARRIVED_KLM || statusFilter === 'arrived') ? '#28a745' : '#f8f9fa',
                color: (statusFilter === ShipmentStatus.ARRIVED_PTA || statusFilter === ShipmentStatus.ARRIVED_KLM || statusFilter === 'arrived') ? 'white' : '#495057',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.75rem',
                fontWeight: (statusFilter === ShipmentStatus.ARRIVED_PTA || statusFilter === ShipmentStatus.ARRIVED_KLM || statusFilter === 'arrived') ? '600' : '400',
                transition: 'all 0.2s ease'
              }}
            >
              ✅ Arrived ({shipments.filter(s => s.latestStatus === ShipmentStatus.ARRIVED_PTA || s.latestStatus === ShipmentStatus.ARRIVED_KLM).length})
            </button>
          </div>

          <button
            onClick={handleExportToExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 16px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#45a049';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#4caf50';
              e.target.style.transform = 'none';
            }}
            title={`Export ${filteredAndSortedProducts.length} products to Excel`}
          >
            📊 Export to Excel
          </button>
        </div>

        {sortConfig.key && (
          <div
            className="sort-chip"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 999,
              background: '#f2f4f7',
              fontSize: 12,
              color: '#344054',
            }}
          >
            <span>
              Sorting by <strong>{labelForKey(sortConfig.key)}</strong> ({sortConfig.direction})
            </span>
            <button
              onClick={clearSort}
              style={{
                border: 'none',
                background: '#e5e7eb',
                borderRadius: 999,
                padding: '2px 6px',
                cursor: 'pointer',
              }}
              title="Clear sort"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Incoming Products Chart */}
      <IncomingProductsChart shipments={filteredAndSortedProducts} />

      {/* Current Week Stored Shipments Report */}
      <CurrentWeekStoredReport shipments={shipments} />

      {/* Warehouse Summary */}
      <div className="warehouse-summary" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginBottom: '0.5rem', color: '#333' }}>Warehouse Summary - Total Pallets by Warehouse</h3>
        <div className="stats-grid" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {Object.entries(warehouseTotals).map(([warehouse, total]) => (
            <div 
              key={warehouse} 
              className="stat-card" 
              onClick={() => handleWarehouseCardClick(warehouse)}
              style={{ 
                minWidth: '150px',
                cursor: 'pointer',
                backgroundColor: selectedWarehouse === warehouse ? '#f0f4ff' : 'white',
                border: `2px solid ${selectedWarehouse === warehouse ? '#667eea' : '#e1e5e9'}`,
                borderRadius: '8px',
                padding: '12px 16px',
                transition: 'all 0.3s ease',
                transform: selectedWarehouse === warehouse ? 'translateY(-1px)' : 'none',
                boxShadow: selectedWarehouse === warehouse 
                  ? '0 4px 12px rgba(102, 126, 234, 0.15)' 
                  : '0 2px 6px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={(e) => {
                if (selectedWarehouse !== warehouse) {
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 3px 8px rgba(0,0,0,0.12)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedWarehouse !== warehouse) {
                  e.target.style.transform = 'none';
                  e.target.style.boxShadow = '0 2px 6px rgba(0,0,0,0.1)';
                }
              }}
            >
              <h4 style={{ fontSize: '1.2rem', color: '#667eea', marginBottom: '0.25rem' }}>
                {Number(total).toLocaleString()}
              </h4>
              <p style={{ fontSize: '0.9rem', margin: 0 }}>{warehouse}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th onClick={() => handleSort('productName')} style={{ cursor: 'pointer' }}>
                PRODUCT NAME {sortConfig.key === 'productName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('quantity')} style={{ cursor: 'pointer' }}>
                QUANTITY {sortConfig.key === 'quantity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('palletQty')} style={{ cursor: 'pointer' }}>
                Pallet Qty {sortConfig.key === 'palletQty' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('receivingWarehouse')} style={{ cursor: 'pointer' }}>
                RECEIVING WAREHOUSE {sortConfig.key === 'receivingWarehouse' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('weekNumber')} style={{ cursor: 'pointer' }}>
                WEEK NUMBER ETA {sortConfig.key === 'weekNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th>SUPPLIER</th>
              <th>ORDER/REF</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedProducts.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>
                  No products found
                </td>
              </tr>
            ) : (
              filteredAndSortedProducts.map((shipment) => {
                const draft = edits[shipment.id] || {};
                const qVal = draft.quantity ?? normNum(shipment.quantity);
                const palletQtyVal = draft.palletQty ?? normNum(shipment.palletQty);
                const whVal = draft.receivingWarehouse ?? (shipment.receivingWarehouse || '');

                return (
                  <tr key={shipment.id}>
                    <td>
                      <strong>{shipment.productName || '-'}</strong>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={qVal}
                        onChange={(e) => setEdit(shipment.id, 'quantity', e.target.value)}
                        onKeyDown={(e) => onFieldKeyDown(e, shipment, 'quantity')}
                        style={{
                          border: edits[shipment.id]?.quantity !== undefined ? '2px solid #ff9800' : '1px solid #ddd',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          width: '80px',
                          textAlign: 'center',
                          backgroundColor: edits[shipment.id]?.quantity !== undefined ? '#fff3e0' : 'white',
                        }}
                        inputMode="decimal"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        value={palletQtyVal}
                        onChange={(e) => setEdit(shipment.id, 'palletQty', e.target.value)}
                        onKeyDown={(e) => onFieldKeyDown(e, shipment, 'palletQty')}
                        placeholder="Pallet Qty"
                        style={{
                          border: edits[shipment.id]?.palletQty !== undefined ? '2px solid #ff9800' : '1px solid #ddd',
                          padding: '4px 8px',
                          backgroundColor: edits[shipment.id]?.palletQty !== undefined ? '#fff3e0' : 'white',
                          borderRadius: '4px',
                          width: '80px',
                          textAlign: 'center',
                        }}
                        inputMode="decimal"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={whVal}
                        onChange={(e) => setEdit(shipment.id, 'receivingWarehouse', e.target.value)}
                        onKeyDown={(e) => onFieldKeyDown(e, shipment, 'receivingWarehouse')}
                        placeholder="Warehouse"
                        style={{
                          border: edits[shipment.id]?.receivingWarehouse !== undefined ? '2px solid #ff9800' : '1px solid #ddd',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          width: '120px',
                          backgroundColor: edits[shipment.id]?.receivingWarehouse !== undefined ? '#fff3e0' : 'white',
                        }}
                      />
                    </td>
                    <td>
                      <WeekCalendar
                        currentWeek={
                          Number.isFinite(Number(shipment.weekNumber)) ? Number(shipment.weekNumber) : null
                        }
                        onWeekSelect={(weekNumber, selectedDate) => {
                          const updates = { weekNumber: weekNumber.toString() };
                          if (selectedDate) {
                            updates.selectedWeekDate = selectedDate.toISOString();
                          }
                          onUpdateShipment(shipment.id, updates);
                        }}
                        selectedWeekDate={shipment.selectedWeekDate ? new Date(shipment.selectedWeekDate) : null}
                      />
                    </td>
                    <td style={{ fontSize: '0.9rem', color: '#666' }}>{shipment.supplier}</td>
                    <td style={{ fontSize: '0.9rem', color: '#666' }}>{shipment.orderRef}</td>
                    <td>
                      {edits[shipment.id] && Object.keys(edits[shipment.id]).length > 0 ? (
                        <button
                          onClick={() => saveShipment(shipment.id)}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                          }}
                          title="Save changes for this row"
                        >
                          💾 Save
                        </button>
                      ) : (
                        <span style={{ color: '#999', fontSize: '0.85rem' }}>✓ Saved</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProductView;
