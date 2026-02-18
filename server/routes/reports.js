import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_DIR = path.join(__dirname, '../data/reports');

// Ensure reports directory exists
const ensureReportsDir = async () => {
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create reports directory:', error);
  }
};

// Generate report snapshot
router.post('/generate', async (req, res) => {
  try {
    await ensureReportsDir();

    const { reportData, reportType = 'full', dateRange } = req.body;
    const timestamp = new Date().toISOString();
    const reportId = `${reportType}_${Date.now()}`;

    const report = {
      id: reportId,
      type: reportType,
      generatedAt: timestamp,
      dateRange: dateRange || {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: timestamp
      },
      data: reportData,
      analytics: {
        totalShipments: reportData.totalShipments || 0,
        statusCounts: reportData.statusCounts || {},
        supplierStats: reportData.supplierStats || {},
        forwardingAgentStats: reportData.forwardingAgentStats || {},
        weeklyArrivals: reportData.weeklyArrivals || {},
        productStats: reportData.productStats || {},
        warehouseStats: reportData.warehouseStats || {}
      }
    };

    const filename = `${reportId}.json`;
    const filepath = path.join(REPORTS_DIR, filename);

    await fs.writeFile(filepath, JSON.stringify(report, null, 2));

    res.json({
      success: true,
      reportId: reportId,
      message: 'Report generated and saved successfully',
      report: {
        id: report.id,
        type: report.type,
        generatedAt: report.generatedAt,
        dateRange: report.dateRange
      }
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Get all reports with pagination and filtering
router.get('/', async (req, res) => {
  try {
    await ensureReportsDir();

    const {
      page = 1,
      limit = 10,
      type,
      startDate,
      endDate,
      search
    } = req.query;

    const files = await fs.readdir(REPORTS_DIR);
    const reportFiles = files.filter(file => file.endsWith('.json'));

    const reports = [];

    for (const file of reportFiles) {
      try {
        const filepath = path.join(REPORTS_DIR, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const report = JSON.parse(content);

        // Apply filters
        if (type && report.type !== type) continue;
        if (startDate && new Date(report.generatedAt) < new Date(startDate)) continue;
        if (endDate && new Date(report.generatedAt) > new Date(endDate)) continue;
        if (search && !report.type.toLowerCase().includes(search.toLowerCase())) continue;

        // Only include metadata for listing
        reports.push({
          id: report.id,
          type: report.type,
          generatedAt: report.generatedAt,
          dateRange: report.dateRange,
          analytics: {
            totalShipments: report.analytics.totalShipments,
            totalSuppliers: Object.keys(report.analytics.supplierStats || {}).length,
            totalAgents: Object.keys(report.analytics.forwardingAgentStats || {}).length
          }
        });
      } catch (error) {
        console.error(`Error reading report file ${file}:`, error);
      }
    }

    // Sort by generation date (newest first)
    reports.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));

    // Pagination
    const totalReports = reports.length;
    const totalPages = Math.ceil(totalReports / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedReports = reports.slice(startIndex, endIndex);

    res.json({
      reports: paginatedReports,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalReports,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get specific report by ID
router.get('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const filepath = path.resolve(REPORTS_DIR, `${reportId}.json`);
    if (!filepath.startsWith(path.resolve(REPORTS_DIR))) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    const content = await fs.readFile(filepath, 'utf-8');
    const report = JSON.parse(content);

    res.json(report);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Report not found' });
    } else {
      console.error('Error fetching report:', error);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  }
});

// Delete report
router.delete('/:reportId', async (req, res) => {
  try {
    const { reportId } = req.params;
    const filepath = path.resolve(REPORTS_DIR, `${reportId}.json`);
    if (!filepath.startsWith(path.resolve(REPORTS_DIR))) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    await fs.unlink(filepath);

    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'Report not found' });
    } else {
      console.error('Error deleting report:', error);
      res.status(500).json({ error: 'Failed to delete report' });
    }
  }
});

// Get workflow analytics for post-arrival shipments
router.get('/analytics/workflow', async (req, res) => {
  try {
    // Read the current shipments data
    const shipmentsDataPath = path.join(__dirname, '../data/shipments.json');

    let shipments = [];
    try {
      const shipmentsContent = await fs.readFile(shipmentsDataPath, 'utf-8');
      shipments = JSON.parse(shipmentsContent);
    } catch (error) {
      console.log('No shipments data found, returning empty analytics');
    }

    const POST_ARRIVAL_STATUSES = [
      'arrived_pta',
      'arrived_klm',
      'unloading',
      'inspection_pending',
      'inspecting',
      'inspection_passed',
      'receiving',
      'received',
      'stored'
    ];

    // Filter shipments that are in post-arrival workflow
    const postArrivalShipments = shipments.filter(shipment =>
      POST_ARRIVAL_STATUSES.includes(shipment.latestStatus)
    );

    // Generate analytics
    const statusCounts = {};
    POST_ARRIVAL_STATUSES.forEach(status => {
      statusCounts[status] = 0;
    });

    const warehouseBreakdown = {};
    const supplierWorkflow = {};

    postArrivalShipments.forEach(shipment => {
      const status = shipment.latestStatus;

      // Status counts
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
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
          stuck: 0
        };
      }
      supplierWorkflow[supplier].total++;

      if (status === 'stored') {
        supplierWorkflow[supplier].completed++;
      } else if (['unloading', 'inspecting', 'receiving'].includes(status)) {
        supplierWorkflow[supplier].inProgress++;
      } else if (status === 'arrived_pta' || status === 'arrived_klm' || status === 'inspection_pending') {
        supplierWorkflow[supplier].stuck++;
      }
    });

    const analytics = {
      totalInWorkflow: postArrivalShipments.length,
      statusCounts,
      warehouseBreakdown,
      supplierWorkflow,
      completionRate: postArrivalShipments.length > 0
        ? ((statusCounts.stored / postArrivalShipments.length) * 100).toFixed(1)
        : 0,
      bottlenecks: {
        inspection_pending: statusCounts.inspection_pending,
        arrived: statusCounts.arrived
      },
      generatedAt: new Date().toISOString()
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error generating workflow analytics:', error);
    res.status(500).json({ error: 'Failed to generate workflow analytics' });
  }
});

// Get report analytics summary by date range
router.get('/analytics/summary', async (req, res) => {
  try {
    await ensureReportsDir();

    const {
      period = 'weekly', // weekly, monthly, daily
      limit = 12
    } = req.query;

    const files = await fs.readdir(REPORTS_DIR);
    const reportFiles = files.filter(file => file.endsWith('.json'));

    const reportsByPeriod = {};

    for (const file of reportFiles) {
      try {
        const filepath = path.join(REPORTS_DIR, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const report = JSON.parse(content);

        const date = new Date(report.generatedAt);
        let periodKey;

        if (period === 'daily') {
          periodKey = date.toISOString().split('T')[0];
        } else if (period === 'weekly') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
        } else if (period === 'monthly') {
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!reportsByPeriod[periodKey]) {
          reportsByPeriod[periodKey] = {
            period: periodKey,
            reports: [],
            totalShipments: 0,
            totalSuppliers: new Set(),
            totalAgents: new Set()
          };
        }

        reportsByPeriod[periodKey].reports.push(report.id);
        reportsByPeriod[periodKey].totalShipments += report.analytics.totalShipments || 0;

        Object.keys(report.analytics.supplierStats || {}).forEach(supplier => {
          reportsByPeriod[periodKey].totalSuppliers.add(supplier);
        });

        Object.keys(report.analytics.forwardingAgentStats || {}).forEach(agent => {
          reportsByPeriod[periodKey].totalAgents.add(agent);
        });
      } catch (error) {
        console.error(`Error processing report file ${file}:`, error);
      }
    }

    // Convert sets to counts and sort by period
    const summary = Object.values(reportsByPeriod)
      .map(period => ({
        ...period,
        totalSuppliers: period.totalSuppliers.size,
        totalAgents: period.totalAgents.size,
        reportCount: period.reports.length
      }))
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, limit);

    res.json({
      period,
      summary
    });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

export default router;