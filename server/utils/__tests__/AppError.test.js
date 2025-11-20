/**
 * Tests for AppError class
 */

import { AppError } from '../AppError.js';

describe('AppError', () => {
  describe('constructor', () => {
    it('should create an error with message and status code', () => {
      const error = new AppError('Test error', 400);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
    });

    it('should set default status code to 500', () => {
      const error = new AppError('Test error');
      expect(error.statusCode).toBe(500);
    });

    it('should capture stack trace', () => {
      const error = new AppError('Test error', 400);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
    });

    it('should set error code and details', () => {
      const details = { field: 'email', message: 'Invalid' };
      const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.details).toEqual(details);
    });

    it('should set timestamp', () => {
      const error = new AppError('Test');
      expect(error.timestamp).toBeValidDate();
    });
  });

  describe('static factory methods', () => {
    it('should create badRequest error', () => {
      const error = AppError.badRequest('Validation failed', { field: 'email' });
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('should create unauthorized error', () => {
      const error = AppError.unauthorized();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Authentication required');
    });

    it('should create unauthorized error with custom message', () => {
      const error = AppError.unauthorized('Invalid credentials');
      expect(error.message).toBe('Invalid credentials');
    });

    it('should create forbidden error', () => {
      const error = AppError.forbidden();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Access denied');
    });

    it('should create forbidden error with custom message', () => {
      const error = AppError.forbidden('Admin only');
      expect(error.message).toBe('Admin only');
    });

    it('should create notFound error', () => {
      const error = AppError.notFound();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('should create conflict error', () => {
      const error = AppError.conflict();
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });

    it('should create unprocessable error', () => {
      const error = AppError.unprocessable('Invalid data', { field: 'value' });
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(error.details).toEqual({ field: 'value' });
    });

    it('should create internal error', () => {
      const error = AppError.internal('Server error');
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should create internal error with custom code', () => {
      const error = AppError.internal('DB error', 'DB_CONNECTION_FAILED');
      expect(error.code).toBe('DB_CONNECTION_FAILED');
    });

    it('should create unavailable error', () => {
      const error = AppError.unavailable();
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('toJSON', () => {
    it('should return error as JSON object', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      const json = error.toJSON();

      expect(json.error).toBe('Test error');
      expect(json.code).toBe('TEST_ERROR');
      expect(json.statusCode).toBe(400);
      expect(json.timestamp).toBeValidDate();
    });

    it('should include details in JSON when present', () => {
      const details = { field: 'email', message: 'Required' };
      const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR', details);
      const json = error.toJSON();

      expect(json.details).toEqual(details);
    });

    it('should not include details in JSON when not present', () => {
      const error = new AppError('Test error', 400);
      const json = error.toJSON();

      expect(json.details).toBeUndefined();
    });

    it('should be serializable to JSON string', () => {
      const error = AppError.badRequest('Test');
      const jsonString = JSON.stringify(error.toJSON());

      expect(jsonString).toContain('Test');
      expect(jsonString).toContain('BAD_REQUEST');
    });
  });

  describe('error chain', () => {
    it('should be instanceof Error', () => {
      const error = new AppError('Test');
      expect(error instanceof Error).toBe(true);
    });

    it('should have Error prototype chain', () => {
      const error = AppError.badRequest('Test');
      expect(error.name).toBe('AppError');
      expect(error instanceof AppError).toBe(true);
    });
  });
});
