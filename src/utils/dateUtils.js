// Date utility functions for week number calculations

/**
 * Get the ISO week number from a date
 * @param {Date} date - The date to get the week number for
 * @returns {number} - The ISO week number (1-53)
 */
export function getWeekNumber(date) {
  // Create a copy of the date to avoid modifying the original
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  
  // Calculate full weeks to nearest Thursday
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Get current week number
 * @returns {number} - Current ISO week number
 */
export function getCurrentWeekNumber() {
  return getWeekNumber(new Date());
}

/**
 * Format date as readable string
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
export function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get week start date for a given week number and year
 * @param {number} weekNumber - Week number (1-53)
 * @param {number} year - Year
 * @returns {Date} - Start date of the week (Monday)
 */
export function getWeekStartDate(weekNumber, year = new Date().getFullYear()) {
  // Create January 4th of the given year (always in week 1)
  const jan4 = new Date(year, 0, 4);

  // Find the Monday of week 1
  // Convert Sunday (0) to 7 for correct calculation
  const week1Monday = new Date(jan4);
  const dayOfWeek = jan4.getDay() || 7; // Sunday becomes 7 instead of 0
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);

  // Calculate the Monday of the requested week
  const weekStart = new Date(week1Monday);
  weekStart.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);

  return weekStart;
}

/**
 * Get week date range for a given week number and year
 * @param {number} weekNumber - Week number (1-53)
 * @param {number} year - Year
 * @returns {Object} - Object with startDate and endDate of the week
 */
export function getWeekDateRange(weekNumber, year = new Date().getFullYear()) {
  const startDate = getWeekStartDate(weekNumber, year);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6); // Sunday

  return {
    startDate,
    endDate,
    formatted: `${formatDate(startDate)} - ${formatDate(endDate)}`
  };
}