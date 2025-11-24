/**
 * Report Controller
 * Handles all report-related business logic
 */

import { AppError } from '../utils/AppError.ts';
import ReportService, {
  type GenerateReportRequest,
  type ReportFilterParams
} from '../services/ReportService.js';

/**
 * Report Controller Class
 */
export class ReportController {
  /**
   * Generate a new report
   */
  static async generateReport(data: GenerateReportRequest) {
    if (!data.reportData) {
      throw AppError.badRequest('Report data is required');
    }

    const report = await ReportService.generateReport(data);

    return {
      success: true,
      reportId: report.id,
      message: 'Report generated and saved successfully',
      report: {
        id: report.id,
        type: report.type,
        generatedAt: report.generatedAt,
        dateRange: report.dateRange
      }
    };
  }

  /**
   * Get all reports with filtering and pagination
   */
  static async getReports(params: ReportFilterParams) {
    return ReportService.getReports({
      page: params.page || 1,
      limit: params.limit || 10,
      type: params.type,
      startDate: params.startDate,
      endDate: params.endDate,
      search: params.search
    });
  }

  /**
   * Get specific report by ID
   */
  static async getReport(reportId: string) {
    try {
      return await ReportService.getReport(reportId);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        throw AppError.notFound(`Report with ID ${reportId} not found`);
      }
      throw error;
    }
  }

  /**
   * Delete report by ID
   */
  static async deleteReport(reportId: string): Promise<void> {
    try {
      await ReportService.deleteReport(reportId);
    } catch (error: any) {
      if (error.message.includes('not found')) {
        throw AppError.notFound(`Report with ID ${reportId} not found`);
      }
      throw error;
    }
  }

  /**
   * Get workflow analytics
   */
  static async getWorkflowAnalytics() {
    return ReportService.getWorkflowAnalytics();
  }

  /**
   * Get analytics summary by period
   */
  static async getAnalyticsSummary(period: 'daily' | 'weekly' | 'monthly' = 'weekly', limit?: number) {
    return ReportService.getAnalyticsSummary(period, limit || 12);
  }
}

export default ReportController;
