/**
 * Report Service
 * Handles all report-related file operations and analytics
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REPORTS_DIR = path.join(__dirname, '../data/reports');

/**
 * Report analytics object
 */
export interface ReportAnalytics {
  totalShipments: number;
  statusCounts?: Record<string, number>;
  supplierStats?: Record<string, any>;
  forwardingAgentStats?: Record<string, any>;
  weeklyArrivals?: Record<string, number>;
  productStats?: Record<string, any>;
  warehouseStats?: Record<string, any>;
}

/**
 * Report data structure
 */
export interface Report {
  id: string;
  type: string;
  generatedAt: string;
  dateRange: {
    start: string;
    end: string;
  };
  data?: any;
  analytics: ReportAnalytics;
}

/**
 * Report metadata for listing
 */
export interface ReportMetadata {
  id: string;
  type: string;
  generatedAt: string;
  dateRange: {
    start: string;
    end: string;
  };
  analytics?: {
    totalShipments: number;
    totalSuppliers?: number;
    totalAgents?: number;
  };
}

/**
 * Generate report request
 */
export interface GenerateReportRequest {
  reportData: any;
  reportType?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Report filter parameters
 */
export interface ReportFilterParams {
  page?: number;
  limit?: number;
  type?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

/**
 * Report Service Class
 */
export class ReportService {
  /**
   * Ensure reports directory exists
   */
  static async ensureReportsDir(): Promise<void> {
    try {
      await fs.mkdir(REPORTS_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create reports directory:', error);
    }
  }

  /**
   * Generate and save a report
   */
  static async generateReport(data: GenerateReportRequest): Promise<Report> {
    await this.ensureReportsDir();

    const timestamp = new Date().toISOString();
    const reportType = data.reportType || 'full';
    const reportId = `${reportType}_${Date.now()}`;

    const report: Report = {
      id: reportId,
      type: reportType,
      generatedAt: timestamp,
      dateRange: data.dateRange || {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end: timestamp
      },
      data: data.reportData,
      analytics: {
        totalShipments: data.reportData?.totalShipments || 0,
        statusCounts: data.reportData?.statusCounts || {},
        supplierStats: data.reportData?.supplierStats || {},
        forwardingAgentStats: data.reportData?.forwardingAgentStats || {},
        weeklyArrivals: data.reportData?.weeklyArrivals || {},
        productStats: data.reportData?.productStats || {},
        warehouseStats: data.reportData?.warehouseStats || {}
      }
    };

    const filename = `${reportId}.json`;
    const filepath = path.join(REPORTS_DIR, filename);

    await fs.writeFile(filepath, JSON.stringify(report, null, 2));

    return report;
  }

  /**
   * Get all reports with filtering and pagination
   */
  static async getReports(params: ReportFilterParams): Promise<{
    reports: ReportMetadata[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalReports: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    await this.ensureReportsDir();

    const page = params.page || 1;
    const limit = params.limit || 10;

    const files = await fs.readdir(REPORTS_DIR);
    const reportFiles = files.filter((file) => file.endsWith('.json'));

    const reports: ReportMetadata[] = [];

    for (const file of reportFiles) {
      try {
        const filepath = path.join(REPORTS_DIR, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const report = JSON.parse(content) as Report;

        // Apply filters
        if (params.type && report.type !== params.type) continue;
        if (params.startDate && new Date(report.generatedAt) < new Date(params.startDate))
          continue;
        if (params.endDate && new Date(report.generatedAt) > new Date(params.endDate))
          continue;
        if (
          params.search &&
          !report.type.toLowerCase().includes(params.search.toLowerCase())
        )
          continue;

        // Build metadata
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
    reports.sort(
      (a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );

    // Pagination
    const totalReports = reports.length;
    const totalPages = Math.ceil(totalReports / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedReports = reports.slice(startIndex, endIndex);

    return {
      reports: paginatedReports,
      pagination: {
        currentPage: page,
        totalPages,
        totalReports,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Get specific report by ID
   */
  static async getReport(reportId: string): Promise<Report> {
    const filepath = path.join(REPORTS_DIR, `${reportId}.json`);

    try {
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content) as Report;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Report ${reportId} not found`);
      }
      throw error;
    }
  }

  /**
   * Delete report by ID
   */
  static async deleteReport(reportId: string): Promise<void> {
    const filepath = path.join(REPORTS_DIR, `${reportId}.json`);

    try {
      await fs.unlink(filepath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Report ${reportId} not found`);
      }
      throw error;
    }
  }

  /**
   * Get workflow analytics
   */
  static async getWorkflowAnalytics(): Promise<any> {
    const POST_ARRIVAL_STATUSES = [
      'arrived_pta',
      'arrived_klm',
      'unloading',
      'inspection_pending',
      'inspection_in_progress',
      'inspection_passed',
      'inspection_failed',
      'receiving_goods',
      'stored',
      'archived'
    ];

    // Initialize status counts
    const statusCounts: Record<string, number> = {};
    POST_ARRIVAL_STATUSES.forEach((status) => {
      statusCounts[status] = 0;
    });

    const warehouseBreakdown: Record<string, Record<string, number>> = {};
    const supplierWorkflow: Record<
      string,
      { total: number; completed: number; inProgress: number; stuck: number }
    > = {};

    // Note: In a real implementation, this would query from the database
    // For now, returning a structure that matches the original

    const analytics = {
      totalInWorkflow: 0,
      statusCounts,
      warehouseBreakdown,
      supplierWorkflow,
      completionRate: 0,
      bottlenecks: {
        inspection_pending: 0,
        arrived_pta: 0,
        arrived_klm: 0
      },
      generatedAt: new Date().toISOString()
    };

    return analytics;
  }

  /**
   * Get analytics summary by period
   */
  static async getAnalyticsSummary(
    period: 'daily' | 'weekly' | 'monthly' = 'weekly',
    limit: number = 12
  ): Promise<any> {
    await this.ensureReportsDir();

    const files = await fs.readdir(REPORTS_DIR);
    const reportFiles = files.filter((file) => file.endsWith('.json'));

    const reportsByPeriod: Record<string, any> = {};

    for (const file of reportFiles) {
      try {
        const filepath = path.join(REPORTS_DIR, file);
        const content = await fs.readFile(filepath, 'utf-8');
        const report = JSON.parse(content) as Report;

        const date = new Date(report.generatedAt);
        let periodKey: string;

        if (period === 'daily') {
          periodKey = date.toISOString().split('T')[0]!;
        } else if (period === 'weekly') {
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split('T')[0]!;
        } else if (period === 'monthly') {
          periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } else {
          periodKey = date.toISOString().split('T')[0]!;
        }

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

        Object.keys(report.analytics.supplierStats || {}).forEach((supplier) => {
          reportsByPeriod[periodKey].totalSuppliers.add(supplier);
        });

        Object.keys(report.analytics.forwardingAgentStats || {}).forEach((agent) => {
          reportsByPeriod[periodKey].totalAgents.add(agent);
        });
      } catch (error) {
        console.error(`Error processing report file ${file}:`, error);
      }
    }

    // Convert sets to counts and sort by period
    const summary = Object.values(reportsByPeriod)
      .map((p: any) => ({
        ...p,
        totalSuppliers: p.totalSuppliers.size,
        totalAgents: p.totalAgents.size,
        reportCount: p.reports.length
      }))
      .sort((a: any, b: any) => b.period.localeCompare(a.period))
      .slice(0, limit);

    return {
      period,
      summary
    };
  }
}

export default ReportService;
