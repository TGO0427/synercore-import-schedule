/**
 * Tests for logger utility
 */

import {
  logError,
  logWarn,
  logInfo,
  logDebug,
  getLogLevel,
} from '../logger.js';

describe('Logger', () => {
  // Save original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const originalDebug = console.debug;

  beforeEach(() => {
    // Mock console methods
    console.error = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
    console.debug = jest.fn();
  });

  afterEach(() => {
    // Restore console methods
    console.error = originalError;
    console.warn = originalWarn;
    console.log = originalLog;
    console.debug = originalDebug;
  });

  describe('logError', () => {
    it('should log error message', () => {
      logError('Test error');
      expect(console.error).toHaveBeenCalled();
      const call = console.error.mock.calls[0][0];
      expect(call).toContain('Test error');
      expect(call).toContain('[ERROR]');
    });

    it('should log error with error object', () => {
      const error = new Error('Test error');
      logError('Something went wrong', error);
      expect(console.error).toHaveBeenCalled();
      const call = console.error.mock.calls[0][0];
      expect(call).toContain('Something went wrong');
      expect(call).toContain('Test error');
    });

    it('should log error with context', () => {
      logError('DB error', null, { operation: 'INSERT', table: 'users' });
      expect(console.error).toHaveBeenCalled();
      const call = console.error.mock.calls[0][0];
      expect(call).toContain('DB error');
      expect(call).toContain('operation');
      expect(call).toContain('INSERT');
    });

    it('should include timestamp in log', () => {
      logError('Test');
      const call = console.error.mock.calls[0][0];
      expect(call).toContain('T');
      expect(call).toContain('Z');
    });
  });

  describe('logWarn', () => {
    it('should log warning message', () => {
      logWarn('Warning message');
      expect(console.warn).toHaveBeenCalled();
      const call = console.warn.mock.calls[0][0];
      expect(call).toContain('Warning message');
      expect(call).toContain('[WARN]');
    });

    it('should log warning with context', () => {
      logWarn('Rate limit', { ip: '192.168.1.1', attempts: 5 });
      expect(console.warn).toHaveBeenCalled();
      const call = console.warn.mock.calls[0][0];
      expect(call).toContain('Rate limit');
    });
  });

  describe('logInfo', () => {
    it('should log info message', () => {
      logInfo('Info message');
      expect(console.log).toHaveBeenCalled();
      const call = console.log.mock.calls[0][0];
      expect(call).toContain('Info message');
      expect(call).toContain('[INFO]');
    });

    it('should log info with context', () => {
      logInfo('User logged in', { userId: 'user123', timestamp: '2024-01-01' });
      expect(console.log).toHaveBeenCalled();
      const call = console.log.mock.calls[0][0];
      expect(call).toContain('User logged in');
    });
  });

  describe('logDebug', () => {
    it('should log debug message', () => {
      logDebug('Debug message');
      expect(console.debug).toHaveBeenCalled();
      const call = console.debug.mock.calls[0][0];
      expect(call).toContain('Debug message');
      expect(call).toContain('[DEBUG]');
    });

    it('should log debug with complex context', () => {
      const context = {
        user: { id: '123', name: 'John' },
        data: [1, 2, 3],
      };
      logDebug('Complex data', context);
      expect(console.debug).toHaveBeenCalled();
      const call = console.debug.mock.calls[0][0];
      expect(call).toContain('Complex data');
    });
  });

  describe('getLogLevel', () => {
    it('should return current log level name', () => {
      const level = getLogLevel();
      expect(typeof level).toBe('string');
      expect(['ERROR', 'WARN', 'INFO', 'DEBUG']).toContain(level);
    });
  });

  describe('context formatting', () => {
    it('should handle empty context', () => {
      logInfo('Message', {});
      expect(console.log).toHaveBeenCalled();
      const call = console.log.mock.calls[0][0];
      expect(call).toContain('Message');
    });

    it('should format object values in context', () => {
      logInfo('Message', { data: { nested: 'value' } });
      expect(console.log).toHaveBeenCalled();
      const call = console.log.mock.calls[0][0];
      expect(call).toContain('data');
    });

    it('should handle null context', () => {
      logError('Error', null, null);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('timestamp format', () => {
    it('should use ISO format timestamp', () => {
      logInfo('Test');
      const call = console.log.mock.calls[0][0];
      // ISO format: 2024-01-01T12:00:00.000Z
      expect(call).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
