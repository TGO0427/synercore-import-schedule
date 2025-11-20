import { getPool, closePool } from './server/db/connection.js';

async function distributeShipments() {
  try {
    const pool = getPool();
    
    // Get total count
    const countResult = await pool.query('SELECT COUNT(*) as cnt FROM shipments');
    const total = parseInt(countResult.rows[0].cnt);
    const quarterSize = Math.floor(total / 4);
    
    console.log(`Total shipments: ${total}`);
    console.log(`Distributing ~${quarterSize} shipments to each status\n`);

    // Get all shipment IDs
    const allIds = await pool.query('SELECT id FROM shipments ORDER BY id');
    const ids = allIds.rows.map(r => r.id);

    // 25% planned_airfreight
    const planned = ids.slice(0, quarterSize);
    if (planned.length > 0) {
      await pool.query(
        `UPDATE shipments SET latest_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2)`,
        ['planned_airfreight', planned]
      );
      console.log(`✓ ${planned.length} shipments → planned_airfreight`);
    }

    // 25% in_transit_seaway
    const transit = ids.slice(quarterSize, quarterSize * 2);
    if (transit.length > 0) {
      await pool.query(
        `UPDATE shipments SET latest_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2)`,
        ['in_transit_seaway', transit]
      );
      console.log(`✓ ${transit.length} shipments → in_transit_seaway`);
    }

    // 25% inspection (post-arrival workflow)
    const inspection = ids.slice(quarterSize * 2, quarterSize * 3);
    if (inspection.length > 0) {
      await pool.query(
        `UPDATE shipments SET latest_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2)`,
        ['inspection', inspection]
      );
      console.log(`✓ ${inspection.length} shipments → inspection`);
    }

    // 25% stored (warehouse stored)
    const stored = ids.slice(quarterSize * 3);
    if (stored.length > 0) {
      await pool.query(
        `UPDATE shipments SET latest_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = ANY($2)`,
        ['stored', stored]
      );
      console.log(`✓ ${stored.length} shipments → stored`);
    }

    // Show final distribution
    console.log('\nFinal Distribution:');
    const distribution = await pool.query(
      `SELECT latest_status, COUNT(*) as count FROM shipments GROUP BY latest_status ORDER BY count DESC`
    );
    
    distribution.rows.forEach(row => {
      const view = row.latest_status === 'planned_airfreight' ? '(Shipping)' :
                   row.latest_status === 'in_transit_seaway' ? '(Shipping)' :
                   row.latest_status === 'inspection' ? '(Post-Arrival Workflow)' :
                   row.latest_status === 'stored' ? '(Warehouse Stored)' : '';
      console.log(`  ${row.latest_status}: ${row.count} ${view}`);
    });

    console.log('\n✅ Distribution complete! Refresh your browser to see the changes.');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await closePool();
  }
}

distributeShipments();
