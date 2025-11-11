import pool from './connection.js';

const performanceIndexes = [
  'CREATE INDEX IF NOT EXISTS idx_shipments_warehouse ON shipments(receiving_warehouse)',
  'CREATE INDEX IF NOT EXISTS idx_shipments_status_week ON shipments(latest_status, week_number)',
  'CREATE INDEX IF NOT EXISTS idx_shipments_status_warehouse ON shipments(latest_status, receiving_warehouse)',
  'CREATE INDEX IF NOT EXISTS idx_shipments_order_ref ON shipments(order_ref)',
  'CREATE INDEX IF NOT EXISTS idx_shipments_created_at ON shipments(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_shipments_inspection_status ON shipments(inspection_status)',
  'CREATE INDEX IF NOT EXISTS idx_shipments_receiving_status ON shipments(receiving_status)'
];

export async function addPerformanceIndexes() {
  const client = await pool.connect();
  try {
    console.log('Starting performance index migration...');

    for (const indexQuery of performanceIndexes) {
      try {
        await client.query(indexQuery);
        console.log(`✓ Created index: ${indexQuery.split('idx_')[1].split(' ')[0]}`);
      } catch (error) {
        // Index might already exist, continue
        if (!error.message.includes('already exists')) {
          console.warn(`Warning: ${error.message}`);
        }
      }
    }

    console.log('✓ Performance index migration completed successfully');
    return true;
  } catch (error) {
    console.error('Performance index migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addPerformanceIndexes()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
