import db from './connection.js';

// Disable SSL certificate validation for Railway Postgres
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * Get week start date for a given week number and year
 */
function getWeekStartDate(weekNumber, year) {
  const jan4 = new Date(year, 0, 4);
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - jan4.getDay() + 1);
  const weekStart = new Date(week1Monday);
  weekStart.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);
  return weekStart;
}

/**
 * Get current ISO week number
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Calculate week date from week number with smart year detection
 */
function calculateWeekDate(weekNumber) {
  if (!weekNumber || weekNumber < 1 || weekNumber > 53) return null;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentWeek = getWeekNumber(now);
  const currentMonth = now.getMonth(); // 0-11

  let targetYear = currentYear;

  if (currentMonth === 11 && weekNumber <= 10) {
    targetYear = currentYear + 1;
  } else if (currentMonth === 0 && weekNumber >= 45) {
    targetYear = currentYear - 1;
  } else if (weekNumber < currentWeek - 20) {
    targetYear = currentYear + 1;
  } else if (weekNumber > currentWeek + 20) {
    targetYear = currentYear - 1;
  }

  const weekStartDate = getWeekStartDate(weekNumber, targetYear);
  return weekStartDate.toISOString().split('T')[0];
}

async function backfillWeekDates() {
  try {
    console.log('🔄 Starting selectedWeekDate backfill...');

    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      console.log('⚠️  DATABASE_URL not set, skipping backfill');
      process.exit(0);
      return;
    }

    // Test database connection
    try {
      await db.query('SELECT 1');
      console.log('✓ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error.message);
      process.exit(1);
    }

    // Get all shipments with week_number but no selected_week_date
    const result = await db.query(
      'SELECT id, week_number FROM shipments WHERE week_number IS NOT NULL AND selected_week_date IS NULL'
    );

    const shipments = result.rows;
    console.log(`📦 Found ${shipments.length} shipments needing selectedWeekDate`);

    if (shipments.length === 0) {
      console.log('✅ No shipments need backfilling!');
      process.exit(0);
      return;
    }

    let updated = 0;
    for (const shipment of shipments) {
      const selectedWeekDate = calculateWeekDate(shipment.week_number);

      if (selectedWeekDate) {
        await db.query(
          'UPDATE shipments SET selected_week_date = $1 WHERE id = $2',
          [selectedWeekDate, shipment.id]
        );
        updated++;
      }
    }

    console.log(`✅ Backfilled ${updated} shipments with selectedWeekDate`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  }
}

backfillWeekDates();
