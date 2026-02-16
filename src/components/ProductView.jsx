import React, { useState, useMemo, useCallback } from 'react';
import WeekCalendar from './WeekCalendar';
import IncomingProductsChart from './IncomingProductsChart';
import * as XLSX from 'xlsx';
import { ShipmentStatus } from '../types/shipment';

function ProductView({ shipments, onUpdateShipment, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'weekNumber', direction: 'asc' });
  const [selectedWarehouse, setSelectedWarehouse] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showChart, setShowChart] = useState(false);

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
    const numericKeys = new Set(['quantity', 'palletQty']);

    // Special handling for weekNumber sorting - use selectedWeekDate for proper chronological order
    if (key === 'weekNumber') {
      return [...filtered].sort((a, b) => {
        const dateA = a.selectedWeekDate ? new Date(a.selectedWeekDate).getTime() : 0;
        const dateB = b.selectedWeekDate ? new Date(b.selectedWeekDate).getTime() : 0;

        // If both have dates, sort by date
        if (dateA && dateB) return (dateA - dateB) * dir;

        // If only one has a date, prioritize the one with a date
        if (dateA && !dateB) return -1 * dir;
        if (!dateA && dateB) return 1 * dir;

        // If neither has a date, fallback to week number
        const weekA = normNum(a.weekNumber);
        const weekB = normNum(b.weekNumber);
        return (weekA - weekB) * dir;
      });
    }

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
      const totalPalletQty = Math.round(filteredAndSortedProducts.reduce((sum, p) => sum + normNum(p.palletQty), 0));
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
          Math.round(normNum(shipment.palletQty)) || 1,
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
    (shipments || []).forEach((sh) => {
      if (sh.latestStatus === ShipmentStatus.STORED) return;
      const warehouse = sh.receivingWarehouse || 'Unassigned';
      totals[warehouse] = (totals[warehouse] || 0) + normNum(sh.palletQty);
    });
    return totals;
  }, [shipments]);

  if (loading) {
    return <div className="loading">Loading products...</div>;
  }

  return (
    <div className="product-view">
      <div className="brand-strip" />
      <div className="table-header" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="page-header"><h2 style={{ marginRight: 'auto' }}>Product & Warehouse View</h2></div>

        {/* Save All Button */}
        {unsavedCount > 0 && (
          <button
            onClick={saveAllChanges}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--warning)',
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
                backgroundColor: statusFilter === 'all' ? 'var(--info)' : 'var(--surface-2)',
                color: statusFilter === 'all' ? 'white' : 'var(--text-700)',
                border: '1px solid var(--border)',
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
                backgroundColor: (statusFilter === ShipmentStatus.ARRIVED_PTA || statusFilter === ShipmentStatus.ARRIVED_KLM || statusFilter === 'arrived') ? 'var(--success)' : 'var(--surface-2)',
                color: (statusFilter === ShipmentStatus.ARRIVED_PTA || statusFilter === ShipmentStatus.ARRIVED_KLM || statusFilter === 'arrived') ? 'white' : 'var(--text-700)',
                border: '1px solid var(--border)',
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
              backgroundColor: 'var(--success)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--success)';
              e.target.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'var(--success)';
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
              background: 'var(--surface-2)',
              fontSize: 12,
              color: 'var(--text-900)',
            }}
          >
            <span>
              Sorting by <strong>{labelForKey(sortConfig.key)}</strong> ({sortConfig.direction})
            </span>
            <button
              onClick={clearSort}
              style={{
                border: 'none',
                background: 'var(--border)',
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

      {/* Incoming Products Chart (collapsible) */}
      <div style={{ padding: '0 24px' }}>
        <button onClick={() => setShowChart(!showChart)} style={{
          display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
          cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-700)', padding: '8px 0'
        }}>
          <span style={{
            display: 'inline-block', transform: showChart ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s', fontSize: 11
          }}>&#9654;</span>
          Incoming Products Chart
        </button>
        {showChart && <IncomingProductsChart shipments={filteredAndSortedProducts} />}
      </div>

      {/* Warehouse Pallet Summary — compact inline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 24px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-500)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
          Pallets by Warehouse:
        </span>
        {Object.entries(warehouseTotals).map(([warehouse, total]) => (
          <button
            key={warehouse}
            onClick={() => handleWarehouseCardClick(warehouse)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              border: selectedWarehouse === warehouse ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: selectedWarehouse === warehouse ? 'rgba(5,150,105,0.08)' : 'var(--surface-2)',
              fontWeight: 600, color: 'var(--navy-900)',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 800 }}>{Math.round(Number(total)).toLocaleString()}</span>
            <span style={{ fontSize: 11, color: 'var(--text-500)', textTransform: 'uppercase' }}>{warehouse}</span>
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>SUPPLIER</th>
              <th>ORDER / REF</th>
              <th onClick={() => handleSort('productName')} style={{ cursor: 'pointer' }}>
                PRODUCT {sortConfig.key === 'productName' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('receivingWarehouse')} style={{ cursor: 'pointer' }}>
                WAREHOUSE {sortConfig.key === 'receivingWarehouse' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('weekNumber')} style={{ cursor: 'pointer' }}>
                WEEK {sortConfig.key === 'weekNumber' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('palletQty')} style={{ cursor: 'pointer' }}>
                PALLETS {sortConfig.key === 'palletQty' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('quantity')} style={{ cursor: 'pointer' }}>
                QTY {sortConfig.key === 'quantity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th></th>
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
                const palletQtyVal = draft.palletQty ?? (Math.round(normNum(shipment.palletQty)) || (shipment.palletQty ? 1 : 0));
                const whVal = draft.receivingWarehouse ?? (shipment.receivingWarehouse || '');
                const hasEdits = edits[shipment.id] && Object.keys(edits[shipment.id]).length > 0;
                const editBorder = '2px solid var(--warning)';
                const editBg = '#fff3e0';
                const inputStyle = (field) => ({
                  border: edits[shipment.id]?.[field] !== undefined ? editBorder : '1px solid var(--border)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  textAlign: 'center',
                  backgroundColor: edits[shipment.id]?.[field] !== undefined ? editBg : 'white',
                });

                return (
                  <tr key={shipment.id}>
                    <td>{shipment.supplier}</td>
                    <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{shipment.orderRef}</td>
                    <td><strong>{shipment.productName || '-'}</strong></td>
                    <td>
                      <input
                        type="text"
                        value={whVal}
                        onChange={(e) => setEdit(shipment.id, 'receivingWarehouse', e.target.value)}
                        onKeyDown={(e) => onFieldKeyDown(e, shipment, 'receivingWarehouse')}
                        placeholder="Warehouse"
                        style={{ ...inputStyle('receivingWarehouse'), width: '110px' }}
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
                    <td>
                      <input
                        type="number"
                        value={palletQtyVal}
                        onChange={(e) => setEdit(shipment.id, 'palletQty', e.target.value)}
                        onKeyDown={(e) => onFieldKeyDown(e, shipment, 'palletQty')}
                        style={{ ...inputStyle('palletQty'), width: '70px' }}
                        inputMode="decimal"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={qVal}
                        onChange={(e) => setEdit(shipment.id, 'quantity', e.target.value)}
                        onKeyDown={(e) => onFieldKeyDown(e, shipment, 'quantity')}
                        style={{ ...inputStyle('quantity'), width: '80px' }}
                        inputMode="decimal"
                      />
                    </td>
                    <td>
                      {hasEdits ? (
                        <button
                          onClick={() => saveShipment(shipment.id)}
                          style={{
                            padding: '4px 12px',
                            backgroundColor: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                          }}
                          title="Save changes for this row"
                        >
                          Save
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-500)', fontSize: '0.8rem' }}>Saved</span>
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
