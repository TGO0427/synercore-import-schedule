import React, { useMemo, useState, useEffect } from 'react';
import { authFetch } from '../utils/authFetch';
import { ShipmentStatus } from '../types/shipment';
import { getCurrentWeekNumber } from '../utils/dateUtils';
import PostArrivalWorkflowReport from './PostArrivalWorkflowReport';
import CurrentWeekStoredReport from './CurrentWeekStoredReport';
import { getApiUrl } from '../config/api';

// Helper function to extract forwarding agent from shipment data
const extractForwardingAgent = (shipment) => {
  // Try to extract from notes or supplier info
  if (shipment.notes) {
    const notes = shipment.notes.toLowerCase();
    if (notes.includes('dhl') || notes.includes('mydhl')) return 'DHL';
    if (notes.includes('dsv')) return 'DSV';
    if (notes.includes('afrigistics')) return 'Afrigistics';
    if (notes.includes('ups')) return 'UPS';
  }

  // Try to extract from supplier name
  if (shipment.supplier) {
    const supplier = shipment.supplier.toLowerCase();
    if (supplier.includes('dhl')) return 'DHL';
    if (supplier.includes('dsv')) return 'DSV';
    if (supplier.includes('afrigistics')) return 'Afrigistics';
  }

  // Default based on destination or random assignment for demo
  const destinations = ['DHL', 'DSV', 'Afrigistics'];
  return destinations[Math.floor(Math.random() * destinations.length)];
};

function ReportsView({ shipments: propShipments, statusFilter, onStatusFilter }) {
  const [savedReports, setSavedReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [allShipments, setAllShipments] = useState([]);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [customDateRange, setCustomDateRange] = useState({
    start: '',
    end: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('current'); // 'current' or 'historical'
  const [selectedReport, setSelectedReport] = useState(null);

  // Fetch saved reports on component mount
  useEffect(() => {
    fetchSavedReports();
  }, []);

  // Fetch all shipments directly from API for reports
  useEffect(() => {
    const fetchAllShipmentsData = async () => {
      try {
        setLoadingShipments(true);

        // Fetch ALL shipments from the database (no filtering)
        const response = await authFetch(getApiUrl('/api/shipments?limit=10000'));
        if (response.ok) {
          const result = await response.json();
          // Handle both { data: [...] } and [...] response formats
          const shipments = result.data || result || [];

          // Normalize field names
          const normalized = shipments.map(s => ({
            ...s,
            latestStatus: s.latest_status || s.latestStatus,
            supplier: s.supplier,
            weekNumber: s.week_number || s.weekNumber,
            productName: s.product_name || s.productName,
            receivingWarehouse: s.receiving_warehouse || s.receivingWarehouse,
            finalPod: s.final_pod || s.finalPod,
            forwardingAgent: s.forwarding_agent || s.forwardingAgent,
            quantity: Number(s.quantity) || 0,
            cbm: Number(s.cbm) || 0
          }));

          console.log('[ReportsView] Fetched shipments:', normalized.length, 'statuses:', [...new Set(normalized.map(s => s.latestStatus))]);
          setAllShipments(normalized);
        }
      } catch (error) {
        console.error('Error fetching shipments for reports:', error);
      } finally {
        setLoadingShipments(false);
      }
    };

    fetchAllShipmentsData();
  }, []);

  const fetchSavedReports = async () => {
    try {
      setLoadingReports(true);
      const response = await authFetch(getApiUrl('/api/reports'));
      if (response.ok) {
        const data = await response.json();
        setSavedReports(data.reports || []);
      }
    } catch (error) {
      console.error('Error fetching saved reports:', error);
    } finally {
      setLoadingReports(false);
    }
  };

  const saveCurrentReport = async () => {
    try {
      const reportData = {
        totalShipments: analytics.totalShipments,
        statusCounts: analytics.statusCounts,
        supplierStats: analytics.supplierStats,
        forwardingAgentStats: analytics.forwardingAgentStats,
        weeklyArrivals: analytics.weeklyArrivals,
        productStats: analytics.productStats,
        warehouseStats: analytics.warehouseStats
      };

      const response = await authFetch(getApiUrl('/api/reports/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportData,
          reportType: 'shipment_analytics',
          dateRange: customDateRange.start && customDateRange.end ? customDateRange : null
        })
      });

      if (response.ok) {
        const result = await response.json();
        alert('Report saved successfully!');
        fetchSavedReports();
      } else {
        throw new Error('Failed to save report');
      }
    } catch (error) {
      console.error('Error saving report:', error);
      alert('Error saving report: ' + error.message);
    }
  };

  const loadHistoricalReport = async (reportId) => {
    try {
      const response = await authFetch(getApiUrl(`/api/reports/${reportId}`));
      if (response.ok) {
        const report = await response.json();
        setSelectedReport(report);
        setViewMode('historical');
      }
    } catch (error) {
      console.error('Error loading historical report:', error);
    }
  };

  const deleteReport = async (reportId) => {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      const response = await authFetch(getApiUrl(`/api/reports/${reportId}`), {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchSavedReports();
        if (selectedReport && selectedReport.id === reportId) {
          setSelectedReport(null);
          setViewMode('current');
        }
      }
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  // Filter shipments based on date range
  const filteredShipments = useMemo(() => {
    // Use fetched shipments, fallback to prop shipments
    const shipmentsToUse = allShipments.length > 0 ? allShipments : propShipments;

    if (selectedDateRange === 'all') return shipmentsToUse;

    const now = new Date();
    let startDate = new Date();

    switch (selectedDateRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          return shipmentsToUse.filter(shipment => {
            const shipmentDate = new Date(shipment.weekNumber ? `2024-W${shipment.weekNumber}` : shipment.createdAt || now);
            return shipmentDate >= new Date(customDateRange.start) && shipmentDate <= new Date(customDateRange.end);
          });
        }
        return shipmentsToUse;
      default:
        return shipmentsToUse;
    }

    return shipmentsToUse.filter(shipment => {
      const shipmentDate = new Date(shipment.weekNumber ? `2024-W${shipment.weekNumber}` : shipment.createdAt || now);
      return shipmentDate >= startDate;
    });
  }, [allShipments, propShipments, selectedDateRange, customDateRange]);

  const analytics = useMemo(() => {
    const currentWeek = getCurrentWeekNumber();
    
    // Status distribution - track unique orderRefs per status
    const statusOrderRefs = {
      [ShipmentStatus.PLANNED_AIRFREIGHT]: new Set(),
      [ShipmentStatus.PLANNED_SEAFREIGHT]: new Set(),
      [ShipmentStatus.IN_TRANSIT_AIRFREIGHT]: new Set(),
      [ShipmentStatus.IN_TRANSIT_ROADWAY]: new Set(),
      [ShipmentStatus.IN_TRANSIT_SEAWAY]: new Set(),
      [ShipmentStatus.MOORED]: new Set(),
      [ShipmentStatus.BERTH_WORKING]: new Set(),
      [ShipmentStatus.BERTH_COMPLETE]: new Set(),
      [ShipmentStatus.ARRIVED_PTA]: new Set(),
      [ShipmentStatus.ARRIVED_KLM]: new Set(),
      [ShipmentStatus.DELAYED]: new Set(),
      [ShipmentStatus.CANCELLED]: new Set(),
      [ShipmentStatus.STORED]: new Set(),
      [ShipmentStatus.ARCHIVED]: new Set(),
    };

    // Supplier performance - track unique orderRefs
    const supplierOrderRefs = {};

    // Weekly arrivals - track unique orderRefs
    const weeklyOrderRefs = {};
    
    // Product categories
    const productStats = {};
    
    // Warehouse distribution
    const warehouseStats = {};

    // Forwarding agent performance
    const forwardingAgentStats = {};

    const dataSource = viewMode === 'historical' && selectedReport
      ? selectedReport.analytics
      : null;

    if (dataSource) {
      return {
        statusCounts: dataSource.statusCounts || {},
        supplierStats: dataSource.supplierStats || {},
        weeklyArrivals: dataSource.weeklyArrivals || {},
        productStats: dataSource.productStats || {},
        warehouseStats: dataSource.warehouseStats || {},
        forwardingAgentStats: dataSource.forwardingAgentStats || {},
        totalShipments: dataSource.totalShipments || 0,
        currentWeek
      };
    }

    filteredShipments.forEach(shipment => {
      // Normalize status field (handle both camelCase and snake_case)
      const status = shipment.latestStatus || shipment.latest_status;
      const orderRef = shipment.orderRef || shipment.order_ref || shipment.id;

      // Status counts - count unique orderRefs per status
      if (statusOrderRefs.hasOwnProperty(status) && orderRef) {
        statusOrderRefs[status].add(orderRef);
      }

      // Supplier stats - count unique orderRefs
      const supplier = shipment.supplier || 'Unknown';
      if (orderRef) {
        if (!supplierOrderRefs[supplier]) {
          supplierOrderRefs[supplier] = {
            total: new Set(),
            delayed: new Set(),
            arrived: new Set(),
            inTransit: new Set()
          };
        }
        supplierOrderRefs[supplier].total.add(orderRef);
        if (status === ShipmentStatus.DELAYED) {
          supplierOrderRefs[supplier].delayed.add(orderRef);
        } else if (status === ShipmentStatus.ARRIVED_PTA || status === ShipmentStatus.ARRIVED_KLM) {
          supplierOrderRefs[supplier].arrived.add(orderRef);
        } else if (status === ShipmentStatus.IN_TRANSIT_ROADWAY || status === ShipmentStatus.IN_TRANSIT_SEAWAY) {
          supplierOrderRefs[supplier].inTransit.add(orderRef);
        }
      }

      // Weekly arrivals - count unique orderRefs
      if (shipment.weekNumber && orderRef) {
        const week = parseInt(shipment.weekNumber);
        if (!weeklyOrderRefs[week]) {
          weeklyOrderRefs[week] = new Set();
        }
        weeklyOrderRefs[week].add(orderRef);
      }
      
      // Product stats
      if (shipment.productName) {
        if (!productStats[shipment.productName]) {
          productStats[shipment.productName] = {
            count: 0,
            quantity: 0
          };
        }
        productStats[shipment.productName].count++;
        productStats[shipment.productName].quantity += shipment.quantity || 0;
      }
      
      // Warehouse stats
      const warehouse = shipment.receivingWarehouse || shipment.finalPod || 'Unknown';
      if (!warehouseStats[warehouse]) {
        warehouseStats[warehouse] = {
          count: 0,
          quantity: 0
        };
      }
      warehouseStats[warehouse].count++;
      warehouseStats[warehouse].quantity += shipment.quantity || 0;

      // Forwarding agent stats (assuming agents are stored in finalPod or we'll extract from supplier/notes)
      const forwardingAgent = shipment.forwardingAgent || extractForwardingAgent(shipment) || 'Unknown';
      if (!forwardingAgentStats[forwardingAgent]) {
        forwardingAgentStats[forwardingAgent] = {
          total: 0,
          delivered: 0,
          delayed: 0,
          inTransit: 0,
          totalPalletQty: 0,
          avgDeliveryTime: 0
        };
      }
      forwardingAgentStats[forwardingAgent].total++;
      forwardingAgentStats[forwardingAgent].totalPalletQty += shipment.cbm || 0;
      if (status === ShipmentStatus.ARRIVED_PTA || status === ShipmentStatus.ARRIVED_KLM) {
        forwardingAgentStats[forwardingAgent].delivered++;
      } else if (status === ShipmentStatus.DELAYED) {
        forwardingAgentStats[forwardingAgent].delayed++;
      } else if (status === ShipmentStatus.IN_TRANSIT_ROADWAY || status === ShipmentStatus.IN_TRANSIT_SEAWAY) {
        forwardingAgentStats[forwardingAgent].inTransit++;
      }
    });

    // Convert status Sets to counts
    const statusCounts = {};
    Object.keys(statusOrderRefs).forEach(status => {
      statusCounts[status] = statusOrderRefs[status].size;
    });

    // Convert supplier Sets to counts
    const supplierStats = {};
    Object.keys(supplierOrderRefs).forEach(supplier => {
      supplierStats[supplier] = {
        total: supplierOrderRefs[supplier].total.size,
        delayed: supplierOrderRefs[supplier].delayed.size,
        arrived: supplierOrderRefs[supplier].arrived.size,
        inTransit: supplierOrderRefs[supplier].inTransit.size
      };
    });

    // Convert weekly Sets to counts
    const weeklyArrivals = {};
    Object.keys(weeklyOrderRefs).forEach(week => {
      weeklyArrivals[week] = weeklyOrderRefs[week].size;
    });

    // Count unique orderRefs for total
    const uniqueOrderRefs = new Set(filteredShipments.map(s => s.orderRef || s.order_ref).filter(Boolean));

    return {
      statusCounts,
      supplierStats,
      weeklyArrivals,
      productStats,
      warehouseStats,
      forwardingAgentStats,
      totalShipments: uniqueOrderRefs.size,
      currentWeek
    };
  }, [filteredShipments, viewMode, selectedReport]);

  const StatusChart = ({ data }) => {
    const total = Object.values(data).reduce((sum, count) => sum + count, 0);
    if (total === 0) return <div>No data available</div>;

    const statusColors = {
      [ShipmentStatus.PLANNED_AIRFREIGHT]: '#2196F3',
      [ShipmentStatus.PLANNED_SEAFREIGHT]: '#1976D2',
      [ShipmentStatus.IN_TRANSIT_AIRFREIGHT]: '#1565C0',
      [ShipmentStatus.IN_TRANSIT_ROADWAY]: '#FF9800',
      [ShipmentStatus.IN_TRANSIT_SEAWAY]: '#FFB74D',
      [ShipmentStatus.MOORED]: '#AB47BC',
      [ShipmentStatus.BERTH_WORKING]: '#8E24AA',
      [ShipmentStatus.BERTH_COMPLETE]: '#7B1FA2',
      [ShipmentStatus.ARRIVED_PTA]: '#4CAF50',
      [ShipmentStatus.ARRIVED_KLM]: '#66BB6A',
      [ShipmentStatus.DELAYED]: '#F44336',
      [ShipmentStatus.CANCELLED]: '#9E9E9E',
    };

    return (
      <div className="chart-container">
        <h4>Shipment Status Distribution</h4>
        <div className="pie-chart">
          {Object.entries(data).map(([status, count]) => {
            const percentage = ((count / total) * 100).toFixed(1);
            return count > 0 ? (
              <div key={status} className="chart-item">
                <div 
                  className="chart-bar" 
                  style={{ 
                    width: `${percentage}%`, 
                    backgroundColor: statusColors[status] 
                  }}
                ></div>
                <div className="chart-label">
                  <span style={{ color: statusColors[status] }}>●</span>
                  {status.replace('_', ' ')}: {count} ({percentage}%)
                </div>
              </div>
            ) : null;
          })}
        </div>
      </div>
    );
  };

  const WeeklyChart = ({ data, currentWeek }) => {
    const weeks = Object.keys(data).sort((a, b) => parseInt(a) - parseInt(b));
    const maxCount = Math.max(...Object.values(data));

    return (
      <div className="chart-container">
        <h4>Weekly Arrival Schedule</h4>
        <div className="bar-chart">
          {weeks.map(week => {
            const count = data[week];
            const percentage = (count / maxCount) * 100;
            const weekNum = parseInt(week);
            const isCurrentWeek = weekNum === currentWeek;
            
            return (
              <div key={week} className="week-bar">
                <div 
                  className="bar" 
                  style={{ 
                    height: `${percentage}%`,
                    backgroundColor: isCurrentWeek ? '#FF5722' : '#667eea'
                  }}
                  title={`Week ${week}: ${count} shipments`}
                ></div>
                <div className="week-label">
                  W{week}
                  {isCurrentWeek && <span className="current-week">●</span>}
                </div>
                <div className="week-count">{count}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const SupplierTable = ({ data }) => {
    const suppliers = Object.entries(data)
      .sort(([,a], [,b]) => b.total - a.total)
      .slice(0, 10);

    return (
      <div className="chart-container">
        <h4>Top Suppliers Performance</h4>
        <div className="supplier-table">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Total</th>
                <th>Arrived</th>
                <th>In Transit</th>
                <th>Delayed</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(([supplier, stats]) => {
                const performance = stats.total > 0 ? 
                  ((stats.arrived / stats.total) * 100).toFixed(1) : 0;
                
                return (
                  <tr key={supplier}>
                    <td className="supplier-name">{supplier}</td>
                    <td>{stats.total}</td>
                    <td className="status-arrived">{stats.arrived}</td>
                    <td className="status-transit">{stats.inTransit}</td>
                    <td className="status-delayed">{stats.delayed}</td>
                    <td>
                      <div className="performance-bar">
                        <div 
                          className="performance-fill" 
                          style={{ width: `${performance}%` }}
                        ></div>
                        <span className="performance-text">{performance}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const ForwardingAgentTable = ({ data }) => {
    const agents = Object.entries(data)
      .sort(([,a], [,b]) => b.total - a.total)
      .slice(0, 10);

    return (
      <div className="chart-container">
        <h4>🚛 Forwarding Agent Performance</h4>
        <div className="agent-table">
          <table>
            <thead>
              <tr>
                <th>Agent</th>
                <th>Total</th>
                <th>Delivered</th>
                <th>In Transit</th>
                <th>Delayed</th>
                <th>Pallet Qty</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {agents.map(([agent, stats]) => {
                const performance = stats.total > 0 ?
                  ((stats.delivered / stats.total) * 100).toFixed(1) : 0;

                return (
                  <tr key={agent}>
                    <td className="agent-name">
                      <div className="agent-badge">
                        {getAgentIcon(agent)} {agent}
                      </div>
                    </td>
                    <td>{stats.total}</td>
                    <td className="status-arrived">{stats.delivered}</td>
                    <td className="status-transit">{stats.inTransit}</td>
                    <td className="status-delayed">{stats.delayed}</td>
                    <td>{Math.round(stats.totalPalletQty)}</td>
                    <td>
                      <div className="performance-bar">
                        <div
                          className="performance-fill"
                          style={{ width: `${performance}%` }}
                        ></div>
                        <span className="performance-text">{performance}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const getAgentIcon = (agent) => {
    const icons = {
      'DHL': '📦',
      'DSV': '🚛',
      'Afrigistics': '🌍',
      'UPS': '📮'
    };
    return icons[agent] || '🚚';
  };

  const ReportControls = () => (
    <div className="report-controls">
      <div className="control-group">
        <label>View Mode:</label>
        <select
          value={viewMode}
          onChange={(e) => {
            setViewMode(e.target.value);
            if (e.target.value === 'current') {
              setSelectedReport(null);
            }
          }}
        >
          <option value="current">Current Data</option>
          <option value="historical">Historical Reports</option>
        </select>
      </div>

      {viewMode === 'current' && (
        <>
          <div className="control-group">
            <label>Date Range:</label>
            <select
              value={selectedDateRange}
              onChange={(e) => setSelectedDateRange(e.target.value)}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 3 Months</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {selectedDateRange === 'custom' && (
            <div className="custom-date-range">
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                placeholder="Start Date"
              />
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))}
                placeholder="End Date"
              />
            </div>
          )}

          <button className="save-report-btn" onClick={saveCurrentReport}>
            💾 Save Report
          </button>
        </>
      )}

      {viewMode === 'historical' && (
        <div className="historical-reports">
          <div className="reports-list">
            <h4>Saved Reports</h4>
            {loadingReports ? (
              <div>Loading reports...</div>
            ) : savedReports.length === 0 ? (
              <div>No saved reports found</div>
            ) : (
              <div className="reports-grid">
                {savedReports.map(report => (
                  <div
                    key={report.id}
                    className={`report-card ${selectedReport && selectedReport.id === report.id ? 'selected' : ''}`}
                    onClick={() => loadHistoricalReport(report.id)}
                  >
                    <div className="report-header">
                      <span className="report-date">
                        {new Date(report.generatedAt).toLocaleDateString()}
                      </span>
                      <button
                        className="delete-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteReport(report.id);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div className="report-stats">
                      <span>{report.analytics.totalShipments} shipments</span>
                      <span>{report.analytics.totalSuppliers} suppliers</span>
                      <span>{report.analytics.totalAgents} agents</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const SummaryCards = ({ analytics, statusFilter, onStatusFilter }) => (
    <div className="summary-cards">
      <div className="summary-card total">
        <div className="card-icon">📦</div>
        <div className="card-content">
          <h3>{analytics.totalShipments}</h3>
          <p>Total Shipments</p>
        </div>
      </div>

      {/* Planning Phase */}
      {(analytics.statusCounts[ShipmentStatus.PLANNED_AIRFREIGHT] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.PLANNED_AIRFREIGHT ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.PLANNED_AIRFREIGHT)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">✈️</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.PLANNED_AIRFREIGHT]}</h3>
            <p>Planned Airfreight</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.PLANNED_SEAFREIGHT] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.PLANNED_SEAFREIGHT ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.PLANNED_SEAFREIGHT)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">🚢</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.PLANNED_SEAFREIGHT]}</h3>
            <p>Planned Seafreight</p>
          </div>
        </div>
      )}

      {/* In Transit Phase */}
      {(analytics.statusCounts[ShipmentStatus.IN_TRANSIT_AIRFREIGHT] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.IN_TRANSIT_AIRFREIGHT ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.IN_TRANSIT_AIRFREIGHT)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">✈️</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.IN_TRANSIT_AIRFREIGHT]}</h3>
            <p>In Transit Air</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.IN_TRANSIT_ROADWAY] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.IN_TRANSIT_ROADWAY ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.IN_TRANSIT_ROADWAY)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">🚛</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.IN_TRANSIT_ROADWAY]}</h3>
            <p>In Transit Road</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.IN_TRANSIT_SEAWAY] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.IN_TRANSIT_SEAWAY ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.IN_TRANSIT_SEAWAY)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">🌊</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.IN_TRANSIT_SEAWAY]}</h3>
            <p>In Transit Sea</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.MOORED] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.MOORED ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.MOORED)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">⚓</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.MOORED]}</h3>
            <p>Moored</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.BERTH_WORKING] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.BERTH_WORKING ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.BERTH_WORKING)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">🏗️</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.BERTH_WORKING]}</h3>
            <p>Berth Working</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.BERTH_COMPLETE] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.BERTH_COMPLETE ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.BERTH_COMPLETE)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">✅</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.BERTH_COMPLETE]}</h3>
            <p>Berth Complete</p>
          </div>
        </div>
      )}

      {/* Arrival Phase */}
      {(analytics.statusCounts[ShipmentStatus.ARRIVED_PTA] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.ARRIVED_PTA ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.ARRIVED_PTA)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">🏢</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.ARRIVED_PTA]}</h3>
            <p>Arrived PTA</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.ARRIVED_KLM] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.ARRIVED_KLM ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.ARRIVED_KLM)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">🏢</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.ARRIVED_KLM]}</h3>
            <p>Arrived KLM</p>
          </div>
        </div>
      )}

      {/* Processing Phase */}
      {(analytics.statusCounts[ShipmentStatus.UNLOADING] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.UNLOADING ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.UNLOADING)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">📦</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.UNLOADING]}</h3>
            <p>Unloading</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.INSPECTION_PENDING] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.INSPECTION_PENDING ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.INSPECTION_PENDING)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">🔍</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.INSPECTION_PENDING]}</h3>
            <p>Inspection Pending</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.INSPECTING] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.INSPECTING ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.INSPECTING)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">🔍</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.INSPECTING]}</h3>
            <p>Inspecting</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.INSPECTION_FAILED] || 0) > 0 && (
        <div
          className={`summary-card alert ${statusFilter === ShipmentStatus.INSPECTION_FAILED ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.INSPECTION_FAILED)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">❌</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.INSPECTION_FAILED]}</h3>
            <p>Inspection Failed</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.INSPECTION_PASSED] || 0) > 0 && (
        <div
          className={`summary-card success ${statusFilter === ShipmentStatus.INSPECTION_PASSED ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.INSPECTION_PASSED)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">✅</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.INSPECTION_PASSED]}</h3>
            <p>Inspection Passed</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.RECEIVING] || 0) > 0 && (
        <div
          className={`summary-card ${statusFilter === ShipmentStatus.RECEIVING ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.RECEIVING)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">📥</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.RECEIVING]}</h3>
            <p>Receiving</p>
          </div>
        </div>
      )}

      {/* Completion Phase */}
      {(analytics.statusCounts[ShipmentStatus.RECEIVED] || 0) > 0 && (
        <div
          className={`summary-card success ${statusFilter === ShipmentStatus.RECEIVED ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.RECEIVED)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">✅</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.RECEIVED]}</h3>
            <p>Received</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.STORED] || 0) > 0 && (
        <div
          className={`summary-card success ${statusFilter === ShipmentStatus.STORED ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.STORED)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">🏪</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.STORED]}</h3>
            <p>Stored</p>
          </div>
        </div>
      )}

      {/* Issue Statuses */}
      {(analytics.statusCounts[ShipmentStatus.DELAYED] || 0) > 0 && (
        <div
          className={`summary-card alert ${statusFilter === ShipmentStatus.DELAYED ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.DELAYED)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">⚠️</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.DELAYED]}</h3>
            <p>Delayed</p>
          </div>
        </div>
      )}
      {(analytics.statusCounts[ShipmentStatus.CANCELLED] || 0) > 0 && (
        <div
          className={`summary-card cancelled ${statusFilter === ShipmentStatus.CANCELLED ? 'active' : ''}`}
          onClick={() => onStatusFilter(ShipmentStatus.CANCELLED)}
          style={{ cursor: 'pointer' }}
        >
          <div className="card-icon">❌</div>
          <div className="card-content">
            <h3>{analytics.statusCounts[ShipmentStatus.CANCELLED]}</h3>
            <p>Cancelled</p>
          </div>
        </div>
      )}

      {/* Additional Info Cards */}
      <div className="summary-card">
        <div className="card-icon">📅</div>
        <div className="card-content">
          <h3>Week {analytics.currentWeek}</h3>
          <p>Current Week</p>
        </div>
      </div>

      <div className="summary-card">
        <div className="card-icon">🏭</div>
        <div className="card-content">
          <h3>{Object.keys(analytics.supplierStats).length}</h3>
          <p>Active Suppliers</p>
        </div>
      </div>
    </div>
  );

  if (loadingShipments) {
    return (
      <div className="reports-view">
        <div className="reports-header">
          <h2>📊 Reports & Analytics</h2>
          <p>Loading shipment data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reports-view">
      <div className="reports-header">
        <h2>📊 Reports & Analytics</h2>
        <p>Comprehensive insights into your shipment operations ({filteredShipments.length} shipments)</p>
      </div>

      <ReportControls />

      <SummaryCards
        analytics={analytics}
        statusFilter={statusFilter}
        onStatusFilter={onStatusFilter}
      />

      <div className="charts-grid">
        <div className="chart-column">
          <StatusChart data={analytics.statusCounts} />
          <WeeklyChart data={analytics.weeklyArrivals} currentWeek={analytics.currentWeek} />
        </div>

        <div className="chart-column">
          <SupplierTable data={analytics.supplierStats} />
        </div>
      </div>

      <div className="full-width-section">
        <ForwardingAgentTable data={analytics.forwardingAgentStats} />
      </div>

      {/* Post-Arrival Workflow Report */}
      <PostArrivalWorkflowReport shipments={filteredShipments} />

      {/* Current Week Stored Shipments Report */}
      <CurrentWeekStoredReport shipments={filteredShipments} />

      <style>{`
        .reports-view {
          padding: 2rem;
          background: #f8f9fc;
          min-height: 100vh;
        }
        
        .reports-header {
          text-align: center;
          margin-bottom: 2rem;
        }
        
        .reports-header h2 {
          color: #2c3e50;
          margin-bottom: 0.5rem;
        }
        
        .summary-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }
        
        .summary-card {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: transform 0.2s;
        }
        
        .summary-card:hover {
          transform: translateY(-2px);
        }
        
        .summary-card.total {
          border-left: 4px solid #2196F3;
          background: linear-gradient(135deg, #f8f9fc 0%, #e3f2fd 100%);
        }

        .summary-card.success {
          border-left: 4px solid #4CAF50;
          background: linear-gradient(135deg, #f8f9fc 0%, #e8f5e8 100%);
        }

        .summary-card.alert {
          border-left: 4px solid #f44336;
          background: linear-gradient(135deg, #f8f9fc 0%, #ffebee 100%);
        }

        .summary-card.cancelled {
          border-left: 4px solid #9E9E9E;
          background: linear-gradient(135deg, #f8f9fc 0%, #f5f5f5 100%);
          opacity: 0.8;
        }
        
        .card-icon {
          font-size: 2rem;
        }
        
        .card-content h3 {
          font-size: 1.8rem;
          font-weight: bold;
          color: #2c3e50;
          margin: 0;
        }
        
        .card-content p {
          color: #7f8c8d;
          margin: 0;
          font-size: 0.9rem;
        }
        
        .charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        .full-width-section {
          margin-top: 2rem;
        }

        .report-controls {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 2rem;
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: center;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .control-group label {
          font-weight: 500;
          color: #2c3e50;
          font-size: 0.9rem;
        }

        .control-group select,
        .control-group input {
          padding: 0.5rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 0.9rem;
        }

        .custom-date-range {
          display: flex;
          gap: 0.5rem;
        }

        .save-report-btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .save-report-btn:hover {
          background: #218838;
          transform: translateY(-1px);
        }

        .historical-reports {
          width: 100%;
        }

        .reports-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }

        .report-card {
          background: #f8f9fa;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          padding: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .report-card:hover {
          border-color: #667eea;
          transform: translateY(-2px);
        }

        .report-card.selected {
          border-color: #667eea;
          background: #f0f7ff;
        }

        .report-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .report-date {
          font-weight: 500;
          color: #2c3e50;
        }

        .delete-btn {
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .delete-btn:hover {
          background: #c82333;
        }

        .report-stats {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          font-size: 0.85rem;
          color: #666;
        }
        
        .chart-column {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        
        .chart-container {
          background: white;
          padding: 1.5rem;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .chart-container h4 {
          color: #2c3e50;
          margin-bottom: 1rem;
          font-size: 1.1rem;
        }
        
        .chart-item {
          margin-bottom: 0.8rem;
        }
        
        .chart-bar {
          height: 8px;
          border-radius: 4px;
          margin-bottom: 0.3rem;
        }
        
        .chart-label {
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .bar-chart {
          display: flex;
          align-items: end;
          gap: 8px;
          height: 200px;
          padding: 1rem 0;
        }
        
        .week-bar {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
        }
        
        .bar {
          width: 100%;
          min-height: 4px;
          border-radius: 2px 2px 0 0;
          margin-bottom: 0.5rem;
          transition: all 0.3s;
        }
        
        .bar:hover {
          opacity: 0.8;
        }
        
        .week-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: #666;
          margin-bottom: 0.2rem;
          display: flex;
          align-items: center;
          gap: 0.2rem;
        }
        
        .current-week {
          color: #FF5722;
          font-size: 0.6rem;
        }
        
        .week-count {
          font-size: 0.7rem;
          color: #999;
        }
        
        .supplier-table table,
        .agent-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .supplier-table th,
        .supplier-table td,
        .agent-table th,
        .agent-table td {
          padding: 0.75rem 0.5rem;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .supplier-table th,
        .agent-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #2c3e50;
          font-size: 0.9rem;
        }
        
        .supplier-name,
        .agent-name {
          font-weight: 500;
          color: #2c3e50;
        }

        .agent-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.25rem 0.5rem;
          background: #f0f7ff;
          border-radius: 16px;
          border: 1px solid #e1f0ff;
          font-size: 0.85rem;
          font-weight: 500;
        }
        
        .status-arrived { color: #4CAF50; font-weight: 500; }
        .status-transit { color: #FF9800; font-weight: 500; }
        .status-delayed { color: #F44336; font-weight: 500; }
        
        .performance-bar {
          position: relative;
          background: #eee;
          height: 16px;
          border-radius: 8px;
          overflow: hidden;
          min-width: 60px;
        }
        
        .performance-fill {
          background: linear-gradient(90deg, #f44336 0%, #ff9800 50%, #4caf50 100%);
          height: 100%;
          border-radius: 8px;
          transition: width 0.3s;
        }
        
        .performance-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.7rem;
          font-weight: 500;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        
        @media (max-width: 768px) {
          .charts-grid {
            grid-template-columns: 1fr;
          }
          
          .summary-cards {
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          }
          
          .bar-chart {
            height: 150px;
          }
        }
      `}</style>
    </div>
  );
}

export default ReportsView;