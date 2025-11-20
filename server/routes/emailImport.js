import express from 'express';
import EmailImporter from '../services/emailImporter.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEmailImportConfig } from '../middleware/validation.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let emailImporter = null;

// Test email connection
router.post('/test-connection', validateEmailImportConfig, async (req, res) => {
  try {
    const { user, password, host, port } = req.body;

    if (!user || !password) {
      return res.status(400).json({
        error: 'Email credentials required',
        message: 'Please provide email user and password'
      });
    }

    const testImporter = new EmailImporter({
      user,
      password,
      host: host || 'imap.gmail.com',
      port: port || 993
    });

    const success = await testImporter.testConnection();

    res.json({
      success,
      message: success ? 'Email connection successful' : 'Email connection failed'
    });

  } catch (error) {
    console.error('Email connection test error:', error);
    res.status(500).json({ error: 'Connection test failed', details: error.message });
  }
});

// Start email monitoring
router.post('/start', validateEmailImportConfig, async (req, res) => {
  try {
    if (emailImporter) {
      return res.json({
        success: true,
        message: 'Email importer is already running',
        status: 'running'
      });
    }

    const { user, password, host, port } = req.body;

    if (!user || !password) {
      return res.status(400).json({
        error: 'Email credentials required',
        message: 'Please provide email user and password'
      });
    }

    emailImporter = new EmailImporter({
      user,
      password,
      host: host || 'imap.gmail.com',
      port: port || 993
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

  } catch (error) {
    console.error('Error starting email importer:', error);
    emailImporter = null;
    res.status(500).json({ error: 'Failed to start email importer', details: error.message });
  }
});

// Stop email monitoring
router.post('/stop', async (req, res) => {
  try {
    if (emailImporter) {
      emailImporter.stop();
      emailImporter = null;
    }

    res.json({
      success: true,
      message: 'Email importer stopped',
      status: 'stopped'
    });

  } catch (error) {
    console.error('Error stopping email importer:', error);
    res.status(500).json({ error: 'Failed to stop email importer', details: error.message });
  }
});

// Get email importer status
router.get('/status', async (req, res) => {
  try {
    const status = emailImporter ? 'running' : 'stopped';

    // Get import logs if available
    let recentImports = [];
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

  } catch (error) {
    console.error('Error getting email importer status:', error);
    res.status(500).json({ error: 'Failed to get status', details: error.message });
  }
});

// Get import history
router.get('/history', async (req, res) => {
  try {
    const logPath = path.join(__dirname, '../data/import_log.json');

    let logs = [];
    try {
      const logData = await fs.readFile(logPath, 'utf-8');
      logs = JSON.parse(logData);
    } catch (error) {
      // No logs available
    }

    // Get query parameters for filtering
    const { limit = 50, source, fromDate, toDate } = req.query;

    let filteredLogs = logs;

    // Filter by source
    if (source) {
      filteredLogs = filteredLogs.filter(log => log.source === source);
    }

    // Filter by date range
    if (fromDate) {
      filteredLogs = filteredLogs.filter(log =>
        new Date(log.timestamp) >= new Date(fromDate)
      );
    }

    if (toDate) {
      filteredLogs = filteredLogs.filter(log =>
        new Date(log.timestamp) <= new Date(toDate)
      );
    }

    // Sort by timestamp (newest first) and limit
    filteredLogs = filteredLogs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));

    res.json({
      imports: filteredLogs,
      total: logs.length,
      filtered: filteredLogs.length
    });

  } catch (error) {
    console.error('Error getting import history:', error);
    res.status(500).json({ error: 'Failed to get import history', details: error.message });
  }
});

// Get processed files list
router.get('/processed-files', async (req, res) => {
  try {
    const processedPath = path.join(__dirname, '../data/processed');

    let files = [];
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
      files.sort((a, b) => new Date(b.processedAt) - new Date(a.processedAt));

    } catch (error) {
      // Directory doesn't exist or is empty
    }

    res.json({
      files,
      total: files.length
    });

  } catch (error) {
    console.error('Error getting processed files:', error);
    res.status(500).json({ error: 'Failed to get processed files', details: error.message });
  }
});

// Manual import endpoint for testing
router.post('/manual-import', async (req, res) => {
  try {
    if (!emailImporter) {
      return res.status(400).json({
        error: 'Email importer not running',
        message: 'Please start the email importer first'
      });
    }

    // Trigger manual check for new emails
    await emailImporter.processUnreadEmails(emailImporter.imap);

    res.json({
      success: true,
      message: 'Manual import check triggered'
    });

  } catch (error) {
    console.error('Error triggering manual import:', error);
    res.status(500).json({ error: 'Failed to trigger manual import', details: error.message });
  }
});

// Get configuration help
router.get('/setup-help', (req, res) => {
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