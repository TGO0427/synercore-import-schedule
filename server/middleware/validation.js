// server/middleware/validation.js
import { body, param, query, validationResult } from 'express-validator';

// Middleware to check validation results
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorArray = errors.array();
    console.error('[VALIDATION] Request failed validation:', {
      method: req.method,
      path: req.path,
      body: req.body,
      errors: errorArray
    });
    return res.status(400).json({
      error: 'Validation failed',
      details: errorArray.map(e => ({
        field: e.param,
        msg: e.msg,
        value: e.value
      }))
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

export const validateUserUpdate = [
  param('id').notEmpty().withMessage('User ID is required').trim(),
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, hyphens, and underscores'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('fullName')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Full name must be less than 100 characters')
    .trim(),
  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Role must be either "user" or "admin"'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  validate
];

export const validateResetPassword = [
  param('id').notEmpty().withMessage('User ID is required').trim(),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  validate
];

// Shipment validation rules
export const validateShipmentCreate = [
  body('orderRef')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Order reference must be less than 100 characters')
    .trim(),
  body('supplier')
    .optional()
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
      // Frontend statuses - matches src/types/shipment.js ShipmentStatus
      'planned_airfreight',
      'planned_seafreight',
      'in_transit_airfreight',
      'air_customs_clearance',
      'in_transit_roadway',
      'in_transit_seaway',
      'moored',
      'berth_working',
      'berth_complete',
      'arrived_pta',
      'arrived_klm',
      'arrived_offsite',
      'delayed',
      'cancelled',
      // Post-arrival workflow states
      'unloading',
      'inspection_pending',
      'inspecting',
      'inspection_failed',
      'inspection_passed',
      'receiving',
      'received',
      'stored'
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

export const validateSupplierUpdate = [
  param('id').notEmpty().withMessage('Supplier ID is required').trim(),
  body('name')
    .optional()
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
  body('country')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Country must be less than 100 characters')
    .trim(),
  body('notes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Notes must be less than 1000 characters')
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
      // Frontend statuses - matches src/types/shipment.js ShipmentStatus
      'planned_airfreight',
      'planned_seafreight',
      'in_transit_airfreight',
      'air_customs_clearance',
      'in_transit_roadway',
      'in_transit_seaway',
      'moored',
      'berth_working',
      'berth_complete',
      'arrived_pta',
      'arrived_klm',
      'arrived_offsite',
      'delayed',
      'cancelled',
      // Post-arrival workflow states
      'unloading',
      'inspection_pending',
      'inspecting',
      'inspection_failed',
      'inspection_passed',
      'receiving',
      'received',
      'stored'
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
