import pool from '../db/connection.js';

class ArchiveService {
  constructor() {
    // Database-based archive system (no file system dependency)
  }

  async archiveCurrentData(shipments) {
    if (!shipments || shipments.length === 0) {
      console.log('Archive: No data to archive');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFileName = `shipments_${timestamp}.json`;

    try {
      await pool.query(
        `INSERT INTO archives (file_name, archived_at, total_shipments, data)
         VALUES ($1, CURRENT_TIMESTAMP, $2, $3)`,
        [archiveFileName, shipments.length, JSON.stringify(shipments)]
      );
      console.log(`Archive: Successfully archived ${shipments.length} shipments to ${archiveFileName}`);
      return archiveFileName;
    } catch (error) {
      console.error('Archive: Failed to archive data:', error);
      throw error;
    }
  }

  async getArchivedFiles() {
    try {
      const result = await pool.query(
        `SELECT file_name FROM archives ORDER BY archived_at DESC`
      );
      return result.rows.map(row => row.file_name);
    } catch (error) {
      console.error('Archive: Failed to read archive directory:', error);
      return [];
    }
  }

  async getArchivedData(fileName) {
    try {
      const result = await pool.query(
        `SELECT archived_at, total_shipments, data FROM archives WHERE file_name = $1`,
        [fileName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        archivedAt: row.archived_at,
        totalShipments: row.total_shipments,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      };
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

  async archiveOldArrivedShipments(allShipments, daysOld = 30) {
    const shipmentsToArchive = this.findOldArrivedShipments(allShipments, daysOld);

    if (shipmentsToArchive.length === 0) {
      console.log('Auto-Archive: No old ARRIVED shipments found to archive');
      return { archived: 0, remaining: allShipments };
    }

    // Archive the old shipments
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFileName = `auto_archive_arrived_${timestamp}.json`;

    const archiveData = {
      archivedAt: new Date().toISOString(),
      totalShipments: shipmentsToArchive.length,
      archiveType: 'auto_arrived',
      archiveReason: `Auto-archived ARRIVED shipments older than ${daysOld} days`,
      cutoffDate: new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString(),
      data: shipmentsToArchive
    };

    try {
      await pool.query(
        `INSERT INTO archives (file_name, archived_at, total_shipments, data)
         VALUES ($1, CURRENT_TIMESTAMP, $2, $3)`,
        [archiveFileName, shipmentsToArchive.length, JSON.stringify(shipmentsToArchive)]
      );
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
  async renameArchiveFile(oldFileName, newDisplayName) {
    try {
      // Check if archive exists
      const checkResult = await pool.query(
        `SELECT id, data FROM archives WHERE file_name = $1`,
        [oldFileName]
      );

      if (checkResult.rows.length === 0) {
        throw new Error('Archive file not found');
      }

      // Generate new filename based on display name and timestamp
      const sanitizeForFilename = (str) => {
        return str.replace(/[^\w\-._]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedName = sanitizeForFilename(newDisplayName);
      const newFileName = `custom_archive_${sanitizedName}_${timestamp}.json`;

      // Update filename
      await pool.query(
        `UPDATE archives SET file_name = $1 WHERE file_name = $2`,
        [newFileName, oldFileName]
      );

      console.log(`Archive renamed: ${oldFileName} -> ${newFileName}`);
      return { oldFileName, newFileName, customName: newDisplayName };
    } catch (error) {
      console.error('Failed to rename archive:', error);
      throw error;
    }
  }

  // Manual archive functionality for specific shipments
  async archiveSpecificShipments(shipmentsToArchive) {
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

    try {
      await pool.query(
        `INSERT INTO archives (file_name, archived_at, total_shipments, data)
         VALUES ($1, CURRENT_TIMESTAMP, $2, $3)`,
        [archiveFileName, shipmentsToArchive.length, JSON.stringify(shipmentsToArchive)]
      );
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

  // Update archive data
  async updateArchiveData(fileName, updatedData) {
    try {
      // Check if archive exists
      const checkResult = await pool.query(
        `SELECT id FROM archives WHERE file_name = $1`,
        [fileName]
      );

      if (checkResult.rows.length === 0) {
        throw new Error('Archive file not found');
      }

      // Update archive data
      await pool.query(
        `UPDATE archives SET data = $1, total_shipments = $2 WHERE file_name = $3`,
        [JSON.stringify(updatedData), updatedData.length, fileName]
      );

      console.log(`Archive updated: ${fileName} with ${updatedData.length} shipments`);
      return { fileName, totalShipments: updatedData.length };
    } catch (error) {
      console.error('Failed to update archive:', error);
      throw error;
    }
  }
}

export default new ArchiveService();
