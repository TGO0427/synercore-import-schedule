// Quick script to check what's in the database
import db from '../db/connection.js';

async function checkDatabase() {
  try {
    console.log('🔍 Checking database contents...\n');

    // Count shipments
    const countResult = await db.query('SELECT COUNT(*) as total FROM shipments');
    console.log(`📊 Total shipments in database: ${countResult.rows[0].total}`);

    // Show recent shipments
    const recentResult = await db.query(`
      SELECT id, supplier, product_name, latest_status, quantity, pallet_qty, updated_at
      FROM shipments
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    console.log('\n📦 Most recent 10 shipments:');
    console.table(recentResult.rows.map(row => ({
      supplier: row.supplier,
      product: row.product_name?.substring(0, 30),
      status: row.latest_status,
      qty: row.quantity,
      pallets: row.pallet_qty,
      updated: new Date(row.updated_at).toLocaleString()
    })));

    // Check for mock data patterns
    const mockCheck = await db.query(`
      SELECT COUNT(*) as mock_count
      FROM shipments
      WHERE supplier LIKE '%Example%' OR supplier LIKE '%Test%' OR supplier LIKE '%Mock%'
    `);

    if (mockCheck.rows[0].mock_count > 0) {
      console.log(`\n⚠️  Found ${mockCheck.rows[0].mock_count} potentially mock/test entries`);
    }

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  } finally {
    await db.end();
  }
}

checkDatabase();
