/**
 * Archive Service
 * Manages shipment archiving and data storage for historical records
 */

import db from '../db/connection.js';
import type { Shipment } from '../types/index.js';

interface ArchivedData {
  archivedAt: string;
  totalShipments: number;
  data: Partial<Shipment>[];
}

interface AutoArchiveStats {
  eligibleForArchive: number;
  totalArrived: number;
  eligibleShipments: Array<{
    id: string;
    supplier: string;
    orderRef?: string;
    arrivedDate?: string;
    daysOld: number;
  }>;
}

class ArchiveService {
  constructor() {
    // Database-based archive system (no file system dependency)
  }

  /**
   * Archive current data to database
   */
  async archiveCurrentData(shipments: Partial<Shipment>[]): Promise<string | undefined> {
    if (!shipments || shipments.length === 0) {
      console.log('Archive: No data to archive');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFileName = `shipments_${timestamp}.json`;

    try {
      await db.query(
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

  /**
   * Get list of archived files
   */
  async getArchivedFiles(): Promise<string[]> {
    try {
      const result = await db.query<{ file_name: string }>(
        `SELECT file_name FROM archives ORDER BY archived_at DESC`
      );
      return result.map(row => row.file_name);
    } catch (error) {
      console.error('Archive: Failed to read archive directory:', error);
      return [];
    }
  }

  /**
   * Get archived data by filename
   */
  async getArchivedData(fileName: string): Promise<ArchivedData | null> {
    try {
      const result = await db.query<{
        archived_at: string;
        total_shipments: number;
        data: string | Partial<Shipment>[];
      }>(
        `SELECT archived_at, total_shipments, data FROM archives WHERE file_name = $1`,
        [fileName]
      );

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
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

  /**
   * Find old ARRIVED shipments eligible for archiving
   */
  findOldArrivedShipments(shipments: Partial<Shipment>[], daysOld: number = 30): Partial<Shipment>[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return shipments.filter(shipment => {
      if (shipment.latest_status !== 'arrived_pta' && shipment.latest_status !== 'arrived_klm') {
        return false;
      }

      // Check if shipment has been arrived for more than specified days
      const updatedAt = new Date((shipment as any).updatedAt || shipment.created_at);
      return updatedAt < cutoffDate;
    });
  }

  /**
   * Auto-archive old ARRIVED shipments
   */
  async archiveOldArrivedShipments(
    allShipments: Partial<Shipment>[],
    daysOld: number = 30
  ): Promise<{
    archived: number;
    remaining: Partial<Shipment>[];
    archiveFileName?: string;
  }> {
    const shipmentsToArchive = this.findOldArrivedShipments(allShipments, daysOld);

    if (shipmentsToArchive.length === 0) {
      console.log('Auto-Archive: No old ARRIVED shipments found to archive');
      return { archived: 0, remaining: allShipments };
    }

    // Archive the old shipments
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFileName = `auto_archive_arrived_${timestamp}.json`;

    try {
      await db.query(
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

  /**
   * Get auto-archive statistics
   */
  getAutoArchiveStats(shipments: Partial<Shipment>[], daysOld: number = 30): AutoArchiveStats {
    const oldArrived = this.findOldArrivedShipments(shipments, daysOld);
    const totalArrived = shipments.filter(
      s => s.latest_status === 'arrived_pta' || s.latest_status === 'arrived_klm'
    );

    return {
      eligibleForArchive: oldArrived.length,
      totalArrived: totalArrived.length,
      eligibleShipments: oldArrived.map(s => ({
        id: s.id || '',
        supplier: s.supplier || '',
        orderRef: (s as any).order_ref,
        arrivedDate: (s as any).updatedAt || s.created_at,
        daysOld: Math.floor(
          (Date.now() - new Date((s as any).updatedAt || s.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
        )
      }))
    };
  }

  /**
   * Rename archive file
   */
  async renameArchiveFile(oldFileName: string, newDisplayName: string): Promise<{
    oldFileName: string;
    newFileName: string;
    customName: string;
  }> {
    try {
      // Check if archive exists
      const checkResult = await db.query<{ id: string; data: string }>(
        `SELECT id, data FROM archives WHERE file_name = $1`,
        [oldFileName]
      );

      if (checkResult.length === 0) {
        throw new Error('Archive file not found');
      }

      // Generate new filename based on display name and timestamp
      const sanitizeForFilename = (str: string): string => {
        return str.replace(/[^\w\-._]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
      };

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const sanitizedName = sanitizeForFilename(newDisplayName);
      const newFileName = `custom_archive_${sanitizedName}_${timestamp}.json`;

      // Update filename
      await db.query(
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

  /**
   * Archive specific shipments
   */
  async archiveSpecificShipments(
    shipmentsToArchive: Partial<Shipment>[]
  ): Promise<{ archiveFileName: string; archivedCount: number }> {
    if (!shipmentsToArchive || shipmentsToArchive.length === 0) {
      throw new Error('No shipments provided for manual archive');
    }

    // Create archive file with order references (sanitized for filename)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizeForFilename = (str: string | undefined): string => {
      if (!str) return '';
      return str.replace(/[^\w\-._]/g, '_').replace(/_{2,}/g, '_').replace(/^_+|_+$/g, '');
    };
    const orderRefs = shipmentsToArchive
      .map(s => sanitizeForFilename((s as any).orderRef))
      .join('_')
      .slice(0, 100); // Limit length
    const archiveFileName = `manual_archive_${orderRefs}_${timestamp}.json`;

    try {
      await db.query(
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

  /**
   * Update archive data
   */
  async updateArchiveData(
    fileName: string,
    updatedData: Partial<Shipment>[]
  ): Promise<{ fileName: string; totalShipments: number }> {
    try {
      // Check if archive exists
      const checkResult = await db.query<{ id: string }>(
        `SELECT id FROM archives WHERE file_name = $1`,
        [fileName]
      );

      if (checkResult.length === 0) {
        throw new Error('Archive file not found');
      }

      // Update archive data
      await db.query(
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
