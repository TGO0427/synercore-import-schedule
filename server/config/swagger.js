/**
 * Swagger/OpenAPI Configuration
 * Defines API documentation for all endpoints
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Synercore Import Schedule API',
      description: 'Complete API documentation for Synercore Supply Chain Management System',
      version: '1.0.0',
      contact: {
        name: 'Synercore Support',
        email: 'support@synercore.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:5001',
        description: 'Development server',
      },
      {
        url: 'https://api.synercore-import-schedule.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token for authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
            code: {
              type: 'string',
              description: 'Error code for client handling',
            },
            details: {
              type: 'object',
              description: 'Additional error details (validation errors, etc.)',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'When the error occurred',
            },
          },
          required: ['error', 'code'],
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Validation failed',
            },
            code: {
              type: 'string',
              example: 'VALIDATION_ERROR',
            },
            details: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    example: 'email',
                  },
                  message: {
                    type: 'string',
                    example: 'Invalid email format',
                  },
                },
              },
            },
          },
        },
        Shipment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique shipment ID',
            },
            orderRef: {
              type: 'string',
              description: 'Order reference number',
            },
            supplier: {
              type: 'string',
              description: 'Supplier name',
            },
            quantity: {
              type: 'integer',
              description: 'Number of items',
            },
            latestStatus: {
              type: 'string',
              enum: [
                'planned_airfreight',
                'planned_seafreight',
                'in_transit_airfreight',
                'in_transit_seafreight',
                'arrived_klm',
                'arrived_pta',
                'clearing_customs',
                'in_warehouse',
                'unloading',
                'inspection_in_progress',
                'inspection_passed',
                'inspection_failed',
                'receiving_goods',
                'stored',
                'archived',
              ],
              description: 'Current shipment status',
            },
            weekNumber: {
              type: 'integer',
              description: 'Week number for planned shipments',
            },
            weekDate: {
              type: 'string',
              format: 'date',
              description: 'Week start date',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['id', 'orderRef', 'supplier', 'latestStatus'],
        },
        Supplier: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique supplier ID',
            },
            name: {
              type: 'string',
              description: 'Supplier company name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Contact email address',
            },
            phone: {
              type: 'string',
              description: 'Contact phone number',
            },
            country: {
              type: 'string',
              description: 'Supplier country',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['id', 'name', 'email'],
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique user ID',
            },
            username: {
              type: 'string',
              description: 'Username for login',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            role: {
              type: 'string',
              enum: ['user', 'admin'],
              description: 'User role',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
          required: ['id', 'username', 'email', 'role'],
        },
        AuthResponse: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT access token',
            },
            refreshToken: {
              type: 'string',
              description: 'JWT refresh token for token renewal',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
          required: ['accessToken', 'user'],
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    './server/routes/*.js',
    './server/config/swagger-paths.js',
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
