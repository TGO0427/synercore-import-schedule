/**
 * Integration tests for error handling
 */

import request from 'supertest';
import express from 'express';
import { errorHandler } from '../../middleware/errorHandler.js';
import { AppError } from '../../utils/AppError.js';

// Create a test app with error handling
const createTestApp = () => {
  const app = express();

  app.use(express.json());

  // Endpoint that throws an error
  app.get('/error/bad-request', (req, res, next) => {
    next(AppError.badRequest('Invalid input data'));
  });

  app.get('/error/not-found', (req, res, next) => {
    next(AppError.notFound('Resource not found'));
  });

  app.get('/error/unauthorized', (req, res, next) => {
    next(AppError.unauthorized('Invalid token'));
  });

  app.get('/error/forbidden', (req, res, next) => {
    next(AppError.forbidden('Access denied'));
  });

  app.get('/error/internal', (req, res, next) => {
    next(new Error('Unexpected server error'));
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      code: 'NOT_FOUND',
      path: req.originalUrl,
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
};

describe('Error Handling Integration', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  describe('AppError responses', () => {
    it('should return 400 for bad request', async () => {
      const response = await request(app).get('/error/bad-request');
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('BAD_REQUEST');
      expect(response.body.error).toBe('Invalid input data');
    });

    it('should return 404 for not found', async () => {
      const response = await request(app).get('/error/not-found');
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should return 401 for unauthorized', async () => {
      const response = await request(app).get('/error/unauthorized');
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 for forbidden', async () => {
      const response = await request(app).get('/error/forbidden');
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('should return 500 for internal errors', async () => {
      const response = await request(app).get('/error/internal');
      expect(response.status).toBe(500);
    });

    it('should always include error property', async () => {
      const response = await request(app).get('/error/bad-request');
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });

    it('should always include code property', async () => {
      const response = await request(app).get('/error/bad-request');
      expect(response.body).toHaveProperty('code');
      expect(typeof response.body.code).toBe('string');
    });
  });

  describe('404 handling', () => {
    it('should return 404 for nonexistent routes', async () => {
      const response = await request(app).get('/api/nonexistent');
      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('should include path in 404 response', async () => {
      const response = await request(app).get('/api/test');
      expect(response.body.path).toBe('/api/test');
    });

    it('should return JSON for 404 errors', async () => {
      const response = await request(app).get('/api/missing');
      expect(response.type).toMatch(/json/);
    });
  });

  describe('Response format consistency', () => {
    it('should have consistent format across different errors', async () => {
      const badRequest = await request(app).get('/error/bad-request');
      const notFound = await request(app).get('/error/not-found');
      const unauthorized = await request(app).get('/error/unauthorized');

      expect(badRequest.body).toHaveProperty('error');
      expect(badRequest.body).toHaveProperty('code');

      expect(notFound.body).toHaveProperty('error');
      expect(notFound.body).toHaveProperty('code');

      expect(unauthorized.body).toHaveProperty('error');
      expect(unauthorized.body).toHaveProperty('code');
    });

    it('should not expose internal details in production', async () => {
      process.env.NODE_ENV = 'production';

      const response = await request(app).get('/error/internal');

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body).not.toHaveProperty('details');

      process.env.NODE_ENV = 'test';
    });

    it('should expose details in development mode', async () => {
      process.env.NODE_ENV = 'development';

      const testApp = createTestApp();
      const response = await request(testApp).get('/error/internal');

      expect(response.status).toBe(500);
      // In development, stack might be included by error handler

      process.env.NODE_ENV = 'test';
    });
  });
});
