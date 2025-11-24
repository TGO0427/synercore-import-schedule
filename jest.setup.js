/**
 * Jest setup file
 * Runs before all tests to configure the test environment
 */

import { jest } from '@jest/globals';

// Make jest available globally for ES modules
globalThis.jest = jest;

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-at-least-32-characters-long-for-testing';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-at-least-32-chars-long-for-testing';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/synercore_test';
process.env.LOG_LEVEL = 'DEBUG'; // Allow all log levels during tests

// Extend Jest matchers
expect.extend({
  toBeValidDate(received) {
    // Check if it's a Date object
    if (received instanceof Date) {
      const pass = !isNaN(received);
      return {
        pass,
        message: () =>
          pass
            ? `expected ${received} not to be a valid date`
            : `expected ${received} to be a valid date`,
      };
    }

    // Check if it's an ISO string timestamp
    if (typeof received === 'string') {
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
      const pass = isoRegex.test(received) && !isNaN(Date.parse(received));
      return {
        pass,
        message: () =>
          pass
            ? `expected ${received} not to be a valid ISO date string`
            : `expected ${received} to be a valid ISO date string`,
      };
    }

    // Neither Date nor ISO string
    return {
      pass: false,
      message: () => `expected ${received} to be a valid date or ISO date string`,
    };
  },
});
