import { Shipment, ShipmentStatus } from '../../src/types/shipment.js';
import archiveService from '../services/archiveService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data file path
const SHIPMENTS_FILE = path.join(__dirname, '../data/shipments.json');

let shipments = [];

// Ensure data directory exists
async function ensureDataDirectory() {
  try {
    await fs.mkdir(path.join(__dirname, '../data'), { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

// File operation queue to prevent race conditions
let fileOperationQueue = Promise.resolve();

// Helper function to read shipments from file with retry logic
async function readShipments(retries = 3) {
  return fileOperationQueue = fileOperationQueue.then(async () => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const data = await fs.readFile(SHIPMENTS_FILE, 'utf8');
        return JSON.parse(data);
      } catch (error) {
        if (error.code === 'ENOENT') {
          // File doesn't exist, return empty array
          return [];
        }

        if (attempt < retries && (error.code === 'EBUSY' || error.code === 'EMFILE')) {
          console.warn(`Read attempt ${attempt} failed, retrying:`, error.message);
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          continue;
        }

        throw error;
      }
    }
  });
}

// Helper function to write shipments to file with atomic write
async function writeShipments(shipmentsData) {
  return fileOperationQueue = fileOperationQueue.then(async () => {
    await ensureDataDirectory();

    // Use atomic write (write to temp file, then rename)
    const tempFile = SHIPMENTS_FILE + '.tmp';
    const data = JSON.stringify(shipmentsData, null, 2);

    try {
      await fs.writeFile(tempFile, data, 'utf8');
      await fs.rename(tempFile, SHIPMENTS_FILE);
    } catch (error) {
      // Clean up temp file if write failed
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  });
}

// Load shipments on startup
async function loadShipments() {
  try {
    shipments = await readShipments();
    console.log(`Loaded ${shipments.length} shipments from persistent storage`);
  } catch (error) {
    console.error('Error loading shipments:', error);
    shipments = [];
  }
}

// Initialize shipments
loadShipments();

export class ShipmentsController {
  static async getAllShipments(req, res) {
    try {
      // Reload data from file if shipments array is empty or stale
      if (shipments.length === 0) {
        console.log('Reloading shipments data...');
        shipments = await readShipments();
      }

      const { sortBy = 'estimatedArrival', order = 'asc', status, search } = req.query;
      
      let filteredShipments = [...shipments];
      
      if (status) {
        filteredShipments = filteredShipments.filter(s => s.latestStatus === status);
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        filteredShipments = filteredShipments.filter(s => 
          s.orderRef.toLowerCase().includes(searchLower) ||
          s.supplier.toLowerCase().includes(searchLower) ||
          s.finalPod.toLowerCase().includes(searchLower)
        );
      }
      
      filteredShipments.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;
        
        if (aValue instanceof Date && bValue instanceof Date) {
          return order === 'asc' ? aValue - bValue : bValue - aValue;
        }
        
        const comparison = aValue.toString().localeCompare(bValue.toString());
        return order === 'asc' ? comparison : -comparison;
      });
      
      console.log('getAllShipments: Sample values being returned:', filteredShipments.slice(0, 5).map(s => ({ id: s.id, cbm: s.cbm, status: s.latestStatus })));

      // Set proper cache headers to prevent caching issues
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      res.json(filteredShipments);
    } catch (error) {
      console.error('Error in getAllShipments:', error);
      res.status(500).json({
        error: error.message,
        details: 'Failed to retrieve shipments',
        timestamp: new Date().toISOString()
      });
    }
  }

  static getShipmentById(req, res) {
    console.log('DEBUG: getShipmentById method called with id:', req.params.id);
    try {
      const shipment = shipments.find(s => s.id === req.params.id);
      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      res.json(shipment);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async createShipment(req, res) {
    try {
      const shipmentData = req.body;
      const newShipment = new Shipment({
        ...shipmentData,
        id: `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });
      
      shipments.push(newShipment);
      await writeShipments(shipments);
      res.status(201).json(newShipment);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async updateShipment(req, res) {
    try {
      const index = shipments.findIndex(s => s.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      
      const updatedShipment = { ...shipments[index], ...req.body, updatedAt: new Date() };
      shipments[index] = updatedShipment;
      
      await writeShipments(shipments);
      res.json(updatedShipment);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  static async deleteShipment(req, res) {
    try {
      const index = shipments.findIndex(s => s.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ error: 'Shipment not found' });
      }
      
      shipments.splice(index, 1);
      await writeShipments(shipments);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static getShipmentsByStatus(req, res) {
    try {
      const { status } = req.params;
      const filteredShipments = shipments.filter(s => s.status === status);
      res.json(filteredShipments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static getDelayedShipments(req, res) {
    try {
      const delayedShipments = shipments.filter(shipment => {
        return shipment.latestStatus === ShipmentStatus.DELAYED;
      });
      
      res.json(delayedShipments);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async bulkImport(shipmentsData) {
    // Archive existing data before importing new schedule
    if (shipments.length > 0) {
      console.log(`Archiving ${shipments.length} existing shipments before new import`);
      try {
        const archiveFileName = archiveService.archiveCurrentData(shipments);
        console.log(`Successfully archived to: ${archiveFileName}`);
      } catch (error) {
        console.error('Failed to archive existing data:', error);
        // Continue with import even if archiving fails
      }
    }
    
    // Replace all existing shipments with new data
    shipments = [...shipmentsData];
    await writeShipments(shipments);
    console.log(`Bulk import completed: ${shipments.length} shipments loaded`);
    return shipments.length;
  }

  static async bulkImportEndpoint(req, res) {
    try {
      console.log('Bulk import endpoint called with', req.body.length, 'shipments');
      console.log('Sample shipment CBM values:', req.body.slice(0, 3).map(s => ({ id: s.id, cbm: s.cbm })));
      const count = await ShipmentsController.bulkImport(req.body);
      res.json({ 
        success: true, 
        message: `Successfully imported ${count} shipments`,
        count: count
      });
    } catch (error) {
      console.error('Bulk import endpoint error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static getArchives(req, res) {
    try {
      const archives = archiveService.getArchivedFiles().map(fileName => {
        const stats = archiveService.getArchivedData(fileName);
        return {
          fileName,
          archivedAt: stats?.archivedAt,
          totalShipments: stats?.totalShipments || 0
        };
      });
      res.json(archives);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static getArchiveData(req, res) {
    try {
      const { fileName } = req.params;
      const archiveData = archiveService.getArchivedData(fileName);
      if (!archiveData) {
        return res.status(404).json({ error: 'Archive not found' });
      }
      res.json(archiveData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // Auto-archive endpoints
  static getAutoArchiveStats(req, res) {
    try {
      const { daysOld = 30 } = req.query;
      const stats = archiveService.getAutoArchiveStats(shipments, parseInt(daysOld));
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  static async performAutoArchive(req, res) {
    try {
      const { daysOld = 30 } = req.body;
      console.log(`Performing auto-archive for ARRIVED shipments older than ${daysOld} days`);

      const result = archiveService.archiveOldArrivedShipments(shipments, parseInt(daysOld));

      // Update the in-memory shipments array with remaining shipments
      shipments.length = 0;
      shipments.push(...result.remaining);

      // Persist the updated shipments list
      await ShipmentsController.persistShipments();

      res.json({
        success: true,
        archivedCount: result.archived,
        remainingCount: result.remaining.length,
        archiveFileName: result.archiveFileName
      });
    } catch (error) {
      console.error('Auto-archive error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async renameArchive(req, res) {
    try {
      const { fileName } = req.params;
      const { newName } = req.body;

      if (!newName || newName.trim() === '') {
        return res.status(400).json({ error: 'New name is required' });
      }

      const result = archiveService.renameArchiveFile(fileName, newName.trim());

      res.json({
        success: true,
        message: 'Archive renamed successfully',
        oldFileName: result.oldFileName,
        newFileName: result.newFileName,
        customName: result.customName
      });
    } catch (error) {
      console.error('Archive rename error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async performManualArchive(req, res) {
    try {
      const { shipmentIds } = req.body;
      console.log(`Performing manual archive for ${shipmentIds.length} selected shipments`);

      if (!shipmentIds || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
        return res.status(400).json({ error: 'No shipment IDs provided' });
      }

      // Find shipments to archive (ARRIVED or STORED shipments)
      const shipmentsToArchive = shipments.filter(s =>
        shipmentIds.includes(s.id) && (s.latestStatus === 'arrived_pta' || s.latestStatus === 'arrived_klm' || s.latestStatus === 'stored')
      );

      if (shipmentsToArchive.length === 0) {
        return res.status(400).json({ error: 'No valid ARRIVED or STORED shipments found to archive' });
      }

      // Create archive
      const result = archiveService.archiveSpecificShipments(shipmentsToArchive);

      // Remove archived shipments from main array
      const remainingShipments = shipments.filter(s => !shipmentIds.includes(s.id));

      // Update the in-memory shipments array
      shipments.length = 0;
      shipments.push(...remainingShipments);

      // Persist the updated shipments list
      await ShipmentsController.persistShipments();

      res.json({
        success: true,
        archivedCount: shipmentsToArchive.length,
        remainingCount: remainingShipments.length,
        archiveFileName: result.archiveFileName
      });
    } catch (error) {
      console.error('Manual archive error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async persistShipments() {
    try {
      await writeShipments(shipments);
    } catch (error) {
      console.error('Error persisting shipments:', error);
    }
  }

  // Post-arrival workflow endpoints
  static async startUnloading(req, res) {
    try {
      const { id } = req.params;
      const shipment = shipments.find(s => s.id === id);

      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      if (shipment.latestStatus !== 'arrived_pta' && shipment.latestStatus !== 'arrived_klm') {
        return res.status(400).json({ error: 'Shipment must be in ARRIVED status to start unloading' });
      }

      shipment.latestStatus = 'unloading';
      shipment.unloadingStartDate = new Date().toISOString();
      shipment.updatedAt = new Date().toISOString();

      await writeShipments(shipments);
      res.json(shipment);
    } catch (error) {
      console.error('Error starting unloading:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async completeUnloading(req, res) {
    try {
      const { id } = req.params;
      const shipment = shipments.find(s => s.id === id);

      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      if (shipment.latestStatus !== 'unloading') {
        return res.status(400).json({ error: 'Shipment must be in UNLOADING status' });
      }

      shipment.latestStatus = 'inspection_pending';
      shipment.unloadingCompletedDate = new Date().toISOString();
      shipment.updatedAt = new Date().toISOString();

      await writeShipments(shipments);
      res.json(shipment);
    } catch (error) {
      console.error('Error completing unloading:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async startInspection(req, res) {
    try {
      const { id } = req.params;
      const { inspectedBy } = req.body;
      const shipment = shipments.find(s => s.id === id);

      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      if (shipment.latestStatus !== 'inspection_pending') {
        return res.status(400).json({ error: 'Shipment must be in INSPECTION_PENDING status' });
      }

      shipment.latestStatus = 'inspecting';
      shipment.inspectionStatus = 'in_progress';
      shipment.inspectedBy = inspectedBy || '';
      shipment.inspectionDate = new Date().toISOString();
      shipment.updatedAt = new Date().toISOString();

      await writeShipments(shipments);
      res.json(shipment);
    } catch (error) {
      console.error('Error starting inspection:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async completeInspection(req, res) {
    try {
      const { id } = req.params;
      const { passed, notes, inspectedBy } = req.body;
      const shipment = shipments.find(s => s.id === id);

      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      if (shipment.latestStatus !== 'inspecting') {
        return res.status(400).json({ error: 'Shipment must be in INSPECTING status' });
      }

      shipment.inspectionStatus = passed ? 'passed' : 'failed';
      shipment.latestStatus = passed ? 'inspection_passed' : 'inspection_failed';
      shipment.inspectionNotes = notes || '';
      if (inspectedBy) shipment.inspectedBy = inspectedBy;
      shipment.updatedAt = new Date().toISOString();

      await writeShipments(shipments);
      res.json(shipment);
    } catch (error) {
      console.error('Error completing inspection:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async startReceiving(req, res) {
    try {
      const { id } = req.params;
      const { receivedBy } = req.body;
      const shipment = shipments.find(s => s.id === id);

      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      if (shipment.latestStatus !== 'inspection_passed') {
        return res.status(400).json({ error: 'Shipment must have passed inspection to start receiving' });
      }

      shipment.latestStatus = 'receiving';
      shipment.receivingStatus = 'in_progress';
      shipment.receivedBy = receivedBy || '';
      shipment.receivingDate = new Date().toISOString();
      shipment.updatedAt = new Date().toISOString();

      await writeShipments(shipments);
      res.json(shipment);
    } catch (error) {
      console.error('Error starting receiving:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async completeReceiving(req, res) {
    try {
      console.log('DEBUG: completeReceiving called for shipment:', req.params.id);
      console.log('DEBUG: completeReceiving body:', req.body);
      const { id } = req.params;
      const { receivedQuantity, notes, receivedBy, discrepancies } = req.body;
      const shipment = shipments.find(s => s.id === id);

      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      if (shipment.latestStatus !== 'receiving') {
        return res.status(400).json({ error: 'Shipment must be in RECEIVING status' });
      }

      shipment.receivedQuantity = receivedQuantity;
      shipment.receivingNotes = notes || '';
      shipment.discrepancies = discrepancies || [];
      if (receivedBy) shipment.receivedBy = receivedBy;

      if (discrepancies && discrepancies.length > 0) {
        shipment.receivingStatus = 'discrepancy';
        console.log('DEBUG: Setting status to discrepancy');
      } else if (receivedQuantity < shipment.quantity) {
        shipment.receivingStatus = 'partial';
        console.log('DEBUG: Setting status to partial');
      } else {
        shipment.receivingStatus = 'completed';
        shipment.latestStatus = 'received';
        console.log('DEBUG: Setting status to received');
      }

      shipment.updatedAt = new Date().toISOString();
      console.log('DEBUG: Updated shipment status to:', shipment.latestStatus);

      await writeShipments(shipments);
      res.json(shipment);
    } catch (error) {
      console.error('Error completing receiving:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static async markAsStored(req, res) {
    try {
      const { id } = req.params;
      const shipment = shipments.find(s => s.id === id);

      if (!shipment) {
        return res.status(404).json({ error: 'Shipment not found' });
      }

      if (shipment.latestStatus !== 'received') {
        return res.status(400).json({ error: 'Shipment must be in RECEIVED status to mark as stored' });
      }

      shipment.latestStatus = 'stored';
      shipment.updatedAt = new Date().toISOString();

      await writeShipments(shipments);
      res.json(shipment);
    } catch (error) {
      console.error('Error marking as stored:', error);
      res.status(500).json({ error: error.message });
    }
  }

  static getPostArrivalShipments(req, res) {
    console.log('DEBUG: getPostArrivalShipments method called');
    try {
      const postArrivalStates = [
        'arrived_pta', 'arrived_klm', 'unloading', 'inspection_pending', 'inspecting',
        'inspection_failed', 'inspection_passed', 'receiving', 'received'
      ];

      const postArrivalShipments = shipments.filter(s =>
        postArrivalStates.includes(s.latestStatus)
      );

      res.json(postArrivalShipments);
    } catch (error) {
      console.error('Error getting post-arrival shipments:', error);
      res.status(500).json({ error: error.message });
    }
  }
}
// Restart server
