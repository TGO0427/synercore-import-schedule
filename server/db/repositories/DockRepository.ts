/**
 * Dock & Truck Arrivals Repository
 * Handles database operations for dock management and truck check-in/check-out
 */

import { queryAll, queryOne, query, transaction } from '../connection.js';

export interface Dock {
  id: number;
  dock_number: string;
  warehouse: string;
  status: 'available' | 'occupied' | 'maintenance';
  current_truck_id: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface TruckArrival {
  id: number;
  shipment_id: string | null;
  carrier: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  vehicle_reg: string | null;
  expected_arrival: Date | null;
  actual_arrival: Date | null;
  dock_id: number | null;
  warehouse: string | null;
  status: 'scheduled' | 'checked_in' | 'unloading' | 'completed' | 'departed';
  queue_position: number | null;
  check_in_time: Date | null;
  check_out_time: Date | null;
  notes: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  dock_number?: string;
  order_ref?: string;
  supplier?: string;
  product_name?: string;
}

export interface DockMetrics {
  avg_wait_minutes: number;
  avg_turnaround_minutes: number;
  utilization_percent: number;
  trucks_today: number;
  trucks_completed_today: number;
}

const DOCK_COLUMNS = 'id, dock_number, warehouse, status, current_truck_id, notes, created_at, updated_at';

const TRUCK_COLUMNS = `
  t.id, t.shipment_id, t.carrier, t.driver_name, t.driver_phone, t.vehicle_reg,
  t.expected_arrival, t.actual_arrival, t.dock_id, t.warehouse, t.status, t.queue_position,
  t.check_in_time, t.check_out_time, t.notes, t.created_by, t.created_at, t.updated_at,
  d.dock_number,
  s.order_ref, s.supplier, s.product_name
`;

const TRUCK_JOINS = `
  FROM truck_arrivals t
  LEFT JOIN docks d ON t.dock_id = d.id
  LEFT JOIN shipments s ON t.shipment_id = s.id
`;

class DockRepository {
  // ─── Dock Operations ───

  async findAllDocks(warehouse?: string): Promise<Dock[]> {
    let sql = `SELECT ${DOCK_COLUMNS} FROM docks`;
    const params: any[] = [];
    if (warehouse) {
      sql += ' WHERE warehouse = $1';
      params.push(warehouse);
    }
    sql += ' ORDER BY warehouse, dock_number';
    return queryAll<Dock>(sql, params.length ? params : undefined);
  }

  async findDockById(id: number): Promise<Dock | null> {
    return queryOne<Dock>(`SELECT ${DOCK_COLUMNS} FROM docks WHERE id = $1`, [id]);
  }

  async updateDock(id: number, data: Partial<Dock>): Promise<Dock | null> {
    const keys = Object.keys(data);
    const values = [...Object.values(data), id];
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    return queryOne<Dock>(
      `UPDATE docks SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING ${DOCK_COLUMNS}`,
      values
    );
  }

  // ─── Truck Arrival Operations ───

  async findAllTruckArrivals(filters: {
    status?: string;
    warehouse?: string;
    date?: string;
  } = {}): Promise<TruckArrival[]> {
    let sql = `SELECT ${TRUCK_COLUMNS} ${TRUCK_JOINS} WHERE 1=1`;
    const params: any[] = [];
    let idx = 1;

    if (filters.status) {
      sql += ` AND t.status = $${idx++}`;
      params.push(filters.status);
    }
    if (filters.warehouse) {
      sql += ` AND t.warehouse = $${idx++}`;
      params.push(filters.warehouse);
    }
    if (filters.date) {
      sql += ` AND (t.expected_arrival::date = $${idx}::date OR t.actual_arrival::date = $${idx}::date)`;
      params.push(filters.date);
      idx++;
    }

    sql += ' ORDER BY t.expected_arrival ASC NULLS LAST, t.created_at DESC';
    return queryAll<TruckArrival>(sql, params.length ? params : undefined);
  }

  async findTruckById(id: number): Promise<TruckArrival | null> {
    return queryOne<TruckArrival>(
      `SELECT ${TRUCK_COLUMNS} ${TRUCK_JOINS} WHERE t.id = $1`,
      [id]
    );
  }

  async getTodaySchedule(warehouse?: string): Promise<TruckArrival[]> {
    let sql = `SELECT ${TRUCK_COLUMNS} ${TRUCK_JOINS}
      WHERE (t.expected_arrival::date = CURRENT_DATE
        OR t.actual_arrival::date = CURRENT_DATE
        OR (t.status NOT IN ('completed', 'departed') AND t.created_at::date = CURRENT_DATE))`;
    const params: any[] = [];
    if (warehouse) {
      sql += ' AND t.warehouse = $1';
      params.push(warehouse);
    }
    sql += ' ORDER BY t.expected_arrival ASC NULLS LAST';
    return queryAll<TruckArrival>(sql, params.length ? params : undefined);
  }

  async createTruckArrival(data: Partial<TruckArrival>): Promise<TruckArrival> {
    const result = await queryOne<TruckArrival>(
      `INSERT INTO truck_arrivals (shipment_id, carrier, driver_name, driver_phone, vehicle_reg, expected_arrival, warehouse, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        data.shipment_id || null,
        data.carrier || null,
        data.driver_name || null,
        data.driver_phone || null,
        data.vehicle_reg || null,
        data.expected_arrival || null,
        data.warehouse || null,
        data.notes || null,
        data.created_by || null,
      ]
    );
    if (!result) throw new Error('Failed to create truck arrival');
    return result;
  }

  async updateTruckArrival(id: number, data: Partial<TruckArrival>): Promise<TruckArrival | null> {
    const keys = Object.keys(data);
    const values = [...Object.values(data), id];
    const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
    return queryOne<TruckArrival>(
      `UPDATE truck_arrivals SET ${setClause}, updated_at = NOW() WHERE id = $${keys.length + 1} RETURNING *`,
      values
    );
  }

  async getQueuedTrucks(warehouse?: string): Promise<TruckArrival[]> {
    let sql = `SELECT ${TRUCK_COLUMNS} ${TRUCK_JOINS}
      WHERE t.status = 'checked_in' AND t.dock_id IS NULL`;
    const params: any[] = [];
    if (warehouse) {
      sql += ` AND EXISTS (
        SELECT 1 FROM truck_arrivals ta2
        LEFT JOIN docks d2 ON ta2.dock_id = d2.id
        WHERE ta2.id = t.id AND (d2.warehouse = $1 OR d2.warehouse IS NULL)
      )`;
      params.push(warehouse);
    }
    sql += ' ORDER BY t.queue_position ASC NULLS LAST, t.check_in_time ASC';
    return queryAll<TruckArrival>(sql, params.length ? params : undefined);
  }

  async getNextQueuePosition(): Promise<number> {
    const result = await queryOne<{ max_pos: number }>(
      `SELECT COALESCE(MAX(queue_position), 0) + 1 as max_pos FROM truck_arrivals WHERE status = 'checked_in' AND dock_id IS NULL`
    );
    return result?.max_pos || 1;
  }

  async getAvailableDock(warehouse: string): Promise<Dock | null> {
    return queryOne<Dock>(
      `SELECT ${DOCK_COLUMNS} FROM docks WHERE warehouse = $1 AND status = 'available' ORDER BY dock_number LIMIT 1`,
      [warehouse]
    );
  }

  async getDockMetrics(warehouse?: string, startDate?: string, endDate?: string): Promise<DockMetrics> {
    const params: any[] = [];
    let idx = 1;
    let whereClause = "WHERE t.status IN ('completed', 'departed')";

    if (warehouse) {
      whereClause += ` AND d.warehouse = $${idx++}`;
      params.push(warehouse);
    }
    if (startDate) {
      whereClause += ` AND t.check_in_time >= $${idx++}::timestamptz`;
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND t.check_out_time <= $${idx++}::timestamptz`;
      params.push(endDate);
    }

    const metricsResult = await queryOne<{
      avg_wait: number;
      avg_turnaround: number;
      total_completed: number;
    }>(
      `SELECT
        COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(t.actual_arrival, t.check_in_time) - t.check_in_time)) / 60), 0)::numeric(10,1) as avg_wait,
        COALESCE(AVG(EXTRACT(EPOCH FROM (t.check_out_time - t.check_in_time)) / 60), 0)::numeric(10,1) as avg_turnaround,
        COUNT(*)::int as total_completed
      FROM truck_arrivals t
      LEFT JOIN docks d ON t.dock_id = d.id
      ${whereClause}`,
      params.length ? params : undefined
    );

    // Today's counts
    const todayParams: any[] = [];
    let todayWhere = '';
    if (warehouse) {
      todayWhere = ' AND d.warehouse = $1';
      todayParams.push(warehouse);
    }

    const todayResult = await queryOne<{ trucks_today: number; completed_today: number }>(
      `SELECT
        COUNT(*)::int as trucks_today,
        COUNT(*) FILTER (WHERE t.status IN ('completed', 'departed'))::int as completed_today
      FROM truck_arrivals t
      LEFT JOIN docks d ON t.dock_id = d.id
      WHERE (t.expected_arrival::date = CURRENT_DATE OR t.actual_arrival::date = CURRENT_DATE OR t.check_in_time::date = CURRENT_DATE)
      ${todayWhere}`,
      todayParams.length ? todayParams : undefined
    );

    // Dock utilization — % of docks currently occupied
    const utilizationParams: any[] = [];
    let utilizationWhere = '';
    if (warehouse) {
      utilizationWhere = ' WHERE warehouse = $1';
      utilizationParams.push(warehouse);
    }

    const utilizationResult = await queryOne<{ total_docks: number; occupied: number }>(
      `SELECT
        COUNT(*)::int as total_docks,
        COUNT(*) FILTER (WHERE status = 'occupied')::int as occupied
      FROM docks ${utilizationWhere}`,
      utilizationParams.length ? utilizationParams : undefined
    );

    const totalDocks = utilizationResult?.total_docks || 1;
    const occupied = utilizationResult?.occupied || 0;

    return {
      avg_wait_minutes: Number(metricsResult?.avg_wait || 0),
      avg_turnaround_minutes: Number(metricsResult?.avg_turnaround || 0),
      utilization_percent: Math.round((occupied / totalDocks) * 100),
      trucks_today: todayResult?.trucks_today || 0,
      trucks_completed_today: todayResult?.completed_today || 0,
    };
  }

  // ─── Transactional dock assignment ───

  async assignDockToTruck(truckId: number, dockId: number): Promise<{ truck: TruckArrival; dock: Dock }> {
    return transaction(async (client) => {
      // Lock the dock row
      const dockResult = await client.query(
        `SELECT ${DOCK_COLUMNS} FROM docks WHERE id = $1 FOR UPDATE`,
        [dockId]
      );
      const dock = dockResult.rows[0] as Dock;
      if (!dock) throw new Error('Dock not found');
      if (dock.status !== 'available') throw new Error('Dock is not available');

      // Update truck
      const truckResult = await client.query(
        `UPDATE truck_arrivals SET dock_id = $1, status = 'unloading', queue_position = NULL, updated_at = NOW()
         WHERE id = $2 RETURNING *`,
        [dockId, truckId]
      );
      const truck = truckResult.rows[0] as TruckArrival;

      // Mark dock as occupied
      await client.query(
        `UPDATE docks SET status = 'occupied', current_truck_id = $1, updated_at = NOW() WHERE id = $2`,
        [truckId, dockId]
      );

      return { truck, dock: { ...dock, status: 'occupied' as const, current_truck_id: truckId } };
    });
  }

  async freeDock(dockId: number): Promise<void> {
    await query(
      `UPDATE docks SET status = 'available', current_truck_id = NULL, updated_at = NOW() WHERE id = $1`,
      [dockId]
    );
  }
}

const dockRepository = new DockRepository();
export { DockRepository };
export default dockRepository;
