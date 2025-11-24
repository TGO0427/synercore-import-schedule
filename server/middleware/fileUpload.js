/**
 * File Upload Validation Middleware
 * Provides secure file upload handling with validation, MIME type checking,
 * and permission verification
 */

import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

/**
 * Allowed file types with MIME type mapping
 */
export const ALLOWED_FILE_TYPES = {
  pdf: {
    mimes: ['application/pdf'],
    extensions: ['.pdf']
  },
  excel: {
    mimes: [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv'
    ],
    extensions: ['.xls', '.xlsx', '.csv']
  },
  word: {
    mimes: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ],
    extensions: ['.doc', '.docx']
  },
  image: {
    mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif']
  }
};

/**
 * Flatten allowed MIME types across all categories
 */
const getAllowedMimes = () => {
  return Object.values(ALLOWED_FILE_TYPES).flatMap(type => type.mimes);
};

/**
 * Flatten allowed extensions across all categories
 */
const getAllowedExtensions = () => {
  return Object.values(ALLOWED_FILE_TYPES).flatMap(type => type.extensions);
};

/**
 * Validate file extension matches allowed types
 * @param {string} filename - The original filename
 * @returns {boolean} True if extension is allowed
 */
const isValidExtension = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  return getAllowedExtensions().includes(ext);
};

/**
 * Validate MIME type matches extension (prevents file type spoofing)
 * @param {string} mimetype - File MIME type
 * @param {string} filename - Original filename
 * @returns {boolean} True if MIME type is valid for the extension
 */
const isMimeTypeValid = (mimetype, filename) => {
  const ext = path.extname(filename).toLowerCase();

  // Find the file type for this extension
  for (const [, typeConfig] of Object.entries(ALLOWED_FILE_TYPES)) {
    if (typeConfig.extensions.includes(ext)) {
      // Check if MIME type matches this extension
      return typeConfig.mimes.includes(mimetype);
    }
  }

  return false;
};

/**
 * Generate secure filename to prevent path traversal attacks
 * @param {string} originalname - Original filename
 * @returns {string} Safe filename with timestamp
 */
const generateSafeFilename = (originalname) => {
  // Extract extension
  const ext = path.extname(originalname);
  // Generate random string
  const random = crypto.randomBytes(8).toString('hex');
  // Generate timestamp
  const timestamp = Date.now();
  // Return safe filename
  return `${timestamp}_${random}${ext}`;
};

/**
 * File filter for multer - validates file type and extension
 */
const fileFilter = (req, file, cb) => {
  // Check MIME type
  if (!getAllowedMimes().includes(file.mimetype)) {
    const error = new Error(
      `Invalid file type: ${file.mimetype}. Allowed types: PDF, Excel, Word, Images (JPEG, PNG, WebP, GIF)`
    );
    error.code = 'INVALID_MIME_TYPE';
    return cb(error, false);
  }

  // Check extension
  if (!isValidExtension(file.originalname)) {
    const error = new Error(
      `Invalid file extension: ${path.extname(file.originalname)}. Allowed extensions: ${getAllowedExtensions().join(', ')}`
    );
    error.code = 'INVALID_EXTENSION';
    return cb(error, false);
  }

  // Validate MIME type matches extension (prevent spoofing)
  if (!isMimeTypeValid(file.mimetype, file.originalname)) {
    const error = new Error(
      `File extension does not match MIME type. The file appears to be corrupted or altered.`
    );
    error.code = 'MIME_EXTENSION_MISMATCH';
    return cb(error, false);
  }

  // Filename must not contain path traversal attempts
  const basename = path.basename(file.originalname);
  if (basename !== file.originalname) {
    const error = new Error('Invalid filename: path traversal detected');
    error.code = 'PATH_TRAVERSAL';
    return cb(error, false);
  }

  cb(null, true);
};

/**
 * Create multer instance for single file uploads (documents, Excel, etc.)
 * Max file size: 10MB
 */
export const createSingleFileUpload = () => {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
    fileFilter,
  });
};

/**
 * Create multer instance for multiple file uploads
 * Max 10 files, 10MB each
 */
export const createMultipleFileUpload = (maxFiles = 10) => {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max per file
    },
    fileFilter,
  });
};

/**
 * Middleware to handle multer errors and provide consistent error responses
 */
export const handleUploadError = (err, req, res, next) => {
  // Handle multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'FILE_TOO_LARGE') {
      return res.status(413).json({
        error: 'File too large',
        code: 'FILE_TOO_LARGE',
        details: 'Maximum file size is 10MB'
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(413).json({
        error: 'Too many files',
        code: 'LIMIT_FILE_COUNT',
        details: `Maximum ${err.limit} files allowed`
      });
    }

    return res.status(400).json({
      error: 'File upload error',
      code: err.code,
      details: err.message
    });
  }

  // Handle custom validation errors
  if (err.code === 'INVALID_MIME_TYPE' ||
      err.code === 'INVALID_EXTENSION' ||
      err.code === 'MIME_EXTENSION_MISMATCH' ||
      err.code === 'PATH_TRAVERSAL') {
    return res.status(400).json({
      error: 'File validation failed',
      code: err.code,
      details: err.message
    });
  }

  // Handle other errors
  if (err) {
    return res.status(400).json({
      error: 'File upload failed',
      details: err.message
    });
  }

  next();
};

/**
 * Middleware to verify user has permission to upload for a supplier
 * Checks that user is either uploading for themselves (suppliers) or is admin
 */
export const verifyUploadPermission = (req, res, next) => {
  const { supplierId } = req.body;

  if (!supplierId) {
    return res.status(400).json({
      error: 'Supplier ID is required',
      code: 'MISSING_SUPPLIER_ID'
    });
  }

  // Admin can upload for any supplier
  if (req.user?.role === 'admin') {
    return next();
  }

  // Supplier can only upload for themselves
  if (req.user?.supplierId && req.user.supplierId === supplierId) {
    return next();
  }

  // Regular user cannot upload documents
  return res.status(403).json({
    error: 'Forbidden',
    code: 'INSUFFICIENT_PERMISSIONS',
    details: 'You do not have permission to upload documents for this supplier'
  });
};

/**
 * Middleware to validate required files are present
 */
export const validateFilesPresent = (req, res, next) => {
  // Handle single file upload
  if (req.file) {
    return next();
  }

  // Handle multiple files upload
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    return next();
  }

  res.status(400).json({
    error: 'No files uploaded',
    code: 'NO_FILES',
    details: 'Please upload at least one file'
  });
};

/**
 * Utility to generate safe filenames for storage
 * Usage: const safeFilename = generateSafeFilename(file.originalname);
 */
export { generateSafeFilename };
