/**
 * Integration tests for Swagger/OpenAPI documentation
 * Verifies API documentation endpoints work correctly
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../index.js';

describe('Swagger API Documentation', () => {
  describe('GET /api-docs/swagger.json', () => {
    it('should return OpenAPI specification', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.openapi).toBeDefined();
      expect(response.body.openapi).toBe('3.0.0');
    });

    it('should have API info defined', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      expect(response.body.info).toBeDefined();
      expect(response.body.info.title).toBe('Synercore Import Schedule API');
      expect(response.body.info.version).toBe('1.0.0');
    });

    it('should have servers defined', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      expect(response.body.servers).toBeDefined();
      expect(response.body.servers.length).toBeGreaterThan(0);
    });

    it('should have security schemes defined', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      expect(response.body.components).toBeDefined();
      expect(response.body.components.securitySchemes).toBeDefined();
      expect(response.body.components.securitySchemes.bearerAuth).toBeDefined();
      expect(response.body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
    });

    it('should have schemas defined', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      expect(response.body.components.schemas).toBeDefined();
      expect(response.body.components.schemas.Error).toBeDefined();
      expect(response.body.components.schemas.Shipment).toBeDefined();
      expect(response.body.components.schemas.Supplier).toBeDefined();
      expect(response.body.components.schemas.User).toBeDefined();
      expect(response.body.components.schemas.AuthResponse).toBeDefined();
    });

    it('should document authentication endpoints', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const paths = response.body.paths;
      expect(paths['/api/auth/login']).toBeDefined();
      expect(paths['/api/auth/register']).toBeDefined();
      expect(paths['/api/auth/logout']).toBeDefined();
      expect(paths['/api/auth/refresh']).toBeDefined();
    });

    it('should document shipment endpoints', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const paths = response.body.paths;
      expect(paths['/api/shipments']).toBeDefined();
      expect(paths['/api/shipments/{id}']).toBeDefined();
    });

    it('should document supplier endpoints', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const paths = response.body.paths;
      expect(paths['/api/suppliers']).toBeDefined();
    });

    it('should have proper request/response schemas', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const loginEndpoint = response.body.paths['/api/auth/login'];
      expect(loginEndpoint.post).toBeDefined();
      expect(loginEndpoint.post.requestBody).toBeDefined();
      expect(loginEndpoint.post.responses).toBeDefined();
    });

    it('should document error responses', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const errorSchema = response.body.components.schemas.Error;
      expect(errorSchema.properties.error).toBeDefined();
      expect(errorSchema.properties.code).toBeDefined();
      expect(errorSchema.properties.timestamp).toBeDefined();
    });
  });

  describe('GET /api-docs', () => {
    it('should serve Swagger UI', async () => {
      const response = await request(app)
        .get('/api-docs/')
        .expect(200);

      expect(response.text).toContain('Swagger UI');
    });

    it('should include Swagger CSS and JS', async () => {
      const response = await request(app)
        .get('/api-docs/')
        .expect(200);

      // Swagger UI includes these in the HTML
      expect(response.text).toContain('swagger-ui');
    });

    it('should redirect /api-docs to /api-docs/', async () => {
      const response = await request(app)
        .get('/api-docs')
        .expect(301);

      expect(response.headers.location).toContain('/api-docs/');
    });
  });

  describe('Health endpoint documentation', () => {
    it('should document health check endpoint', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const paths = response.body.paths;
      expect(paths['/api/health']).toBeDefined();
      expect(paths['/api/health'].get).toBeDefined();
    });
  });

  describe('Schema validation', () => {
    it('Shipment schema should have required properties', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const shipmentSchema = response.body.components.schemas.Shipment;
      expect(shipmentSchema.required).toContain('id');
      expect(shipmentSchema.required).toContain('orderRef');
      expect(shipmentSchema.required).toContain('latestStatus');
    });

    it('Supplier schema should have required properties', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const supplierSchema = response.body.components.schemas.Supplier;
      expect(supplierSchema.required).toContain('id');
      expect(supplierSchema.required).toContain('name');
      expect(supplierSchema.required).toContain('email');
    });

    it('AuthResponse schema should have required properties', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const authSchema = response.body.components.schemas.AuthResponse;
      expect(authSchema.required).toContain('accessToken');
      expect(authSchema.required).toContain('user');
    });
  });

  describe('Endpoint details', () => {
    it('should document POST /api/shipments correctly', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const endpoint = response.body.paths['/api/shipments'].post;
      expect(endpoint).toBeDefined();
      expect(endpoint.tags).toContain('Shipments');
      expect(endpoint.summary).toBeDefined();
      expect(endpoint.description).toBeDefined();
      expect(endpoint.security).toBeDefined();
    });

    it('should document parameters for list endpoints', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const endpoint = response.body.paths['/api/shipments'].get;
      expect(endpoint.parameters).toBeDefined();
      expect(endpoint.parameters.length).toBeGreaterThan(0);
    });

    it('should include response examples', async () => {
      const response = await request(app)
        .get('/api-docs/swagger.json')
        .expect(200);

      const endpoint = response.body.paths['/api/auth/login'].post;
      expect(endpoint.requestBody).toBeDefined();
      expect(endpoint.responses).toBeDefined();
    });
  });
});
