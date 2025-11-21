/**
 * Email Import Routes
 * Handles IMAP email monitoring for automated shipment import
 */

import { Router, Request, Response } from 'express';
import EmailImporter from '../services/emailImporter.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEmailImportConfig } from '../middleware/validation.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EmailImportConfig {
  user: string;
  password: string;
  host?: string;
  port?: number;
}

let emailImporter: EmailImporter | null = null;

/**
 * POST /api/email-import/test-connection - Test email connection
 */
router.post('/test-connection', validateEmailImportConfig, asyncHandler(async (req: Request, res: Response) => {
  const { user, password, host = 'imap.gmail.com', port = 993 } = req.body as EmailImportConfig;

  if (!user || !password) {
    throw AppError.badRequest('Email credentials required', { message: 'Please provide email user and password' });
  }

  const testImporter = new EmailImporter({
    user,
    password,
    host,
    port
  });

  const success = await testImporter.testConnection();

  res.json({
    success,
    message: success ? 'Email connection successful' : 'Email connection failed'
  });
}));

/**
 * POST /api/email-import/start - Start email monitoring
 */
router.post('/start', validateEmailImportConfig, asyncHandler(async (req: Request, res: Response) => {
  if (emailImporter) {
    return res.json({
      success: true,
      message: 'Email importer is already running',
      status: 'running'
    });
  }

  const { user, password, host = 'imap.gmail.com', port = 993 } = req.body as EmailImportConfig;

  if (!user || !password) {
    throw AppError.badRequest('Email credentials required', { message: 'Please provide email user and password' });
  }

  emailImporter = new EmailImporter({
    user,
    password,
    host,
    port
  });

  // Start monitoring (don't await - it runs continuously)
  emailImporter.start().catch(error => {
    console.error('Email importer error:', error);
    emailImporter = null;
  });

  res.json({
    success: true,
    message: 'Email importer started successfully',
    status: 'running'
  });
}));

/**
 * POST /api/email-import/stop - Stop email monitoring
 */
router.post('/stop', asyncHandler(async (req: Request, res: Response) => {
  if (emailImporter) {
    emailImporter.stop();
    emailImporter = null;
  }

  res.json({
    success: true,
    message: 'Email importer stopped',
    status: 'stopped'
  });
}));

/**
 * GET /api/email-import/status - Get email importer status
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  const status = emailImporter ? 'running' : 'stopped';

  // Get import logs if available
  let recentImports: any[] = [];
  try {
    const logPath = path.join(__dirname, '../data/import_log.json');
    const logData = await fs.readFile(logPath, 'utf-8');
    const logs = JSON.parse(logData);
    recentImports = logs.slice(-10); // Last 10 imports
  } catch (error) {
    // No logs available
  }

  res.json({
    status,
    isRunning: emailImporter !== null,
    recentImports,
    lastCheck: new Date().toISOString()
  });
}));

/**
 * GET /api/email-import/history - Get import history
 */
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const logPath = path.join(__dirname, '../data/import_log.json');

  let logs: any[] = [];
  try {
    const logData = await fs.readFile(logPath, 'utf-8');
    logs = JSON.parse(logData);
  } catch (error) {
    // No logs available
  }

  // Get query parameters for filtering
  const { limit = '50', source, fromDate, toDate } = req.query;

  let filteredLogs = logs;

  // Filter by source
  if (source) {
    filteredLogs = filteredLogs.filter((log: any) => log.source === source);
  }

  // Filter by date range
  if (fromDate) {
    filteredLogs = filteredLogs.filter((log: any) => new Date(log.timestamp) >= new Date(fromDate as string));
  }

  if (toDate) {
    filteredLogs = filteredLogs.filter((log: any) => new Date(log.timestamp) <= new Date(toDate as string));
  }

  // Sort by timestamp (newest first) and limit
  filteredLogs = filteredLogs
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, parseInt(limit as string));

  res.json({
    imports: filteredLogs,
    total: logs.length,
    filtered: filteredLogs.length
  });
}));

/**
 * GET /api/email-import/processed-files - Get processed files list
 */
router.get('/processed-files', asyncHandler(async (req: Request, res: Response) => {
  const processedPath = path.join(__dirname, '../data/processed');

  interface ProcessedFile {
    filename: string;
    size: number;
    processedAt: Date;
    isEmailImport: boolean;
  }

  let files: ProcessedFile[] = [];
  try {
    const fileList = await fs.readdir(processedPath);
    files = await Promise.all(
      fileList.map(async (filename) => {
        const filePath = path.join(processedPath, filename);
        const stats = await fs.stat(filePath);
        return {
          filename,
          size: stats.size,
          processedAt: stats.mtime,
          isEmailImport: filename.includes('_') // Our email imports have timestamp prefix
        };
      })
    );

    // Sort by processed date (newest first)
    files.sort((a, b) => new Date(b.processedAt).getTime() - new Date(a.processedAt).getTime());
  } catch (error) {
    // Directory doesn't exist or is empty
  }

  res.json({
    files,
    total: files.length
  });
}));

/**
 * POST /api/email-import/manual-import - Manual import endpoint for testing
 */
router.post('/manual-import', asyncHandler(async (req: Request, res: Response) => {
  if (!emailImporter) {
    throw AppError.badRequest('Email importer not running', { message: 'Please start the email importer first' });
  }

  // Trigger manual check for new emails
  await emailImporter.processUnreadEmails((emailImporter as any).imap);

  res.json({
    success: true,
    message: 'Manual import check triggered'
  });
}));

/**
 * GET /api/email-import/setup-help - Get configuration help
 */
router.get('/setup-help', (req: Request, res: Response) => {
  res.json({
    title: 'Email Import Setup Guide',
    steps: [
      {
        step: 1,
        title: 'Create Dedicated Email Account',
        description: 'Create a dedicated email account for receiving shipment reports (e.g., shipments@yourcompany.com)'
      },
      {
        step: 2,
        title: 'Enable IMAP Access',
        description: 'Enable IMAP access in your email provider settings',
        providers: {
          gmail: {
            host: 'imap.gmail.com',
            port: 993,
            note: 'Enable "Less secure app access" or use App Password with 2FA'
          },
          outlook: {
            host: 'outlook.office365.com',
            port: 993,
            note: 'Use your full email address as username'
          },
          exchange: {
            host: 'Your Exchange server address',
            port: 993,
            note: 'Contact your IT department for server details'
          }
        }
      },
      {
        step: 3,
        title: 'Configure Suppliers/Partners',
        description: 'Ask suppliers and shipping companies to send reports to your dedicated email',
        supportedFormats: ['.xlsx', '.xls', '.csv'],
        keywords: ['shipment', 'manifest', 'import', 'container', 'cargo', 'synercore']
      },
      {
        step: 4,
        title: 'Test Connection',
        description: 'Use the test connection button to verify your email settings work'
      }
    ],
    security: {
      recommendations: [
        'Use a dedicated email account only for imports',
        'Use App Passwords instead of main password where possible',
        'Restrict email account access to necessary personnel only',
        'Monitor import logs regularly for any issues'
      ]
    }
  });
});

export default router;
