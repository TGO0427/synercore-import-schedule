/**
 * Integration tests for middleware
 */

import request from 'supertest';
import express from 'express';
import { requestIdMiddleware } from '../../middleware/requestId.js';

// Create test app with middleware
const createTestApp = () => {
  const app = express();

  app.use(requestIdMiddleware);

  app.get('/test', (req, res) => {
    res.json({
      message: 'test',
      requestId: req.id,
    });
  });

  return app;
};

describe('Request ID Middleware', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  it('should assign request ID to every request', async () => {
    const response = await request(app).get('/test');
    expect(response.body.requestId).toBeDefined();
  });

  it('should include request ID in response headers', async () => {
    const response = await request(app).get('/test');
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('should generate unique request IDs', async () => {
    const response1 = await request(app).get('/test');
    const response2 = await request(app).get('/test');

    expect(response1.headers['x-request-id']).not.toBe(
      response2.headers['x-request-id']
    );
  });

  it('should use provided x-request-id header if present', async () => {
    const customId = 'custom-request-id-12345';
    const response = await request(app)
      .get('/test')
      .set('x-request-id', customId);

    expect(response.body.requestId).toBe(customId);
  });

  it('should format request ID with timestamp and random string', async () => {
    const response = await request(app).get('/test');
    const requestId = response.headers['x-request-id'];

    // Format should be timestamp-randomstring
    expect(requestId).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it('should store request ID in req.id', async () => {
    const response = await request(app).get('/test');
    expect(response.body.requestId).toBeDefined();
    expect(typeof response.body.requestId).toBe('string');
  });

  it('should be accessible in response handlers', async () => {
    const response = await request(app).get('/test');
    const requestId = response.body.requestId;

    expect(requestId).toBe(response.headers['x-request-id']);
  });
});

describe('Middleware Chain', () => {
  it('should work with multiple middleware', async () => {
    const app = express();

    // Multiple middleware
    app.use(requestIdMiddleware);
    app.use(express.json());

    app.post('/test', (req, res) => {
      res.json({
        requestId: req.id,
        data: req.body,
      });
    });

    const response = await request(app)
      .post('/test')
      .send({ test: 'data' });

    expect(response.body.requestId).toBeDefined();
    expect(response.body.data).toEqual({ test: 'data' });
  });

  it('should call next middleware', async () => {
    const app = express();

    let middlewareCalled = false;
    app.use(requestIdMiddleware);
    app.use((req, res, next) => {
      middlewareCalled = true;
      next();
    });

    app.get('/test', (req, res) => {
      res.json({ called: middlewareCalled });
    });

    const response = await request(app).get('/test');
    expect(response.body.called).toBe(true);
  });
});
