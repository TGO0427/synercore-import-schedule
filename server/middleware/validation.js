// server/middleware/validation.js
import { body, param, query, validationResult } from 'express-validator';

// Middleware to check validation results
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Common validation rules
export const validateEmail = body('email')
  .optional()
  .isEmail()
  .withMessage('Must be a valid email address')
  .normalizeEmail();

export const validatePassword = body('password')
  .isLength({ min: 6 })
  .withMessage('Password must be at least 6 characters long')
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
  .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');

export const validateUsername = body('username')
  .isLength({ min: 3, max: 50 })
  .withMessage('Username must be between 3 and 50 characters')
  .matches(/^[a-zA-Z0-9_-]+$/)
  .withMessage('Username can only contain letters, numbers, hyphens, and underscores');

// Auth validation rules
export const validateRegister = [
  validateUsername,
  validateEmail,
  validatePassword,
  body('fullName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Full name must be less than 100 characters')
    .trim(),
  validate
];

export const validateLogin = [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
];

export const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number'),
  validate
];

// Shipment validation rules
export const validateShipmentCreate = [
  body('orderRef')
    .notEmpty()
    .withMessage('Order reference is required')
    .isLength({ max: 100 })
    .withMessage('Order reference must be less than 100 characters')
    .trim(),
  body('supplier')
    .notEmpty()
    .withMessage('Supplier is required')
    .isLength({ max: 100 })
    .withMessage('Supplier must be less than 100 characters')
    .trim(),
  body('quantity')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Quantity must be a positive number'),
  body('cbm')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('CBM must be a positive number'),
  body('palletQty')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Pallet quantity must be a positive number'),
  body('weekNumber')
    .optional()
    .isInt({ min: 1, max: 53 })
    .withMessage('Week number must be between 1 and 53'),
  body('finalPod')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Final POD must be less than 100 characters')
    .trim(),
  body('latestStatus')
    .optional()
    .isIn([
      'planned',
      'confirmed',
      'in_transit',
      'customs_clearance',
      'air_customs_clearance',
      'arrived',
      'unloading',
      'inspection',
      'received',
      'rejected',
      'archived'
    ])
    .withMessage('Invalid status'),
  validate
];

// Supplier validation rules
export const validateSupplierCreate = [
  body('name')
    .notEmpty()
    .withMessage('Supplier name is required')
    .isLength({ max: 200 })
    .withMessage('Supplier name must be less than 200 characters')
    .trim(),
  body('contactPerson')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Contact person must be less than 100 characters')
    .trim(),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('phone')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Phone must be less than 50 characters')
    .trim(),
  body('address')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Address must be less than 500 characters')
    .trim(),
  validate
];

// Warehouse capacity validation
export const validateWarehouseCapacity = [
  param('warehouseName')
    .notEmpty()
    .withMessage('Warehouse name is required')
    .isLength({ max: 100 })
    .withMessage('Warehouse name must be less than 100 characters')
    .trim(),
  body('binsUsed')
    .isInt({ min: 0 })
    .withMessage('Bins used must be a non-negative integer'),
  body('capacity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Capacity must be a positive integer'),
  validate
];

// Query parameter validation
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate
];

export const validateShipmentQuery = [
  query('sortBy')
    .optional()
    .isIn([
      'updated_at',
      'created_at',
      'estimatedArrival',
      'orderRef',
      'supplier',
      'finalPod',
      'latestStatus',
      'weekNumber',
      'productName',
      'quantity',
      'cbm',
      'palletQty',
      'receivingWarehouse',
      'forwardingAgent',
      'vesselName'
    ])
    .withMessage('Invalid sort field'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  query('status')
    .optional()
    .isIn([
      'planned',
      'confirmed',
      'in_transit',
      'customs_clearance',
      'air_customs_clearance',
      'arrived',
      'unloading',
      'inspection',
      'received',
      'rejected',
      'archived'
    ])
    .withMessage('Invalid status'),
  validate
];

// ID validation
export const validateId = [
  param('id')
    .notEmpty()
    .withMessage('ID is required')
    .trim(),
  validate
];
