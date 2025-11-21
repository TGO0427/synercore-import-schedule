import Imap from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { Shipment } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EmailImporterConfig {
  user?: string;
  password?: string;
  host?: string;
  port?: number;
  tls?: boolean;
  authTimeout?: number;
  connTimeout?: number;
  keepalive?: boolean;
  [key: string]: any;
}

interface ImportMetadata {
  source: string;
  emailFrom?: string;
  emailSubject?: string;
  emailDate?: Date;
  originalFilename?: string;
}

interface ImportActivity {
  timestamp: string;
  source: string;
  emailFrom?: string;
  emailSubject?: string;
  attachmentsProcessed: number;
  totalAttachments: number;
}

class EmailImporter {
  private config: EmailImporterConfig;
  private dataPath: string;
  private importsPath: string;
  private processedPath: string;
  private supportedFormats: string[];
  private isProcessing: boolean;

  constructor(config: EmailImporterConfig) {
    this.config = {
      user: config.user || process.env.EMAIL_USER,
      password: config.password || process.env.EMAIL_PASSWORD,
      host: config.host || process.env.EMAIL_HOST || 'imap.gmail.com',
      port: config.port || 993,
      tls: true,
      authTimeout: 10000,
      connTimeout: 10000,
      keepalive: false,
      ...config
    };

    this.dataPath = path.join(__dirname, '../data');
    this.importsPath = path.join(__dirname, '../data/imports');
    this.processedPath = path.join(__dirname, '../data/processed');

    this.supportedFormats = ['.xlsx', '.xls', '.csv'];
    this.isProcessing = false;

    console.log('Email Importer initialized');
  }

  async start(): Promise<void> {
    console.log('Starting email import monitoring...');

    try {
      await this.ensureDirectories();
      await this.connectAndWatch();
    } catch (error) {
      console.error('Failed to start email importer:', error);
      setTimeout(() => this.start(), 30000); // Retry after 30 seconds
    }
  }

  async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.importsPath, { recursive: true });
      await fs.mkdir(this.processedPath, { recursive: true });
    } catch (error) {
      console.error('Error creating directories:', error);
    }
  }

  async connectAndWatch(): Promise<void> {
    return new Promise((resolve, reject) => {
      const imap = new Imap(this.config);

      imap.once('ready', () => {
        console.log('✅ Connected to email server');

        // Open inbox
        imap.openBox('INBOX', false, (err: any, box: any) => {
          if (err) {
            console.error('Error opening inbox:', err);
            reject(err);
            return;
          }

          console.log(`📧 Monitoring inbox (${box.messages.total} total messages)`);

          // Process existing unread emails on startup
          this.processUnreadEmails(imap);

          // Listen for new emails
          imap.on('mail', (numNewMsgs: number) => {
            console.log(`📬 Received ${numNewMsgs} new email(s)`);
            this.processUnreadEmails(imap);
          });

          resolve();
        });
      });

      imap.once('error', (err: any) => {
        console.error('IMAP error:', err);
        reject(err);
      });

      imap.once('end', () => {
        console.log('📧 Email connection ended, reconnecting...');
        setTimeout(() => this.start(), 5000);
      });

      imap.connect();
    });
  }

  async processUnreadEmails(imap: Imap): Promise<void> {
    if (this.isProcessing) {
      console.log('Already processing emails, skipping...');
      return;
    }

    this.isProcessing = true;

    try {
      // Search for unread emails
      imap.search(['UNSEEN'], async (err: any, results: any) => {
        if (err) {
          console.error('Search error:', err);
          this.isProcessing = false;
          return;
        }

        if (!results || results.length === 0) {
          console.log('No unread emails found');
          this.isProcessing = false;
          return;
        }

        console.log(`📧 Processing ${results.length} unread email(s)...`);

        // Fetch emails
        const fetch = imap.fetch(results, {
          bodies: '',
          markSeen: false // Don't mark as read yet
        });

        fetch.on('message', (msg: any, seqno: number) => {
          this.processMessage(msg, seqno, imap);
        });

        fetch.once('error', (err: any) => {
          console.error('Fetch error:', err);
          this.isProcessing = false;
        });

        fetch.once('end', () => {
          console.log('✅ Finished processing emails');
          this.isProcessing = false;
        });
      });
    } catch (error) {
      console.error('Error processing emails:', error);
      this.isProcessing = false;
    }
  }

  processMessage(msg: any, seqno: number, imap: Imap): void {
    let buffer = '';

    msg.on('body', (stream: any, info: any) => {
      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('binary');
      });

      stream.once('end', async () => {
        try {
          const parsed = await simpleParser(buffer);

          console.log(`📧 Email from: ${parsed.from?.text || 'Unknown'}`);
          console.log(`📧 Subject: ${parsed.subject || 'No subject'}`);
          console.log(`📧 Attachments: ${parsed.attachments?.length || 0}`);

          // Check if email has relevant attachments
          const hasRelevantAttachments = this.hasRelevantAttachments(parsed);

          if (hasRelevantAttachments) {
            await this.processAttachments(parsed, seqno);

            // Mark email as read after successful processing
            imap.addFlags(seqno, ['\\Seen'], (err: any) => {
              if (err) console.error('Error marking email as read:', err);
              else console.log(`✅ Email ${seqno} marked as processed`);
            });
          } else {
            console.log(`❌ Email ${seqno} has no relevant attachments, skipping`);
          }
        } catch (error) {
          console.error(`Error parsing email ${seqno}:`, error);
        }
      });
    });

    msg.once('attributes', (attrs: any) => {
      console.log(`📧 Processing email ${seqno} (${attrs.date})`);
    });

    msg.once('end', () => {
      // Message processing complete
    });
  }

  hasRelevantAttachments(parsed: ParsedMail): boolean {
    if (!parsed.attachments || parsed.attachments.length === 0) {
      return false;
    }

    return parsed.attachments.some(attachment => {
      const filename = attachment.filename?.toLowerCase() || '';
      const hasValidExtension = this.supportedFormats.some(ext => filename.endsWith(ext));
      const hasShipmentKeywords = this.containsShipmentKeywords(filename) || this.containsShipmentKeywords(parsed.subject);

      return hasValidExtension && hasShipmentKeywords;
    });
  }

  containsShipmentKeywords(text?: string): boolean {
    if (!text) return false;

    const keywords = [
      'shipment', 'shipping', 'manifest', 'import', 'export',
      'container', 'cargo', 'freight', 'logistics', 'schedule',
      'arrival', 'departure', 'vessel', 'bill of lading', 'BOL',
      'synercore', 'inventory', 'delivery', 'warehouse'
    ];

    const textLower = text.toLowerCase();
    return keywords.some(keyword => textLower.includes(keyword));
  }

  async processAttachments(parsed: ParsedMail, seqno: number): Promise<void> {
    console.log(`📎 Processing ${parsed.attachments!.length} attachment(s) from email ${seqno}`);

    let processedCount = 0;

    for (const attachment of parsed.attachments || []) {
      try {
        const filename = attachment.filename!;
        const extension = path.extname(filename).toLowerCase();

        if (!this.supportedFormats.includes(extension)) {
          console.log(`❌ Skipping unsupported file: ${filename}`);
          continue;
        }

        if (!this.containsShipmentKeywords(filename)) {
          console.log(`❌ Skipping non-shipment file: ${filename}`);
          continue;
        }

        console.log(`📎 Processing attachment: ${filename}`);

        // Save attachment to imports folder
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safeFilename = `${timestamp}_${filename.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const attachmentPath = path.join(this.importsPath, safeFilename);

        await fs.writeFile(attachmentPath, attachment.content);
        console.log(`💾 Saved attachment: ${safeFilename}`);

        // Process the file
        const success = await this.processImportFile(attachmentPath, {
          source: 'email',
          emailFrom: parsed.from?.text,
          emailSubject: parsed.subject,
          emailDate: parsed.date as any,
          originalFilename: filename
        });

        if (success) {
          processedCount++;

          // Move to processed folder
          const processedPath = path.join(this.processedPath, safeFilename);
          await fs.rename(attachmentPath, processedPath);
          console.log(`✅ Successfully processed: ${filename}`);
        } else {
          console.log(`❌ Failed to process: ${filename}`);
        }

      } catch (error) {
        console.error(`Error processing attachment ${attachment.filename}:`, error);
      }
    }

    console.log(`✅ Processed ${processedCount} attachment(s) from email ${seqno}`);

    // Log import summary
    await this.logImportActivity({
      timestamp: new Date().toISOString(),
      source: 'email',
      emailFrom: parsed.from?.text,
      emailSubject: parsed.subject,
      attachmentsProcessed: processedCount,
      totalAttachments: parsed.attachments?.length || 0
    });
  }

  async processImportFile(filePath: string, metadata: ImportMetadata = {} as ImportMetadata): Promise<boolean> {
    try {
      const extension = path.extname(filePath).toLowerCase();
      let data: any[] | undefined;

      console.log(`📊 Reading file: ${path.basename(filePath)}`);

      if (extension === '.csv') {
        // Handle CSV files
        const csvData = await fs.readFile(filePath, 'utf-8');
        data = this.parseCSV(csvData);
      } else if (extension === '.xlsx' || extension === '.xls') {
        // Handle Excel files
        const workbook = XLSX.readFile(filePath);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        data = XLSX.utils.sheet_to_json(worksheet);
      }

      if (!data || data.length === 0) {
        console.log('❌ No data found in file');
        return false;
      }

      console.log(`📊 Found ${data.length} rows of data`);

      // Transform data to shipment format
      const shipments = await this.transformToShipmentFormat(data, metadata);

      if (shipments.length === 0) {
        console.log('❌ No valid shipments found after transformation');
        return false;
      }

      // Update shipments data
      await this.updateShipmentsData(shipments, metadata);

      console.log(`✅ Successfully imported ${shipments.length} shipment(s)`);
      return true;

    } catch (error) {
      console.error('Error processing import file:', error);
      return false;
    }
  }

  parseCSV(csvData: string): any[] {
    const lines = csvData.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  }

  async transformToShipmentFormat(data: any[], metadata: ImportMetadata): Promise<any[]> {
    const shipments: any[] = [];

    // Common field mappings
    const fieldMappings: Record<string, string[]> = {
      // ID fields
      id: ['id', 'shipment_id', 'reference', 'ref', 'order_ref', 'po_number'],

      // Supplier fields
      supplier: ['supplier', 'vendor', 'shipper', 'company', 'supplier_name'],

      // Product fields
      productName: ['product', 'product_name', 'description', 'item', 'material'],

      // Quantity fields
      quantity: ['quantity', 'qty', 'amount', 'weight', 'tonnage'],
      cbm: ['cbm', 'volume', 'cubic_meters', 'pallet_qty'],

      // Status fields
      latestStatus: ['status', 'current_status', 'shipment_status', 'state'],

      // Location fields
      finalPod: ['destination', 'pod', 'final_destination', 'warehouse', 'receiving_warehouse'],
      receivingWarehouse: ['warehouse', 'receiving_warehouse', 'destination_warehouse'],

      // Date fields
      etaDate: ['eta', 'estimated_arrival', 'arrival_date', 'expected_arrival'],
      weekNumber: ['week', 'week_number', 'eta_week', 'arrival_week'],

      // Other fields
      orderRef: ['order_ref', 'po_number', 'reference_number', 'booking_ref'],
      forwardingAgent: ['agent', 'forwarding_agent', 'logistics_provider', 'carrier']
    };

    for (const row of data) {
      try {
        const shipment: any = {};

        // Map fields using fuzzy matching
        for (const [targetField, possibleFields] of Object.entries(fieldMappings)) {
          const value = this.findFieldValue(row, possibleFields);
          if (value !== null && value !== undefined && value !== '') {
            shipment[targetField] = this.transformFieldValue(targetField, value);
          }
        }

        // Generate ID if not provided
        if (!shipment.id) {
          shipment.id = this.generateShipmentId(shipment);
        }

        // Set default values
        shipment.createdAt = shipment.createdAt || new Date().toISOString();
        shipment.updatedAt = new Date().toISOString();
        shipment.importSource = 'email';
        shipment.importMetadata = metadata;

        // Validate required fields
        if (this.isValidShipment(shipment)) {
          shipments.push(shipment);
        } else {
          console.log(`❌ Skipping invalid shipment:`, Object.keys(shipment).length > 0 ? shipment : row);
        }

      } catch (error) {
        console.error('Error transforming row:', error, row);
      }
    }

    return shipments;
  }

  findFieldValue(row: any, possibleFields: string[]): any {
    for (const field of possibleFields) {
      // Check exact match
      if (row[field] !== undefined) {
        return row[field];
      }

      // Check case-insensitive match
      const lowerField = field.toLowerCase();
      for (const [key, value] of Object.entries(row)) {
        if (key.toLowerCase() === lowerField) {
          return value;
        }
      }

      // Check partial match
      for (const [key, value] of Object.entries(row)) {
        if (key.toLowerCase().includes(lowerField) || lowerField.includes(key.toLowerCase())) {
          return value;
        }
      }
    }

    return null;
  }

  transformFieldValue(field: string, value: any): any {
    if (value === null || value === undefined) return value;

    const stringValue = String(value).trim();

    switch (field) {
      case 'quantity':
      case 'cbm':
      case 'weekNumber':
        const numValue = parseFloat(stringValue);
        return isNaN(numValue) ? 0 : numValue;

      case 'latestStatus':
        return this.normalizeStatus(stringValue);

      case 'etaDate':
        return this.parseDate(stringValue);

      default:
        return stringValue;
    }
  }

  normalizeStatus(status: string): string {
    if (!status) return 'planned_airfreight';

    const statusLower = status.toLowerCase();

    // Map common status variations
    const statusMap: Record<string, string[]> = {
      'planned_airfreight': ['planned', 'scheduled', 'booked', 'planned_airfreight'],
      'airfreight_seafreight': ['airfreight_seafreight', 'airfreight', 'seafreight'],
      'in_transit': ['in_transit', 'in transit', 'shipped', 'sailing', 'en route'],
      'arrived': ['arrived', 'docked', 'at port', 'discharged'],
      'unloading': ['unloading', 'discharging'],
      'inspection_pending': ['inspection_pending', 'awaiting inspection', 'customs'],
      'inspecting': ['inspecting', 'under inspection'],
      'inspection_passed': ['inspection_passed', 'cleared', 'released'],
      'receiving': ['receiving', 'unloading to warehouse'],
      'received': ['received', 'in warehouse'],
      'stored': ['stored', 'completed', 'finished']
    };

    for (const [normalizedStatus, variations] of Object.entries(statusMap)) {
      if (variations.some(variation => statusLower.includes(variation))) {
        return normalizedStatus;
      }
    }

    return 'planned_airfreight'; // Default status
  }

  parseDate(dateString: string): string | null {
    if (!dateString) return null;

    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date.toISOString();
    } catch {
      return null;
    }
  }

  generateShipmentId(shipment: any): string {
    const timestamp = Date.now();
    const supplier = (shipment.supplier || 'UNK').substring(0, 3).toUpperCase();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `IMP_${supplier}_${timestamp}_${random}`;
  }

  isValidShipment(shipment: any): boolean {
    // Require at least ID and either supplier or product name
    return shipment.id && (shipment.supplier || shipment.productName);
  }

  async updateShipmentsData(newShipments: any[], metadata: ImportMetadata): Promise<void> {
    try {
      const shipmentsPath = path.join(this.dataPath, 'shipments.json');

      // Read existing shipments
      let existingShipments: any[] = [];
      try {
        const existingData = await fs.readFile(shipmentsPath, 'utf-8');
        existingShipments = JSON.parse(existingData);
      } catch (error) {
        console.log('No existing shipments file found, creating new one');
      }

      // Merge new shipments
      const shipmentMap = new Map();

      // Add existing shipments
      existingShipments.forEach(shipment => {
        shipmentMap.set(shipment.id, shipment);
      });

      // Add/update new shipments
      let addedCount = 0;
      let updatedCount = 0;

      newShipments.forEach(shipment => {
        if (shipmentMap.has(shipment.id)) {
          // Update existing
          const existing = shipmentMap.get(shipment.id);
          shipmentMap.set(shipment.id, {
            ...existing,
            ...shipment,
            updatedAt: new Date().toISOString(),
            lastImportUpdate: metadata
          });
          updatedCount++;
        } else {
          // Add new
          shipmentMap.set(shipment.id, shipment);
          addedCount++;
        }
      });

      // Convert back to array and save
      const updatedShipments = Array.from(shipmentMap.values());
      await fs.writeFile(shipmentsPath, JSON.stringify(updatedShipments, null, 2));

      console.log(`📊 Import summary: ${addedCount} new, ${updatedCount} updated, ${updatedShipments.length} total shipments`);

    } catch (error) {
      console.error('Error updating shipments data:', error);
      throw error;
    }
  }

  async logImportActivity(activity: ImportActivity): Promise<void> {
    try {
      const logPath = path.join(this.dataPath, 'import_log.json');

      let logs: ImportActivity[] = [];
      try {
        const existingLogs = await fs.readFile(logPath, 'utf-8');
        logs = JSON.parse(existingLogs);
      } catch {
        // File doesn't exist, start with empty array
      }

      logs.push(activity);

      // Keep only last 100 entries
      if (logs.length > 100) {
        logs = logs.slice(-100);
      }

      await fs.writeFile(logPath, JSON.stringify(logs, null, 2));

    } catch (error) {
      console.error('Error logging import activity:', error);
    }
  }

  async testConnection(): Promise<boolean> {
    console.log('🧪 Testing email connection...');

    return new Promise((resolve) => {
      const imap = new Imap(this.config);

      imap.once('ready', () => {
        console.log('✅ Email connection test successful');
        imap.end();
        resolve(true);
      });

      imap.once('error', (err: any) => {
        console.error('❌ Email connection test failed:', err.message);
        resolve(false);
      });

      imap.connect();
    });
  }

  stop(): void {
    console.log('🛑 Stopping email importer...');
    this.isProcessing = false;
  }
}

export default EmailImporter;
