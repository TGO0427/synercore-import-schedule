/**
 * Tests for error handler middleware
 */

import { errorHandler, asyncHandler } from '../errorHandler.js';
import { AppError } from '../../utils/AppError.js';

describe('Error Handler Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/api/test',
      id: 'req-123',
      headers: {},
    };

    mockRes = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    mockNext = jest.fn();

    // Mock console methods
    console.error = jest.fn();
    console.warn = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('errorHandler', () => {
    it('should handle AppError and return JSON response', () => {
      const error = AppError.badRequest('Invalid input');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalled();
      const response = mockRes.json.mock.calls[0][0];
      expect(response.error).toBe('Invalid input');
      expect(response.code).toBe('BAD_REQUEST');
    });

    it('should convert non-AppError to AppError', () => {
      const error = new Error('Generic error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should return 404 for NotFound error', () => {
      const error = AppError.notFound('Resource not found');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBe('NOT_FOUND');
    });

    it('should return 401 for Unauthorized error', () => {
      const error = AppError.unauthorized('Invalid token');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 for Forbidden error', () => {
      const error = AppError.forbidden('Access denied');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBe('FORBIDDEN');
    });

    it('should not send response if headers already sent', () => {
      mockRes.headersSent = true;
      const error = new Error('Test error');

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should include error details in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = AppError.badRequest('Invalid', { field: 'email' });

      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.details).toEqual({ field: 'email' });

      process.env.NODE_ENV = 'test';
    });

    it('should include stack trace in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error');

      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.stack).toBeDefined();

      process.env.NODE_ENV = 'test';
    });

    it('should not include stack trace in production mode', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Test error');

      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.stack).toBeUndefined();

      process.env.NODE_ENV = 'test';
    });

    it('should handle AppError with details in development mode', () => {
      process.env.NODE_ENV = 'development';
      const details = { fields: [{ field: 'email', msg: 'Required' }] };
      const error = AppError.unprocessable('Validation failed', details);

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.details).toEqual(details);

      process.env.NODE_ENV = 'test';
    });
  });

  describe('asyncHandler wrapper', () => {
    it('should wrap async function and catch errors', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Async error'));
      const wrapped = asyncHandler(mockHandler);

      wrapped(mockReq, mockRes, mockNext);

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should call handler with correct arguments', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const wrapped = asyncHandler(mockHandler);

      wrapped(mockReq, mockRes, mockNext);

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockHandler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it('should handle successful async operations', async () => {
      let handlerCalled = false;
      const mockHandler = jest.fn(async () => {
        handlerCalled = true;
      });
      const wrapped = asyncHandler(mockHandler);

      wrapped(mockReq, mockRes, mockNext);

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handlerCalled).toBe(true);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch AppError exceptions', async () => {
      const appError = AppError.badRequest('Test');
      const mockHandler = jest.fn().mockRejectedValue(appError);
      const wrapped = asyncHandler(mockHandler);

      wrapped(mockReq, mockRes, mockNext);

      // Wait for promise to resolve
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockNext).toHaveBeenCalledWith(appError);
    });
  });

  describe('Error type conversion', () => {
    it('should handle JSON parse errors', () => {
      const error = new SyntaxError('Unexpected token');
      error.status = 400;
      error.body = '...';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.error).toBeDefined();
    });

    it('should handle JWT errors', () => {
      const error = new Error('JsonWebTokenError');
      error.name = 'JsonWebTokenError';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBe('UNAUTHORIZED');
    });

    it('should handle TokenExpiredError', () => {
      const error = new Error('Token expired');
      error.name = 'TokenExpiredError';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should handle file size limit errors', () => {
      const error = new Error('File too large');
      error.code = 'LIMIT_FILE_SIZE';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle database constraint errors', () => {
      const error = new Error('Unique constraint violation');
      error.code = '23505';

      errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
    });
  });

  describe('Error response format', () => {
    it('should always include error message', () => {
      const error = AppError.badRequest('Test error');

      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.error).toBeDefined();
      expect(response.error.length).toBeGreaterThan(0);
    });

    it('should include error code', () => {
      const error = AppError.badRequest('Test');

      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.code).toBeDefined();
    });

    it('should have consistent structure', () => {
      const error = AppError.forbidden();

      errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response).toHaveProperty('error');
      expect(response).toHaveProperty('code');
      expect(typeof response.error).toBe('string');
      expect(typeof response.code).toBe('string');
    });
  });
});
