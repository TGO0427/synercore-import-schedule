import fs from 'fs';
import path from 'path';

class ArchiveService {
  constructor() {
    this.archiveDir = path.join(process.cwd(), 'server', 'archive');
    this.ensureArchiveDir();
  }

  ensureArchiveDir() {
    if (!fs.existsSync(this.archiveDir)) {
      fs.mkdirSync(this.archiveDir, { recursive: true });
    }
  }

  archiveCurrentData(shipments) {
    if (!shipments || shipments.length === 0) {
      console.log('Archive: No data to archive');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFileName = `shipments_${timestamp}.json`;
    const archiveFilePath = path.join(this.archiveDir, archiveFileName);

    const archiveData = {
      archivedAt: new Date().toISOString(),
      totalShipments: shipments.length,
      data: shipments
    };

    try {
      fs.writeFileSync(archiveFilePath, JSON.stringify(archiveData, null, 2));
      console.log(`Archive: Successfully archived ${shipments.length} shipments to ${archiveFileName}`);
      return archiveFileName;
    } catch (error) {
      console.error('Archive: Failed to archive data:', error);
      throw error;
    }
  }

  getArchivedFiles() {
    try {
      const files = fs.readdirSync(this.archiveDir);
      return files.filter(file => file.endsWith('.json')).sort().reverse();
    } catch (error) {
      console.error('Archive: Failed to read archive directory:', error);
      return [];
    }
  }

  getArchivedData(fileName) {
    try {
      const filePath = path.join(this.archiveDir, fileName);
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Archive: Failed to read archived file:', error);
      return null;
    }
  }

  // Auto-archive functionality for old ARRIVED shipments
  findOldArrivedShipments(shipments, daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return shipments.filter(shipment => {
      if (shipment.latestStatus !== 'arrived_pta' && shipment.latestStatus !== 'arrived_klm') return false;

      // Check if shipment has been arrived for more than specified days
      const updatedAt = new Date(shipment.updatedAt || shipment.createdAt);
      return updatedAt < cutoffDate;
    });
  }

  archiveOldArrivedShipments(allShipments, daysOld = 30) {
    const shipmentsToArchive = this.findOldArrivedShipments(allShipments, daysOld);

    if (shipmentsToArchive.length === 0) {
      console.log('Auto-Archive: No old ARRIVED shipments found to archive');
      return { archived: 0, remaining: allShipments };
    }

    // Archive the old shipments
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFileName = `auto_archive_arrived_${timestamp}.json`;
    const archiveFilePath = path.join(this.archiveDir, archiveFileName);

    const archiveData = {
      archivedAt: new Date().toISOString(),
      totalShipments: shipmentsToArchive.length,
      archiveType: 'auto_arrived',
      archiveReason: `Auto-archived ARRIVED shipments older than ${daysOld} days`,
      cutoffDate: new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString(),
      data: shipmentsToArchive
    };

    try {
      fs.writeFileSync(archiveFilePath, JSON.stringify(archiveData, null, 2));
      console.log(`Auto-Archive: Successfully archived ${shipmentsToArchive.length} old ARRIVED shipments to ${archiveFileName}`);

      // Return the remaining shipments (non-archived)
      const remainingShipments = allShipments.filter(shipment =>
        !shipmentsToArchive.some(archived => archived.id === shipment.id)
      );

      return {
        archived: shipmentsToArchive.length,
        remaining: remainingShipments,
        archiveFileName
      };
    } catch (error) {
      console.error('Auto-Archive: Failed to archive old ARRIVED shipments:', error);
      throw error;
    }
  }

  // Get auto-archive statistics
  getAutoArchiveStats(shipments, daysOld = 30) {
    const oldArrived = this.findOldArrivedShipments(shipments, daysOld);
    const totalArrived = shipments.filter(s => s.latestStatus === 'arrived_pta' || s.latestStatus === 'arrived_klm');

    return {
      eligibleForArchive: oldArrived.length,
      totalArrived: totalArrived.length,
      eligibleShipments: oldArrived.map(s => ({
        id: s.id,
        supplier: s.supplier,
        orderRef: s.orderRef,
        arrivedDate: s.updatedAt || s.createdAt,
        daysOld: Math.floor((Date.now() - new Date(s.updatedAt || s.createdAt)) / (1000 * 60 * 60 * 24))
      }))
    };
  }

  // Rename archive file functionality
  renameArchiveFile(oldFileName, newDisplayName) {
    try {
      const oldPath = path.join(this.archiveDir, oldFileName);

      // Check if old file exists
      if (!fs.existsSync(oldPath)) {
        throw new Error('Archive file not found');
      }

      // Read the archive data
      const archiveData = JSON.parse(fs.readFileSync(oldPath, 'utf8'));

      // Create new filename with sanitized display name
      const sanitizeForFilename = (str) => {
        return str.replace(/[^\w\-._]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
      };

      // Generate new filename based on display name and timestamp
      const timestamp = new Date(archiveData.archivedAt).toISOString().replace(/[:.]/g, '-');
      const sanitizedName = sanitizeForFilename(newDisplayName);
      const newFileName = `custom_archive_${sanitizedName}_${timestamp}.json`;
      const newPath = path.join(this.archiveDir, newFileName);

      // Update archive data with custom name
      archiveData.customName = newDisplayName;
      archiveData.originalFileName = oldFileName;

      // Write to new file
      fs.writeFileSync(newPath, JSON.stringify(archiveData, null, 2));

      // Delete old file
      fs.unlinkSync(oldPath);

      console.log(`Archive renamed: ${oldFileName} -> ${newFileName}`);
      return { oldFileName, newFileName, customName: newDisplayName };
    } catch (error) {
      console.error('Failed to rename archive:', error);
      throw error;
    }
  }

  // Manual archive functionality for specific shipments
  archiveSpecificShipments(shipmentsToArchive) {
    if (!shipmentsToArchive || shipmentsToArchive.length === 0) {
      throw new Error('No shipments provided for manual archive');
    }

    // Create archive file with order references (sanitized for filename)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizeForFilename = (str) => {
      return str.replace(/[^\w\-._]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
    };
    const orderRefs = shipmentsToArchive.map(s => sanitizeForFilename(s.orderRef)).join('_');
    const archiveFileName = `manual_archive_${orderRefs}_${timestamp}.json`;
    const archiveFilePath = path.join(this.archiveDir, archiveFileName);

    const archiveData = {
      archivedAt: new Date().toISOString(),
      totalShipments: shipmentsToArchive.length,
      archiveType: 'manual',
      archiveReason: 'Manual archive of selected ARRIVED shipments',
      data: shipmentsToArchive
    };

    try {
      fs.writeFileSync(archiveFilePath, JSON.stringify(archiveData, null, 2));
      console.log(`Manual Archive: Successfully archived ${shipmentsToArchive.length} shipments to ${archiveFileName}`);

      return {
        archiveFileName,
        archivedCount: shipmentsToArchive.length
      };
    } catch (error) {
      console.error('Manual Archive: Failed to archive shipments:', error);
      throw error;
    }
  }
}

export default new ArchiveService();