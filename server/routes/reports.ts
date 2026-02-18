import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_DIR: string = path.join(__dirname, '../data/reports');

// --- Interfaces ---

interface DateRange {
  start: string;
  end: string;
}

interface ReportAnalytics {
  totalShipments: number;
  statusCounts: Record<string, number>;
  supplierStats: Record<string, unknown>;
  forwardingAgentStats: Record<string, unknown>;
  weeklyArrivals: Record<string, unknown>;
  productStats: Record<string, unknown>;
  warehouseStats: Record<string, unknown>;
}

interface Report {
  id: string;
  type: string;
  generatedAt: string;
  dateRange: DateRange;
  data: Record<string, any>;
  analytics: ReportAnalytics;
}

interface ReportListItem {
  id: string;
  type: string;
  generatedAt: string;
  dateRange: DateRange;
  analytics: {
    totalShipments: number;
    totalSuppliers: number;
    totalAgents: number;
  };
}

interface Shipment {
  latestStatus: string;
  receivingWarehouse?: string;
  finalPod?: string;
  supplier?: string;
  [key: string]: any;
}

interface SupplierWorkflowEntry {
  total: number;
  completed: number;
  inProgress: number;
  stuck: number;
}

interface PeriodAccumulator {
  period: string;
  reports: string[];
  totalShipments: number;
  totalSuppliers: Set<string>;
  totalAgents: Set<string>;
}

// --- Helpers ---

const ensureReportsDir = async (): Promise<void> => {
  try {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
  } catch (error: any) {
    console.error('Failed to create reports directory:', error);
  }
};

// --- Routes ---

// Generate report snapshot
router.post('/generate', async (req: Request, res: Response) => {
  try {
    await ensureReportsDir();

    const { reportData, reportType = 'full', dateRange } = req.body as {
      reportData: Record<string, any>;
      reportType?: string;
      dateRange?: DateRange;
    };
    const timestamp: string = new Date().toISOString();
    const reportId: string = `${reportType}_${Date.now()}`;

    const report: Report = {
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

    const filename: string = `${reportId}.json`;
    const filepath: string = path.join(REPORTS_DIR, filename);

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
  } catch (error: any) {
    console.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Get all reports with pagination and filtering
router.get('/', async (req: Request, res: Response) => {
  try {
    await ensureReportsDir();

    const {
      page = 1,
      limit = 10,
      type,
      startDate,
      endDate,
      search
    } = req.query as {
      page?: string | number;
      limit?: string | number;
      type?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    };

    const files: string[] = await fs.readdir(REPORTS_DIR);
    const reportFiles: string[] = files.filter((file: string) => file.endsWith('.json'));

    const reports: ReportListItem[] = [];

    for (const file of reportFiles) {
      try {
        const filepath: string = path.join(REPORTS_DIR, file);
        const content: string = await fs.readFile(filepath, 'utf-8');
        const report: Report = JSON.parse(content);

        // Apply filters
        if (type && report.type !== type) continue;
        if (startDate && new Date(report.generatedAt) < new Date(startDate as string)) continue;
        if (endDate && new Date(report.generatedAt) > new Date(endDate as string)) continue;
        if (search && !report.type.toLowerCase().includes((search as string).toLowerCase())) continue;

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
      } catch (error: any) {
        console.error(`Error reading report file ${file}:`, error);
      }
    }

    // Sort by generation date (newest first)
    reports.sort((a: ReportListItem, b: ReportListItem) =>
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

    // Pagination
    const pageNum: number = typeof page === 'string' ? parseInt(page, 10) : Number(page);
    const limitNum: number = typeof limit === 'string' ? parseInt(limit, 10) : Number(limit);
    const totalReports: number = reports.length;
    const totalPages: number = Math.ceil(totalReports / limitNum);
    const startIndex: number = (pageNum - 1) * limitNum;
    const endIndex: number = startIndex + limitNum;
    const paginatedReports: ReportListItem[] = reports.slice(startIndex, endIndex);

    res.json({
      reports: paginatedReports,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalReports,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (error: any) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// Get specific report by ID
router.get('/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const filepath: string = path.resolve(REPORTS_DIR, `${reportId}.json`);
    if (!filepath.startsWith(path.resolve(REPORTS_DIR))) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    const content: string = await fs.readFile(filepath, 'utf-8');
    const report: Report = JSON.parse(content);

    res.json(report);
  } catch (error: any) {
    if ((error as any).code === 'ENOENT') {
      res.status(404).json({ error: 'Report not found' });
    } else {
      console.error('Error fetching report:', error);
      res.status(500).json({ error: 'Failed to fetch report' });
    }
  }
});

// Delete report
router.delete('/:reportId', async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const filepath: string = path.resolve(REPORTS_DIR, `${reportId}.json`);
    if (!filepath.startsWith(path.resolve(REPORTS_DIR))) {
      return res.status(400).json({ error: 'Invalid report ID' });
    }

    await fs.unlink(filepath);

    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error: any) {
    if ((error as any).code === 'ENOENT') {
      res.status(404).json({ error: 'Report not found' });
    } else {
      console.error('Error deleting report:', error);
      res.status(500).json({ error: 'Failed to delete report' });
    }
  }
});

// Get workflow analytics for post-arrival shipments
router.get('/analytics/workflow', async (req: Request, res: Response) => {
  try {
    // Read the current shipments data
    const shipmentsDataPath: string = path.join(__dirname, '../data/shipments.json');

    let shipments: Shipment[] = [];
    try {
      const shipmentsContent: string = await fs.readFile(shipmentsDataPath, 'utf-8');
      shipments = JSON.parse(shipmentsContent);
    } catch (error: any) {
      console.log('No shipments data found, returning empty analytics');
    }

    const POST_ARRIVAL_STATUSES: string[] = [
      'arrived_pta', 'arrived_klm', 'arrived_offsite',
      'unloading', 'inspection_pending', 'inspecting',
      'inspection_passed', 'inspection_failed',
      'receiving', 'received', 'stored'
    ];

    // Filter shipments that are in post-arrival workflow
    const postArrivalShipments: Shipment[] = shipments.filter((shipment: Shipment) =>
      POST_ARRIVAL_STATUSES.includes(shipment.latestStatus)
    );

    // Generate analytics
    const statusCounts: Record<string, number> = {};
    POST_ARRIVAL_STATUSES.forEach((status: string) => {
      statusCounts[status] = 0;
    });

    const warehouseBreakdown: Record<string, Record<string, number>> = {};
    const supplierWorkflow: Record<string, SupplierWorkflowEntry> = {};

    postArrivalShipments.forEach((shipment: Shipment) => {
      const status: string = shipment.latestStatus;

      // Status counts
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }

      // Warehouse breakdown
      const warehouse: string = shipment.receivingWarehouse || shipment.finalPod || 'Unknown';
      if (!warehouseBreakdown[warehouse]) {
        warehouseBreakdown[warehouse] = {};
        POST_ARRIVAL_STATUSES.forEach((s: string) => {
          warehouseBreakdown[warehouse][s] = 0;
        });
      }
      warehouseBreakdown[warehouse][status]++;

      // Supplier workflow performance
      const supplier: string = shipment.supplier || 'Unknown';
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
  } catch (error: any) {
    console.error('Error generating workflow analytics:', error);
    res.status(500).json({ error: 'Failed to generate workflow analytics' });
  }
});

// Get report analytics summary by date range
router.get('/analytics/summary', async (req: Request, res: Response) => {
  try {
    await ensureReportsDir();

    const {
      period = 'weekly', // weekly, monthly, daily
      limit = 12
    } = req.query as {
      period?: string;
      limit?: string | number;
    };

    const files: string[] = await fs.readdir(REPORTS_DIR);
    const reportFiles: string[] = files.filter((file: string) => file.endsWith('.json'));

    const reportsByPeriod: Record<string, PeriodAccumulator> = {};

    for (const file of reportFiles) {
      try {
        const filepath: string = path.join(REPORTS_DIR, file);
        const content: string = await fs.readFile(filepath, 'utf-8');
        const report: Report = JSON.parse(content);

        const date: Date = new Date(report.generatedAt);
        let periodKey: string | undefined;

        if (period === 'daily') {
          periodKey = date.toISOString().split('T')[0];
        } else if (period === 'weekly') {
          const weekStart: Date = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0];
        } else if (period === 'monthly') {
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!periodKey) continue;

        if (!reportsByPeriod[periodKey]) {
          reportsByPeriod[periodKey] = {
            period: periodKey,
            reports: [],
            totalShipments: 0,
            totalSuppliers: new Set<string>(),
            totalAgents: new Set<string>()
          };
        }

        reportsByPeriod[periodKey].reports.push(report.id);
        reportsByPeriod[periodKey].totalShipments += report.analytics.totalShipments || 0;

        Object.keys(report.analytics.supplierStats || {}).forEach((supplier: string) => {
          reportsByPeriod[periodKey!].totalSuppliers.add(supplier);
        });

        Object.keys(report.analytics.forwardingAgentStats || {}).forEach((agent: string) => {
          reportsByPeriod[periodKey!].totalAgents.add(agent);
        });
      } catch (error: any) {
        console.error(`Error processing report file ${file}:`, error);
      }
    }

    // Convert sets to counts and sort by period
    const limitNum: number = typeof limit === 'string' ? parseInt(limit, 10) : Number(limit);
    const summary = Object.values(reportsByPeriod)
      .map((periodData: PeriodAccumulator) => ({
        period: periodData.period,
        reports: periodData.reports,
        totalShipments: periodData.totalShipments,
        totalSuppliers: periodData.totalSuppliers.size,
        totalAgents: periodData.totalAgents.size,
        reportCount: periodData.reports.length
      }))
      .sort((a, b) => b.period.localeCompare(a.period))
      .slice(0, limitNum);

    res.json({
      period,
      summary
    });
  } catch (error: any) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({ error: 'Failed to fetch analytics summary' });
  }
});

export default router;
