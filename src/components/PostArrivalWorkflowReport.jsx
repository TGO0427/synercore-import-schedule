import React, { useMemo, useState, useEffect } from 'react';
import { authFetch } from '../utils/authFetch';
import { getApiUrl } from '../config/api';

const POST_ARRIVAL_STATUSES = [
  'arrived_pta',
  'arrived_klm',
  'arrived_offsite',
  'unloading',
  'inspection_pending',
  'inspecting',
  'inspection_passed',
  'inspection_failed',
  'receiving',
  'received',
  'stored',
  'archived'  // Include archived for historical data
];

const STATUS_DISPLAY_NAMES = {
  'arrived_pta': 'Arrived PTA',
  'arrived_klm': 'Arrived KLM',
  'arrived_offsite': 'Arrived Offsite',
  'unloading': 'Unloading',
  'inspection_pending': 'Inspection Pending',
  'inspecting': 'Inspecting',
  'inspection_passed': 'Inspection Passed',
  'inspection_failed': 'Inspection Failed',
  'receiving': 'Receiving',
  'received': 'Received',
  'stored': 'Stored',
  'archived': 'Archived'
};

const STATUS_COLORS = {
  'arrived_pta': '#28a745',
  'arrived_klm': '#28a745',
  'arrived_offsite': '#28a745',
  'unloading': '#FF9800',
  'inspection_pending': '#9C27B0',
  'inspecting': '#673AB7',
  'inspection_passed': '#4CAF50',
  'inspection_failed': '#dc3545',
  'receiving': '#00BCD4',
  'received': '#8BC34A',
  'stored': '#4CAF50',
  'archived': '#6c757d'
};

function PostArrivalWorkflowReport({ shipments }) {
  const [postArrivalShipments, setPostArrivalShipments] = useState([]);
  const [archivedShipments, setArchivedShipments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all shipments directly from the API for historical data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch ALL shipments from the database (including archived)
        const response = await authFetch(getApiUrl('/api/shipments?limit=10000'));
        if (response.ok) {
          const result = await response.json();
          const allShipments = result.data || result || [];

          // Normalize field names and filter for post-arrival statuses
          const normalized = allShipments.map(s => ({
            ...s,
            latest_status: s.latest_status || s.latestStatus,
            supplier: s.supplier,
            product_name: s.product_name || s.productName,
            receiving_warehouse: s.receiving_warehouse || s.receivingWarehouse
          }));

          // Filter for post-arrival statuses (including archived for historical data)
          const postArrival = normalized.filter(shipment =>
            POST_ARRIVAL_STATUSES.includes(shipment.latest_status)
          );

          console.log('[PostArrivalWorkflowReport] Fetched shipments:', postArrival.length, 'statuses:', [...new Set(postArrival.map(s => s.latest_status))]);
          setPostArrivalShipments(postArrival);
        }
      } catch (error) {
        console.error('Error fetching post-arrival data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const workflowAnalytics = useMemo(() => {
    // Combine post-arrival shipments from API, passed shipments, and archived shipments
    const allShipments = [...postArrivalShipments, ...shipments, ...archivedShipments];

    // Deduplicate by ID
    const uniqueShipments = allShipments.filter((shipment, index, self) =>
      index === self.findIndex(s => s.id === shipment.id)
    );

    // Filter shipments that are in post-arrival workflow
    const filteredPostArrivalShipments = uniqueShipments.filter(shipment =>
      POST_ARRIVAL_STATUSES.includes(shipment.latest_status)
    );

    // Count by status
    const statusCounts = {};
    POST_ARRIVAL_STATUSES.forEach(status => {
      statusCounts[status] = 0;
    });

    // Warehouse breakdown
    const warehouseBreakdown = {};

    // Supplier performance in workflow
    const supplierWorkflow = {};

    // Time analysis
    const timeAnalysis = {
      avgTimeByStage: {},
      totalProcessingTime: 0,
      completedShipments: [],
      currentProcessingTimes: []
    };

    filteredPostArrivalShipments.forEach(shipment => {
      const status = shipment.latest_status;

      // Status counts
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }

      // Time calculations
      const now = new Date();
      const lastUpdated = new Date(shipment.updatedAt || now);

      // Calculate time since last status change (simulated for demo)
      const timeInCurrentStatus = Math.floor((now - lastUpdated) / (1000 * 60 * 60)); // hours

      // For demo purposes, simulate arrival timestamp based on updatedAt
      // In production, this would come from statusHistory
      let arrivedTime = lastUpdated;
      if (!['arrived_pta', 'arrived_klm', 'arrived_offsite'].includes(status)) {
        // Simulate that arrived was some time before current status
        arrivedTime = new Date(lastUpdated.getTime() - (timeInCurrentStatus * 1000 * 60 * 60));
      }

      // Calculate total workflow time for completed shipments (stored or archived)
      if (status === 'stored' || status === 'archived') {
        const totalWorkflowTime = Math.floor((lastUpdated - arrivedTime) / (1000 * 60 * 60)); // hours
        timeAnalysis.completedShipments.push({
          id: shipment.id,
          supplier: shipment.supplier,
          productName: shipment.productName || shipment.orderRef,
          arrivedAt: arrivedTime,
          storedAt: lastUpdated,
          totalTime: totalWorkflowTime
        });
        timeAnalysis.totalProcessingTime += totalWorkflowTime;
      } else {
        // Track current processing times
        const currentProcessingTime = Math.floor((now - arrivedTime) / (1000 * 60 * 60)); // hours
        timeAnalysis.currentProcessingTimes.push({
          id: shipment.id,
          supplier: shipment.supplier,
          productName: shipment.productName || shipment.orderRef,
          status: status,
          arrivedAt: arrivedTime,
          currentTime: currentProcessingTime,
          stuckTime: timeInCurrentStatus
        });
      }

      // Warehouse breakdown
      const warehouse = shipment.receivingWarehouse || shipment.finalPod || 'Unknown';
      if (!warehouseBreakdown[warehouse]) {
        warehouseBreakdown[warehouse] = {};
        POST_ARRIVAL_STATUSES.forEach(s => {
          warehouseBreakdown[warehouse][s] = 0;
        });
      }
      warehouseBreakdown[warehouse][status]++;

      // Supplier workflow performance
      const supplier = shipment.supplier || 'Unknown';
      if (!supplierWorkflow[supplier]) {
        supplierWorkflow[supplier] = {
          total: 0,
          completed: 0,
          inProgress: 0,
          stuck: 0,
          avgProcessingTime: 0,
          completedCount: 0
        };
      }
      supplierWorkflow[supplier].total++;

      if (status === 'stored' || status === 'archived') {
        supplierWorkflow[supplier].completed++;
        supplierWorkflow[supplier].completedCount++;

        // Calculate average processing time for this supplier
        const supplierCompleted = timeAnalysis.completedShipments.filter(s => s.supplier === supplier);
        if (supplierCompleted.length > 0) {
          const totalTime = supplierCompleted.reduce((sum, s) => sum + s.totalTime, 0);
          supplierWorkflow[supplier].avgProcessingTime = Math.round(totalTime / supplierCompleted.length);
        }
      } else if (['unloading', 'inspecting', 'receiving'].includes(status)) {
        supplierWorkflow[supplier].inProgress++;
      } else if (['arrived_pta', 'arrived_klm', 'arrived_offsite', 'inspection_pending'].includes(status)) {
        supplierWorkflow[supplier].stuck++;
      }
    });

    // Calculate average processing time for completed shipments
    timeAnalysis.avgProcessingTime = timeAnalysis.completedShipments.length > 0
      ? Math.round(timeAnalysis.totalProcessingTime / timeAnalysis.completedShipments.length)
      : 0;

    return {
      totalInWorkflow: filteredPostArrivalShipments.length,
      statusCounts,
      warehouseBreakdown,
      supplierWorkflow,
      timeAnalysis,
      completionRate: filteredPostArrivalShipments.length > 0
        ? ((((statusCounts.stored || 0) + (statusCounts.archived || 0)) / filteredPostArrivalShipments.length) * 100).toFixed(1)
        : 0,
      bottlenecks: {
        inspection_pending: statusCounts.inspection_pending,
        arrived: (statusCounts.arrived_pta || 0) + (statusCounts.arrived_klm || 0) + (statusCounts.arrived_offsite || 0)
      }
    };
  }, [postArrivalShipments, shipments, archivedShipments]);

  const WorkflowStatusChart = ({ data }) => {
    const total = Object.values(data).reduce((sum, count) => sum + count, 0);
    if (total === 0) return <div className="no-data">No shipments in post-arrival workflow</div>;

    return (
      <div className="workflow-status-chart">
        <h4>📋 Workflow Status Distribution</h4>
        <div className="status-grid">
          {POST_ARRIVAL_STATUSES.map(status => {
            const count = data[status] || 0;
            const percentage = ((count / total) * 100).toFixed(1);

            return (
              <div key={status} className="status-item">
                <div className="status-header">
                  <div
                    className="status-indicator"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  ></div>
                  <span className="status-name">{STATUS_DISPLAY_NAMES[status]}</span>
                </div>
                <div className="status-stats">
                  <span className="count">{count}</span>
                  <span className="percentage">({percentage}%)</span>
                </div>
                <div className="status-bar">
                  <div
                    className="status-fill"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: STATUS_COLORS[status]
                    }}
                  ></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const WarehouseWorkflowTable = ({ data }) => {
    const warehouses = Object.keys(data);
    if (warehouses.length === 0) return <div className="no-data">No warehouse data available</div>;

    return (
      <div className="warehouse-workflow-table">
        <h4>🏭 Warehouse Workflow Status</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Arrived</th>
                <th>Unloading</th>
                <th>Inspection</th>
                <th>Receiving</th>
                <th>Stored</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.map(warehouse => {
                const warehouseData = data[warehouse];
                const total = Object.values(warehouseData).reduce((sum, count) => sum + count, 0);

                return (
                  <tr key={warehouse}>
                    <td className="warehouse-name">{warehouse}</td>
                    <td className="status-cell arrived">{(warehouseData.arrived_pta || 0) + (warehouseData.arrived_klm || 0) + (warehouseData.arrived_offsite || 0)}</td>
                    <td className="status-cell unloading">{warehouseData.unloading || 0}</td>
                    <td className="status-cell inspection">
                      {(warehouseData.inspection_pending || 0) + (warehouseData.inspecting || 0) + (warehouseData.inspection_passed || 0) + (warehouseData.inspection_failed || 0)}
                    </td>
                    <td className="status-cell receiving">
                      {(warehouseData.receiving || 0) + (warehouseData.received || 0)}
                    </td>
                    <td className="status-cell stored">{warehouseData.stored || 0}</td>
                    <td className="total-cell">{total}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const SupplierWorkflowTable = ({ data, shipments }) => {
    const suppliers = Object.entries(data)
      .sort(([,a], [,b]) => b.total - a.total)
      .slice(0, 10);

    if (suppliers.length === 0) return <div className="no-data">No supplier data available</div>;

    // Get example products for each supplier
    const getSupplierExample = (supplierName) => {
      const supplierShipments = shipments.filter(s =>
        (s.supplier || 'Unknown') === supplierName &&
        POST_ARRIVAL_STATUSES.includes(s.latest_status)
      );

      if (supplierShipments.length > 0) {
        const example = supplierShipments[0];
        const productRef = example.orderRef || example.productName;
        return productRef ? `${productRef}` : 'Various Products';
      }
      return 'Various Products';
    };

    return (
      <div className="supplier-workflow-table">
        <h4>🏢 Supplier Workflow Performance</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Supplier & Product Example</th>
                <th>Total</th>
                <th>Completed</th>
                <th>In Progress</th>
                <th>Stuck</th>
                <th>Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(([supplier, stats]) => {
                const efficiency = stats.total > 0 ?
                  ((stats.completed / stats.total) * 100).toFixed(1) : 0;
                const example = getSupplierExample(supplier);

                return (
                  <tr key={supplier}>
                    <td className="supplier-name">
                      <div className="supplier-details">
                        <div className="supplier-main">{supplier}</div>
                        <div className="supplier-example">{example}</div>
                      </div>
                    </td>
                    <td>{stats.total}</td>
                    <td className="status-completed">{stats.completed}</td>
                    <td className="status-progress">{stats.inProgress}</td>
                    <td className="status-stuck">{stats.stuck}</td>
                    <td>
                      <div className="efficiency-bar">
                        <div
                          className="efficiency-fill"
                          style={{ width: `${efficiency}%` }}
                        ></div>
                        <span className="efficiency-text">{efficiency}%</span>
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

  const WorkflowTimeCards = ({ timeAnalysis }) => (
    <div className="stats-grid">
      <div className="stat-card ring-accent">
        <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, backgroundColor: 'rgba(5,150,105,0.1)', marginBottom: 10 }}>⏱️</div>
        <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>{timeAnalysis.avgProcessingTime}h</h3>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>Avg. Processing Time</p>
      </div>
      <div className="stat-card ring-success">
        <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, backgroundColor: 'rgba(16,185,129,0.1)', marginBottom: 10 }}>🏁</div>
        <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>{timeAnalysis.completedShipments.length}</h3>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>Completed Shipments</p>
      </div>
      <div className="stat-card ring-info">
        <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, backgroundColor: 'rgba(59,130,246,0.1)', marginBottom: 10 }}>🔄</div>
        <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>{timeAnalysis.currentProcessingTimes.length}</h3>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>Currently Processing</p>
      </div>
      <div className="stat-card ring-danger">
        <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, backgroundColor: 'rgba(239,68,68,0.1)', marginBottom: 10 }}>⚠️</div>
        <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>
          {timeAnalysis.currentProcessingTimes.filter(ship =>
            ship.currentTime > 72 || ship.stuckTime > 24
          ).length}
        </h3>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>Delayed Shipments</p>
      </div>
    </div>
  );

  const CompletedShipmentsTable = ({ completedShipments }) => {
    if (completedShipments.length === 0) {
      return <div className="no-data">No completed shipments to display</div>;
    }

    const sortedShipments = completedShipments
      .sort((a, b) => new Date(b.storedAt) - new Date(a.storedAt))
      .slice(0, 10);

    return (
      <div className="completed-shipments-table">
        <h4>🏁 Recently Completed Shipments (Arrived → Stored)</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Supplier & Product</th>
                <th>Arrived Date & Time</th>
                <th>Stored Date & Time</th>
                <th>Total Time</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {sortedShipments.map((shipment) => {
                const performanceClass = shipment.totalTime <= 48 ? 'excellent' :
                                       shipment.totalTime <= 72 ? 'good' : 'needs-improvement';

                return (
                  <tr key={shipment.id}>
                    <td className="shipment-details">
                      <div className="supplier-name">{shipment.supplier}</div>
                      <div className="product-ref">{shipment.productName}</div>
                    </td>
                    <td className="timestamp">
                      <div className="date">{shipment.arrivedAt.toLocaleDateString()}</div>
                      <div className="time">{shipment.arrivedAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="timestamp">
                      <div className="date">{shipment.storedAt.toLocaleDateString()}</div>
                      <div className="time">{shipment.storedAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="duration">
                      <span className="hours">{shipment.totalTime}h</span>
                      <span className="days">({Math.round(shipment.totalTime / 24 * 10) / 10}d)</span>
                    </td>
                    <td className={`performance ${performanceClass}`}>
                      {performanceClass === 'excellent' ? '🟢 Excellent' :
                       performanceClass === 'good' ? '🟡 Good' : '🔴 Slow'}
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

  const CurrentProcessingTable = ({ currentProcessingTimes }) => {
    if (currentProcessingTimes.length === 0) {
      return <div className="no-data">No shipments currently in processing</div>;
    }

    const sortedShipments = currentProcessingTimes
      .sort((a, b) => b.currentTime - a.currentTime)
      .slice(0, 10);

    return (
      <div className="current-processing-table">
        <h4>🔄 Currently Processing Shipments</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Supplier & Product</th>
                <th>Current Status</th>
                <th>Arrived Date & Time</th>
                <th>Time in Workflow</th>
                <th>Time in Current Status</th>
                <th>Alert</th>
              </tr>
            </thead>
            <tbody>
              {sortedShipments.map((shipment) => {
                const isDelayed = shipment.currentTime > 72;
                const isStuck = shipment.stuckTime > 24;

                return (
                  <tr key={shipment.id} className={isDelayed ? 'delayed-row' : ''}>
                    <td className="shipment-details">
                      <div className="supplier-name">{shipment.supplier}</div>
                      <div className="product-ref">{shipment.productName}</div>
                    </td>
                    <td className="current-status">
                      <span className={`status-badge ${shipment.status}`}>
                        {STATUS_DISPLAY_NAMES[shipment.status]}
                      </span>
                    </td>
                    <td className="timestamp">
                      <div className="date">{shipment.arrivedAt.toLocaleDateString()}</div>
                      <div className="time">{shipment.arrivedAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                    </td>
                    <td className="duration">
                      <span className="hours">{shipment.currentTime}h</span>
                      <span className="days">({Math.round(shipment.currentTime / 24 * 10) / 10}d)</span>
                    </td>
                    <td className="duration">
                      <span className="hours">{shipment.stuckTime}h</span>
                    </td>
                    <td className="alert-status">
                      {isDelayed ? '🚨 Delayed' : isStuck ? '⚠️ Stuck' : '✅ Normal'}
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

  const WorkflowSummaryCards = ({ analytics }) => (
    <div className="stats-grid">
      <div className="stat-card ring-accent">
        <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, backgroundColor: 'rgba(5,150,105,0.1)', marginBottom: 10 }}>📦</div>
        <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>{analytics.totalInWorkflow}</h3>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>Total in Workflow</p>
      </div>
      <div className="stat-card ring-success">
        <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, backgroundColor: 'rgba(16,185,129,0.1)', marginBottom: 10 }}>✅</div>
        <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>{(analytics.statusCounts.stored || 0) + (analytics.statusCounts.archived || 0)}</h3>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>Completed (Stored/Archived)</p>
      </div>
      <div className="stat-card ring-info">
        <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, backgroundColor: 'rgba(59,130,246,0.1)', marginBottom: 10 }}>🔄</div>
        <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>
          {(analytics.statusCounts.unloading || 0) +
           (analytics.statusCounts.inspecting || 0) +
           (analytics.statusCounts.receiving || 0)}
        </h3>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>Actively Processing</p>
      </div>
      <div className="stat-card ring-warning">
        <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, backgroundColor: 'rgba(245,158,11,0.1)', marginBottom: 10 }}>⚠️</div>
        <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>{analytics.bottlenecks.inspection_pending + analytics.bottlenecks.arrived}</h3>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>Potential Bottlenecks</p>
      </div>
      <div className="stat-card ring-accent">
        <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, backgroundColor: 'rgba(5,150,105,0.1)', marginBottom: 10 }}>📊</div>
        <h3 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 4px', color: 'var(--navy-900)' }}>{analytics.completionRate}%</h3>
        <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600, color: 'var(--text-500)', margin: 0 }}>Completion Rate</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="post-arrival-workflow-report">
        <div className="report-header">
          <h3>🚛 Post-Arrival Workflow Management Report</h3>
          <p>Loading post-arrival workflow data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="post-arrival-workflow-report">
      <div className="report-header">
        <h3>🚛 Post-Arrival Workflow Management Report</h3>
        <p>Current status of all shipments in the post-arrival workflow process with time tracking from arrival to storage</p>
      </div>

      <WorkflowSummaryCards analytics={workflowAnalytics} />

      <div className="section-divider">
        <h4>⏱️ Time & Date Management</h4>
      </div>

      <WorkflowTimeCards timeAnalysis={workflowAnalytics.timeAnalysis} />

      <div className="workflow-charts-grid">
        <div className="chart-section">
          <WorkflowStatusChart data={workflowAnalytics.statusCounts} />
        </div>

        <div className="chart-section">
          <WarehouseWorkflowTable data={workflowAnalytics.warehouseBreakdown} />
        </div>
      </div>

      <div className="full-width-section">
        <SupplierWorkflowTable data={workflowAnalytics.supplierWorkflow} shipments={[...shipments, ...archivedShipments]} />
      </div>

      <div className="time-tracking-section">
        <div className="full-width-section">
          <CompletedShipmentsTable completedShipments={workflowAnalytics.timeAnalysis.completedShipments} />
        </div>

        <div className="full-width-section">
          <CurrentProcessingTable currentProcessingTimes={workflowAnalytics.timeAnalysis.currentProcessingTimes} />
        </div>
      </div>

      <style>{`
        .post-arrival-workflow-report {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          margin-bottom: 2rem;
        }

        .report-header {
          text-align: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 2px solid #eee;
        }

        .report-header h3 {
          color: #2c3e50;
          margin-bottom: 0.5rem;
          font-size: 1.5rem;
        }

        .report-header p {
          color: #7f8c8d;
          margin: 0;
        }

        .workflow-charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .chart-section {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }

        .workflow-status-chart h4,
        .warehouse-workflow-table h4,
        .supplier-workflow-table h4 {
          color: #2c3e50;
          margin-bottom: 1rem;
          font-size: 1.1rem;
        }

        .status-grid {
          display: grid;
          gap: 0.75rem;
        }

        .status-item {
          background: white;
          padding: 0.75rem;
          border-radius: 6px;
          border: 1px solid #eee;
        }

        .status-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .status-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .status-name {
          font-weight: 500;
          font-size: 0.9rem;
        }

        .status-stats {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .count {
          font-size: 1.2rem;
          font-weight: bold;
          color: #2c3e50;
        }

        .percentage {
          font-size: 0.8rem;
          color: #7f8c8d;
        }

        .status-bar {
          height: 4px;
          background: #eee;
          border-radius: 2px;
          overflow: hidden;
        }

        .status-fill {
          height: 100%;
          transition: width 0.3s;
        }

        .table-container {
          overflow-x: auto;
        }

        .warehouse-workflow-table table,
        .supplier-workflow-table table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 6px;
          overflow: hidden;
        }

        .warehouse-workflow-table th,
        .warehouse-workflow-table td,
        .supplier-workflow-table th,
        .supplier-workflow-table td {
          padding: 0.75rem 0.5rem;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .warehouse-workflow-table th,
        .supplier-workflow-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #2c3e50;
          font-size: 0.9rem;
        }

        .warehouse-name,
        .supplier-name {
          font-weight: 500;
          color: #2c3e50;
        }

        .supplier-details {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .supplier-main {
          font-weight: 600;
          color: #2c3e50;
          font-size: 0.95rem;
        }

        .supplier-example {
          font-size: 0.8rem;
          color: #7f8c8d;
          font-style: italic;
          background: #f8f9fa;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          border-left: 3px solid #059669;
        }

        .status-cell {
          text-align: center;
          font-weight: 500;
        }

        .status-cell.arrived { color: #2196F3; }
        .status-cell.unloading { color: #FF9800; }
        .status-cell.inspection { color: #9C27B0; }
        .status-cell.receiving { color: #00BCD4; }
        .status-cell.stored { color: #4CAF50; }

        .status-completed { color: #4CAF50; font-weight: 500; }
        .status-progress { color: #FF9800; font-weight: 500; }
        .status-stuck { color: #F44336; font-weight: 500; }

        .total-cell {
          font-weight: bold;
          background: #f8f9fa;
        }

        .efficiency-bar {
          position: relative;
          background: #eee;
          height: 16px;
          border-radius: 8px;
          overflow: hidden;
          min-width: 60px;
        }

        .efficiency-fill {
          background: linear-gradient(90deg, #f44336 0%, #ff9800 50%, #4caf50 100%);
          height: 100%;
          border-radius: 8px;
          transition: width 0.3s;
        }

        .efficiency-text {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 0.7rem;
          font-weight: 500;
          color: white;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }

        .no-data {
          text-align: center;
          padding: 2rem;
          color: #7f8c8d;
          background: #f8f9fa;
          border-radius: 6px;
          border: 1px solid #dee2e6;
        }

        .full-width-section {
          background: #f8f9fa;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }

        .section-divider {
          text-align: center;
          margin: 2rem 0 1rem 0;
          padding: 1rem 0;
          border-top: 2px solid #059669;
          border-bottom: 1px solid #eee;
        }

        .section-divider h4 {
          color: #059669;
          margin: 0;
          font-size: 1.3rem;
          font-weight: 600;
        }

        .time-tracking-section {
          margin-top: 2rem;
        }

        .time-tracking-section .full-width-section {
          margin-bottom: 1.5rem;
        }

        .completed-shipments-table h4,
        .current-processing-table h4 {
          color: #2c3e50;
          margin-bottom: 1rem;
          font-size: 1.1rem;
        }

        .completed-shipments-table table,
        .current-processing-table table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border-radius: 6px;
          overflow: hidden;
        }

        .completed-shipments-table th,
        .completed-shipments-table td,
        .current-processing-table th,
        .current-processing-table td {
          padding: 0.75rem 0.5rem;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .completed-shipments-table th,
        .current-processing-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #2c3e50;
          font-size: 0.9rem;
        }

        .shipment-details {
          min-width: 200px;
        }

        .shipment-details .supplier-name {
          font-weight: 600;
          color: #2c3e50;
          font-size: 0.95rem;
        }

        .shipment-details .product-ref {
          font-size: 0.8rem;
          color: #7f8c8d;
          font-style: italic;
          margin-top: 0.2rem;
        }

        .timestamp {
          font-family: monospace;
          font-size: 0.85rem;
        }

        .timestamp .date {
          font-weight: 500;
          color: #2c3e50;
        }

        .timestamp .time {
          color: #7f8c8d;
          font-size: 0.8rem;
        }

        .duration {
          font-family: monospace;
          font-weight: 500;
          text-align: center;
        }

        .duration .hours {
          color: #2c3e50;
          font-size: 0.95rem;
        }

        .duration .days {
          color: #7f8c8d;
          font-size: 0.8rem;
          margin-left: 0.3rem;
        }

        .performance.excellent {
          color: #4CAF50;
          font-weight: 500;
        }

        .performance.good {
          color: #FF9800;
          font-weight: 500;
        }

        .performance.needs-improvement {
          color: #F44336;
          font-weight: 500;
        }

        .current-status {
          text-align: center;
        }

        .status-badge {
          padding: 0.3rem 0.6rem;
          border-radius: 12px;
          font-size: 0.8rem;
          font-weight: 500;
          color: white;
          text-transform: uppercase;
        }

        .status-badge.arrived { background-color: #2196F3; }
        .status-badge.unloading { background-color: #FF9800; }
        .status-badge.inspection_pending { background-color: #9C27B0; }
        .status-badge.inspecting { background-color: #673AB7; }
        .status-badge.inspection_passed { background-color: #4CAF50; }
        .status-badge.receiving { background-color: #00BCD4; }
        .status-badge.received { background-color: #8BC34A; }
        .status-badge.stored { background-color: #4CAF50; }

        .alert-status {
          text-align: center;
          font-weight: 500;
        }

        .delayed-row {
          background-color: #fff3e0;
          border-left: 4px solid #FF9800;
        }

        .delayed-row:hover {
          background-color: #ffe0b2;
        }

        @media (max-width: 768px) {
          .workflow-charts-grid {
            grid-template-columns: 1fr;
          }

          .completed-shipments-table,
          .current-processing-table {
            overflow-x: auto;
          }

          .completed-shipments-table table,
          .current-processing-table table {
            min-width: 600px;
          }
        }
      `}</style>
    </div>
  );
}

export default PostArrivalWorkflowReport;