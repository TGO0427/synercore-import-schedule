import React, { useState, useEffect, useMemo } from 'react';
import { getApiUrl } from '../config/api';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

function AdvancedReports() {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState('custom');

  // Filter states
  const [filters, setFilters] = useState({
    dateRange: {
      start: '',
      end: '',
      field: 'created_at' // created_at, updated_at, inspection_date, receiving_date
    },
    statuses: [],
    warehouses: [],
    suppliers: [],
    products: [],
    weekNumbers: [],
    forwardingAgents: [],
    incoterms: [],
    vesselNames: [],
    priorityLevels: [],
    inspectionStatus: [],
    receivingStatus: [],
    quantityRange: {
      min: '',
      max: ''
    },
    palletRange: {
      min: '',
      max: ''
    },
    searchTerm: ''
  });

  // Aggregation options
  const [aggregation, setAggregation] = useState({
    groupBy: 'none', // none, supplier, warehouse, status, product, week, month, forwardingAgent
    metrics: ['count', 'totalQuantity', 'totalPallets'], // count, totalQuantity, totalPallets, avgQuantity
    sortBy: 'count',
    sortDirection: 'desc'
  });

  // Visualization options
  const [visualization, setVisualization] = useState({
    type: 'table', // table, chart, summary
    chartType: 'bar' // bar, pie, line
  });

  useEffect(() => {
    fetchShipments();
  }, []);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('/api/shipments'));
      if (!response.ok) throw new Error('Failed to fetch shipments');
      const data = await response.json();
      setShipments(data);
    } catch (error) {
      console.error('Error fetching shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    return {
      statuses: [...new Set(shipments.map(s => s.latestStatus))].filter(Boolean).sort(),
      warehouses: [...new Set(shipments.map(s => s.receivingWarehouse))].filter(Boolean).sort(),
      suppliers: [...new Set(shipments.map(s => s.supplier))].filter(Boolean).sort(),
      products: [...new Set(shipments.map(s => s.productName))].filter(Boolean).sort(),
      weekNumbers: [...new Set(shipments.map(s => s.weekNumber))].filter(Boolean).sort((a, b) => parseInt(a) - parseInt(b)),
      forwardingAgents: [...new Set(shipments.map(s => s.forwardingAgent))].filter(Boolean).sort(),
      incoterms: [...new Set(shipments.map(s => s.incoterm))].filter(Boolean).sort(),
      vesselNames: [...new Set(shipments.map(s => s.vesselName))].filter(Boolean).sort(),
      inspectionStatuses: ['not_started', 'in_progress', 'passed', 'failed', 'requires_review'],
      receivingStatuses: ['not_started', 'in_progress', 'partial', 'completed', 'discrepancy']
    };
  }, [shipments]);

  // Apply all filters
  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
      // Date range filter
      if (filters.dateRange.start || filters.dateRange.end) {
        const dateField = filters.dateRange.field;
        let shipmentDate;

        if (dateField === 'created_at') shipmentDate = new Date(shipment.createdAt);
        else if (dateField === 'updated_at') shipmentDate = new Date(shipment.updatedAt);
        else if (dateField === 'inspection_date') shipmentDate = new Date(shipment.inspectionDate);
        else if (dateField === 'receiving_date') shipmentDate = new Date(shipment.receivingDate);

        if (shipmentDate) {
          if (filters.dateRange.start && shipmentDate < new Date(filters.dateRange.start)) return false;
          if (filters.dateRange.end && shipmentDate > new Date(filters.dateRange.end)) return false;
        }
      }

      // Multi-select filters
      if (filters.statuses.length > 0 && !filters.statuses.includes(shipment.latestStatus)) return false;
      if (filters.warehouses.length > 0 && !filters.warehouses.includes(shipment.receivingWarehouse)) return false;
      if (filters.suppliers.length > 0 && !filters.suppliers.includes(shipment.supplier)) return false;
      if (filters.products.length > 0 && !filters.products.includes(shipment.productName)) return false;
      if (filters.weekNumbers.length > 0 && !filters.weekNumbers.includes(shipment.weekNumber)) return false;
      if (filters.forwardingAgents.length > 0 && !filters.forwardingAgents.includes(shipment.forwardingAgent)) return false;
      if (filters.incoterms.length > 0 && !filters.incoterms.includes(shipment.incoterm)) return false;
      if (filters.vesselNames.length > 0 && !filters.vesselNames.includes(shipment.vesselName)) return false;
      if (filters.inspectionStatus.length > 0 && !filters.inspectionStatus.includes(shipment.inspectionStatus)) return false;
      if (filters.receivingStatus.length > 0 && !filters.receivingStatus.includes(shipment.receivingStatus)) return false;

      // Quantity range
      if (filters.quantityRange.min && shipment.quantity < parseFloat(filters.quantityRange.min)) return false;
      if (filters.quantityRange.max && shipment.quantity > parseFloat(filters.quantityRange.max)) return false;

      // Pallet range
      if (filters.palletRange.min && shipment.palletQty < parseFloat(filters.palletRange.min)) return false;
      if (filters.palletRange.max && shipment.palletQty > parseFloat(filters.palletRange.max)) return false;

      // Search term
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        return (
          shipment.supplier?.toLowerCase().includes(searchLower) ||
          shipment.orderRef?.toLowerCase().includes(searchLower) ||
          shipment.productName?.toLowerCase().includes(searchLower) ||
          shipment.finalPod?.toLowerCase().includes(searchLower) ||
          shipment.notes?.toLowerCase().includes(searchLower)
        );
      }

      return true;
    });
  }, [shipments, filters]);

  // Apply aggregation
  const aggregatedData = useMemo(() => {
    if (aggregation.groupBy === 'none') {
      return filteredShipments;
    }

    const grouped = {};

    filteredShipments.forEach(shipment => {
      let key;
      if (aggregation.groupBy === 'supplier') key = shipment.supplier;
      else if (aggregation.groupBy === 'warehouse') key = shipment.receivingWarehouse;
      else if (aggregation.groupBy === 'status') key = shipment.latestStatus;
      else if (aggregation.groupBy === 'product') key = shipment.productName;
      else if (aggregation.groupBy === 'week') key = `Week ${shipment.weekNumber}`;
      else if (aggregation.groupBy === 'month') {
        const date = new Date(shipment.createdAt);
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      else if (aggregation.groupBy === 'forwardingAgent') key = shipment.forwardingAgent;

      if (!key) key = '(Not Set)';

      if (!grouped[key]) {
        grouped[key] = {
          group: key,
          count: 0,
          totalQuantity: 0,
          totalPallets: 0,
          shipments: []
        };
      }

      grouped[key].count++;
      grouped[key].totalQuantity += shipment.quantity || 0;
      grouped[key].totalPallets += shipment.palletQty || 0;
      grouped[key].shipments.push(shipment);
    });

    // Convert to array and calculate averages
    const result = Object.values(grouped).map(group => ({
      ...group,
      avgQuantity: group.totalQuantity / group.count
    }));

    // Sort
    result.sort((a, b) => {
      const aVal = a[aggregation.sortBy];
      const bVal = b[aggregation.sortBy];
      return aggregation.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [filteredShipments, aggregation]);

  // Update filter
  const updateFilter = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // Toggle multi-select filter
  const toggleFilterOption = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: prev[filterName].includes(value)
        ? prev[filterName].filter(v => v !== value)
        : [...prev[filterName], value]
    }));
  };

  // Reset filters
  const resetFilters = () => {
    setFilters({
      dateRange: { start: '', end: '', field: 'created_at' },
      statuses: [],
      warehouses: [],
      suppliers: [],
      products: [],
      weekNumbers: [],
      forwardingAgents: [],
      incoterms: [],
      vesselNames: [],
      priorityLevels: [],
      inspectionStatus: [],
      receivingStatus: [],
      quantityRange: { min: '', max: '' },
      palletRange: { min: '', max: '' },
      searchTerm: ''
    });
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Title
    doc.setFontSize(18);
    doc.text('Advanced Shipment Report', pageWidth / 2, 20, { align: 'center' });

    // Filters applied
    doc.setFontSize(10);
    let yPos = 35;
    doc.text('Filters Applied:', 20, yPos);
    yPos += 7;

    if (filters.dateRange.start || filters.dateRange.end) {
      doc.text(`Date Range: ${filters.dateRange.start || 'Any'} to ${filters.dateRange.end || 'Any'}`, 25, yPos);
      yPos += 5;
    }
    if (filters.statuses.length > 0) {
      doc.text(`Statuses: ${filters.statuses.join(', ')}`, 25, yPos);
      yPos += 5;
    }
    if (filters.warehouses.length > 0) {
      doc.text(`Warehouses: ${filters.warehouses.join(', ')}`, 25, yPos);
      yPos += 5;
    }

    yPos += 5;

    // Summary stats
    doc.setFontSize(12);
    doc.text('Summary Statistics:', 20, yPos);
    yPos += 7;
    doc.setFontSize(10);
    doc.text(`Total Shipments: ${filteredShipments.length}`, 25, yPos);
    yPos += 5;
    doc.text(`Total Quantity: ${filteredShipments.reduce((sum, s) => sum + (s.quantity || 0), 0).toLocaleString()}`, 25, yPos);
    yPos += 5;
    doc.text(`Total Pallets: ${filteredShipments.reduce((sum, s) => sum + (s.palletQty || 0), 0).toLocaleString()}`, 25, yPos);
    yPos += 10;

    // Data table
    if (aggregation.groupBy === 'none') {
      // Detailed shipment list
      doc.autoTable({
        startY: yPos,
        head: [['Supplier', 'Order Ref', 'Product', 'Week', 'Qty', 'Pallets', 'Status', 'Warehouse']],
        body: filteredShipments.map(s => [
          s.supplier || '',
          s.orderRef || '',
          s.productName || '',
          s.weekNumber || '-',
          s.quantity || 0,
          s.palletQty || 0,
          s.latestStatus || '',
          s.receivingWarehouse || ''
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [102, 126, 234] }
      });
    } else {
      // Aggregated data
      doc.autoTable({
        startY: yPos,
        head: [[aggregation.groupBy.toUpperCase(), 'Count', 'Total Qty', 'Total Pallets', 'Avg Qty']],
        body: aggregatedData.map(d => [
          d.group,
          d.count,
          d.totalQuantity.toFixed(0),
          d.totalPallets.toFixed(0),
          d.avgQuantity.toFixed(2)
        ]),
        styles: { fontSize: 10 },
        headStyles: { fillColor: [102, 126, 234] }
      });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Generated: ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }

    doc.save(`advanced_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '2rem',
        borderRadius: '12px',
        marginBottom: '2rem'
      }}>
        <h1 style={{ margin: 0, marginBottom: '0.5rem' }}>📊 Advanced Reports</h1>
        <p style={{ margin: 0, opacity: 0.9 }}>Custom filters, aggregations, and data analysis</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px' }}>
        {/* Filters Panel */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>🔍 Filters</h3>
            <button
              onClick={resetFilters}
              style={{
                padding: '4px 8px',
                fontSize: '0.8rem',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Reset
            </button>
          </div>

          {/* Search */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Search:
            </label>
            <input
              type="text"
              value={filters.searchTerm}
              onChange={(e) => updateFilter('searchTerm', e.target.value)}
              placeholder="Search all fields..."
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          {/* Date Range */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Date Range:
            </label>
            <select
              value={filters.dateRange.field}
              onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, field: e.target.value })}
              style={{
                width: '100%',
                padding: '6px',
                marginBottom: '5px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '0.85rem'
              }}
            >
              <option value="created_at">Created Date</option>
              <option value="updated_at">Updated Date</option>
              <option value="inspection_date">Inspection Date</option>
              <option value="receiving_date">Receiving Date</option>
            </select>
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, start: e.target.value })}
              style={{
                width: '100%',
                padding: '6px',
                marginBottom: '5px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => updateFilter('dateRange', { ...filters.dateRange, end: e.target.value })}
              style={{
                width: '100%',
                padding: '6px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            />
          </div>

          {/* Status Filter */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Status ({filters.statuses.length} selected):
            </label>
            <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '5px' }}>
              {filterOptions.statuses.map(status => (
                <label key={status} style={{ display: 'block', padding: '3px', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes(status)}
                    onChange={() => toggleFilterOption('statuses', status)}
                    style={{ marginRight: '5px' }}
                  />
                  {status}
                </label>
              ))}
            </div>
          </div>

          {/* Warehouse Filter */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Warehouse ({filters.warehouses.length} selected):
            </label>
            <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '5px' }}>
              {filterOptions.warehouses.map(warehouse => (
                <label key={warehouse} style={{ display: 'block', padding: '3px', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={filters.warehouses.includes(warehouse)}
                    onChange={() => toggleFilterOption('warehouses', warehouse)}
                    style={{ marginRight: '5px' }}
                  />
                  {warehouse}
                </label>
              ))}
            </div>
          </div>

          {/* Supplier Filter */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Supplier ({filters.suppliers.length} selected):
            </label>
            <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '5px' }}>
              {filterOptions.suppliers.map(supplier => (
                <label key={supplier} style={{ display: 'block', padding: '3px', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={filters.suppliers.includes(supplier)}
                    onChange={() => toggleFilterOption('suppliers', supplier)}
                    style={{ marginRight: '5px' }}
                  />
                  {supplier}
                </label>
              ))}
            </div>
          </div>

          {/* Week Number Filter */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Week Number ({filters.weekNumbers.length} selected):
            </label>
            <div style={{ maxHeight: '100px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '5px' }}>
              {filterOptions.weekNumbers.map(week => (
                <label key={week} style={{ display: 'block', padding: '3px', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={filters.weekNumbers.includes(week)}
                    onChange={() => toggleFilterOption('weekNumbers', week)}
                    style={{ marginRight: '5px' }}
                  />
                  Week {week}
                </label>
              ))}
            </div>
          </div>

          {/* Quantity Range */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Quantity Range:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              <input
                type="number"
                placeholder="Min"
                value={filters.quantityRange.min}
                onChange={(e) => updateFilter('quantityRange', { ...filters.quantityRange, min: e.target.value })}
                style={{
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem'
                }}
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.quantityRange.max}
                onChange={(e) => updateFilter('quantityRange', { ...filters.quantityRange, max: e.target.value })}
                style={{
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          {/* Pallet Range */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Pallet Range:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
              <input
                type="number"
                placeholder="Min"
                value={filters.palletRange.min}
                onChange={(e) => updateFilter('palletRange', { ...filters.palletRange, min: e.target.value })}
                style={{
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem'
                }}
              />
              <input
                type="number"
                placeholder="Max"
                value={filters.palletRange.max}
                onChange={(e) => updateFilter('palletRange', { ...filters.palletRange, max: e.target.value })}
                style={{
                  padding: '6px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '0.85rem'
                }}
              />
            </div>
          </div>

          {/* Aggregation Options */}
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #eee' }}>
            <h4 style={{ marginBottom: '10px' }}>📈 Aggregation</h4>

            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Group By:
            </label>
            <select
              value={aggregation.groupBy}
              onChange={(e) => setAggregation({ ...aggregation, groupBy: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="none">None (Detailed List)</option>
              <option value="supplier">By Supplier</option>
              <option value="warehouse">By Warehouse</option>
              <option value="status">By Status</option>
              <option value="product">By Product</option>
              <option value="week">By Week</option>
              <option value="month">By Month</option>
              <option value="forwardingAgent">By Forwarding Agent</option>
            </select>

            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' }}>
              Sort By:
            </label>
            <select
              value={aggregation.sortBy}
              onChange={(e) => setAggregation({ ...aggregation, sortBy: e.target.value })}
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '10px',
                border: '1px solid #ddd',
                borderRadius: '4px'
              }}
            >
              <option value="count">Count</option>
              <option value="totalQuantity">Total Quantity</option>
              <option value="totalPallets">Total Pallets</option>
              <option value="avgQuantity">Average Quantity</option>
            </select>

            <label style={{ display: 'flex', alignItems: 'center', fontSize: '0.9rem' }}>
              <input
                type="checkbox"
                checked={aggregation.sortDirection === 'desc'}
                onChange={(e) => setAggregation({ ...aggregation, sortDirection: e.target.checked ? 'desc' : 'asc' })}
                style={{ marginRight: '5px' }}
              />
              Descending Order
            </label>
          </div>
        </div>

        {/* Results Panel */}
        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>
              📊 Results ({aggregation.groupBy === 'none' ? filteredShipments.length : aggregatedData.length} {aggregation.groupBy === 'none' ? 'shipments' : 'groups'})
            </h3>
            <button
              onClick={exportToPDF}
              style={{
                padding: '10px 20px',
                backgroundColor: '#e53e3e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              📄 Export PDF
            </button>
          </div>

          {/* Summary Stats */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '15px',
            marginBottom: '20px'
          }}>
            <div style={{
              padding: '15px',
              backgroundColor: '#e3f2fd',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1976d2' }}>
                {filteredShipments.length}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Shipments</div>
            </div>
            <div style={{
              padding: '15px',
              backgroundColor: '#f3e5f5',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#7b1fa2' }}>
                {filteredShipments.reduce((sum, s) => sum + (s.quantity || 0), 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Quantity</div>
            </div>
            <div style={{
              padding: '15px',
              backgroundColor: '#e8f5e9',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#388e3c' }}>
                {filteredShipments.reduce((sum, s) => sum + (s.palletQty || 0), 0).toLocaleString()}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Pallets</div>
            </div>
            <div style={{
              padding: '15px',
              backgroundColor: '#fff3e0',
              borderRadius: '8px',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f57c00' }}>
                {aggregation.groupBy === 'none'
                  ? filteredShipments.length
                  : aggregatedData.length}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                {aggregation.groupBy === 'none' ? 'Records' : 'Groups'}
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                Loading shipments...
              </div>
            ) : aggregation.groupBy === 'none' ? (
              // Detailed shipment list
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Supplier</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Order Ref</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Product</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>Week</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Quantity</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Pallets</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '12px', textAlign: 'left' }}>Warehouse</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShipments.map((shipment, index) => (
                    <tr key={shipment.id} style={{
                      borderBottom: '1px solid #eee',
                      backgroundColor: index % 2 === 0 ? 'white' : '#fafafa'
                    }}>
                      <td style={{ padding: '10px' }}>{shipment.supplier || '-'}</td>
                      <td style={{ padding: '10px' }}>{shipment.orderRef || '-'}</td>
                      <td style={{ padding: '10px' }}>{shipment.productName || '-'}</td>
                      <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold', color: '#667eea' }}>
                        {shipment.weekNumber || '-'}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{(shipment.quantity || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{(shipment.palletQty || 0).toLocaleString()}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2'
                        }}>
                          {shipment.latestStatus || '-'}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>{shipment.receivingWarehouse || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              // Aggregated data
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                    <th style={{ padding: '12px', textAlign: 'left' }}>{aggregation.groupBy.toUpperCase()}</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Count</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Total Quantity</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Total Pallets</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Avg Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregatedData.map((data, index) => (
                    <tr key={index} style={{
                      borderBottom: '1px solid #eee',
                      backgroundColor: index % 2 === 0 ? 'white' : '#fafafa'
                    }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{data.group}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{data.count}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{data.totalQuantity.toLocaleString()}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{data.totalPallets.toLocaleString()}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{data.avgQuantity.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdvancedReports;
