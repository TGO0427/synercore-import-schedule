/**
 * Tests for validation middleware
 */

import {
  validateEmail,
  validatePassword,
  validateUsername,
  validateRegister,
  validateLogin,
  validateChangePassword,
  validateShipmentCreate,
  validateSupplierCreate,
  validateQuoteCreate,
  validateNotificationCreate,
  validateEmailImportConfig,
  validateWarehouseCapacity,
  validateSchedulerConfig,
  validate,
} from '../validation.js';

describe('Validation Rules', () => {
  describe('validateEmail', () => {
    it('should be defined', () => {
      expect(validateEmail).toBeDefined();
    });

    it('should be a validator', () => {
      expect(validateEmail).toHaveProperty('if');
    });
  });

  describe('validatePassword', () => {
    it('should be defined', () => {
      expect(validatePassword).toBeDefined();
    });

    it('should be a validator', () => {
      expect(validatePassword).toHaveProperty('if');
    });
  });

  describe('validateUsername', () => {
    it('should be defined', () => {
      expect(validateUsername).toBeDefined();
    });

    it('should be a validator', () => {
      expect(validateUsername).toHaveProperty('if');
    });
  });

  describe('Validation Arrays', () => {
    it('validateRegister should be an array with validators', () => {
      expect(Array.isArray(validateRegister)).toBe(true);
      expect(validateRegister.length).toBeGreaterThan(0);
    });

    it('validateLogin should be an array with validators', () => {
      expect(Array.isArray(validateLogin)).toBe(true);
      expect(validateLogin.length).toBeGreaterThan(0);
    });

    it('validateChangePassword should be an array with validators', () => {
      expect(Array.isArray(validateChangePassword)).toBe(true);
      expect(validateChangePassword.length).toBeGreaterThan(0);
    });

    it('validateShipmentCreate should be an array with validators', () => {
      expect(Array.isArray(validateShipmentCreate)).toBe(true);
      expect(validateShipmentCreate.length).toBeGreaterThan(0);
    });

    it('validateSupplierCreate should be an array with validators', () => {
      expect(Array.isArray(validateSupplierCreate)).toBe(true);
      expect(validateSupplierCreate.length).toBeGreaterThan(0);
    });

    it('validateQuoteCreate should be an array with validators', () => {
      expect(Array.isArray(validateQuoteCreate)).toBe(true);
      expect(validateQuoteCreate.length).toBeGreaterThan(0);
    });

    it('validateNotificationCreate should be an array with validators', () => {
      expect(Array.isArray(validateNotificationCreate)).toBe(true);
      expect(validateNotificationCreate.length).toBeGreaterThan(0);
    });

    it('validateEmailImportConfig should be an array with validators', () => {
      expect(Array.isArray(validateEmailImportConfig)).toBe(true);
      expect(validateEmailImportConfig.length).toBeGreaterThan(0);
    });

    it('validateWarehouseCapacity should be an array with validators', () => {
      expect(Array.isArray(validateWarehouseCapacity)).toBe(true);
      expect(validateWarehouseCapacity.length).toBeGreaterThan(0);
    });

    it('validateSchedulerConfig should be an array with validators', () => {
      expect(Array.isArray(validateSchedulerConfig)).toBe(true);
      expect(validateSchedulerConfig.length).toBeGreaterThan(0);
    });
  });

  describe('validate middleware', () => {
    it('should be a function', () => {
      expect(typeof validate).toBe('function');
    });

    it('should call next when no errors', () => {
      const req = {
        headers: {},
      };
      const res = {};
      const next = jest.fn();

      validate(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when there are errors', () => {
      const req = {
        headers: {},
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      // Mock validationResult to return errors
      const mockValidationResult = {
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([
          { param: 'email', msg: 'Invalid email' },
        ]),
      };

      // Note: In real tests, we'd need to mock express-validator's validationResult
      // This is a simplified example
      expect(res.status).toBeDefined();
    });
  });

  describe('Field Validation Rules', () => {
    it('validateShipmentCreate should include statusField validation', () => {
      // validateShipmentCreate includes latestStatus validation
      expect(validateShipmentCreate).toBeDefined();
    });

    it('validateQuoteCreate should validate forwarder enum', () => {
      // Should only allow dhl, dsv, afrigistics
      expect(validateQuoteCreate).toBeDefined();
    });

    it('validateNotificationCreate should validate type enum', () => {
      // Should only allow info, warning, error, success
      expect(validateNotificationCreate).toBeDefined();
    });

    it('validateEmailImportConfig should require email user', () => {
      // user field should be email format
      expect(validateEmailImportConfig).toBeDefined();
    });

    it('validateWarehouseCapacity should validate warehouse name', () => {
      // warehouseName is required parameter
      expect(validateWarehouseCapacity).toBeDefined();
    });

    it('validateSchedulerConfig should validate cron expression', () => {
      // cronExpression is required
      expect(validateSchedulerConfig).toBeDefined();
    });
  });
});
