import pool from '../connection.js';
import { logError } from '../../utils/logger.js';

export interface AuditLogEntry {
  id?: number;
  user_id: string;
  username: string;
  action: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  changes: Record<string, any> | null;
  created_at?: string;
}

export class AuditRepository {
  static async logAudit(
    userId: string,
    username: string,
    action: string,
    entityType: string,
    entityId: string,
    entityLabel: string,
    changes: Record<string, any> | null = null
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, entity_label, changes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, username, action, entityType, entityId, entityLabel, changes ? JSON.stringify(changes) : null]
      );
    } catch (error) {
      logError('Failed to write audit log', error);
    }
  }

  static async getAuditLog(filters: {
    entityType?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ entries: AuditLogEntry[]; total: number }> {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.entityType) {
      conditions.push(`entity_type = $${paramIndex++}`);
      params.push(filters.entityType);
    }
    if (filters.action) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(filters.action);
    }
    if (filters.userId) {
      conditions.push(`user_id = $${paramIndex++}`);
      params.push(filters.userId);
    }
    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(filters.endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM audit_log ${whereClause}`,
      params
    );

    const result = await pool.query(
      `SELECT * FROM audit_log ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    return {
      entries: result.rows,
      total: parseInt(countResult.rows[0].count, 10)
    };
  }
}

export default AuditRepository;
