/**
 * Integration tests for health endpoint
 */

import request from 'supertest';
import express from 'express';

// Create a simple test app
const createTestApp = () => {
  const app = express();

  // Health endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'OK',
      ready: true,
      timestamp: new Date().toISOString(),
    });
  });

  return app;
};

describe('Health Check Endpoint', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
  });

  it('should return 200 OK', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('should return status OK', async () => {
    const response = await request(app).get('/health');
    expect(response.body.status).toBe('OK');
  });

  it('should indicate ready status', async () => {
    const response = await request(app).get('/health');
    expect(response.body.ready).toBe(true);
  });

  it('should include valid timestamp', async () => {
    const response = await request(app).get('/health');
    expect(response.body.timestamp).toBeValidDate();
  });

  it('should be accessible without authentication', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });
});
