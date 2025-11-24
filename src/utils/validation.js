/**
 * Centralized form validation utilities
 * Provides consistent validation rules across the entire application
 */

// ============ REGEX PATTERNS ============
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  USERNAME: /^[a-zA-Z0-9_-]+$/,
  PASSWORD_UPPERCASE: /[A-Z]/,
  PASSWORD_LOWERCASE: /[a-z]/,
  PASSWORD_NUMBER: /\d/,
  NUMERIC: /^[0-9]+$/,
  DECIMAL: /^[0-9]*\.?[0-9]+$/,
  URL: /^https?:\/\/.+/,
  PHONE: /^[\d\s\-\+\(\)]+$/
};

// ============ VALIDATION MESSAGES ============
export const VALIDATION_MESSAGES = {
  REQUIRED: 'This field is required',
  EMAIL_INVALID: 'Please enter a valid email address',
  PASSWORD_MIN_LENGTH: 'Password must be at least 8 characters',
  PASSWORD_UPPERCASE: 'Password must contain at least one uppercase letter',
  PASSWORD_LOWERCASE: 'Password must contain at least one lowercase letter',
  PASSWORD_NUMBER: 'Password must contain at least one number',
  PASSWORD_MISMATCH: 'Passwords do not match',
  USERNAME_INVALID: 'Username can only contain letters, numbers, hyphens, and underscores',
  USERNAME_LENGTH: 'Username must be between 3 and 50 characters',
  NUMERIC_INVALID: 'This field must be a number',
  URL_INVALID: 'Please enter a valid URL',
  PHONE_INVALID: 'Please enter a valid phone number'
};

// ============ PASSWORD VALIDATION ============

/**
 * Validate password strength
 * Requirements: 8+ chars, uppercase, lowercase, number
 * @param {string} password - Password to validate
 * @returns {object} { isValid: boolean, errors: string[] }
 */
export function validatePassword(password) {
  const errors = [];

  if (!password) {
    return { isValid: false, errors: [VALIDATION_MESSAGES.REQUIRED] };
  }

  if (password.length < 8) {
    errors.push(VALIDATION_MESSAGES.PASSWORD_MIN_LENGTH);
  }

  if (!REGEX_PATTERNS.PASSWORD_UPPERCASE.test(password)) {
    errors.push(VALIDATION_MESSAGES.PASSWORD_UPPERCASE);
  }

  if (!REGEX_PATTERNS.PASSWORD_LOWERCASE.test(password)) {
    errors.push(VALIDATION_MESSAGES.PASSWORD_LOWERCASE);
  }

  if (!REGEX_PATTERNS.PASSWORD_NUMBER.test(password)) {
    errors.push(VALIDATION_MESSAGES.PASSWORD_NUMBER);
  }

  return {
    isValid: errors.length === 0,
    errors,
    requirements: {
      minLength: { met: password.length >= 8, label: 'At least 8 characters' },
      uppercase: { met: REGEX_PATTERNS.PASSWORD_UPPERCASE.test(password), label: 'One uppercase letter' },
      lowercase: { met: REGEX_PATTERNS.PASSWORD_LOWERCASE.test(password), label: 'One lowercase letter' },
      number: { met: REGEX_PATTERNS.PASSWORD_NUMBER.test(password), label: 'One number' }
    }
  };
}

/**
 * Validate password confirmation
 * @param {string} password - Original password
 * @param {string} confirmPassword - Confirmation password
 * @returns {boolean}
 */
export function validatePasswordConfirmation(password, confirmPassword) {
  return password === confirmPassword;
}

// ============ EMAIL VALIDATION ============

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {object} { isValid: boolean, error: string | null }
 */
export function validateEmail(email) {
  if (!email) {
    return { isValid: false, error: VALIDATION_MESSAGES.REQUIRED };
  }

  const isValid = REGEX_PATTERNS.EMAIL.test(email);
  return {
    isValid,
    error: isValid ? null : VALIDATION_MESSAGES.EMAIL_INVALID
  };
}

// ============ USERNAME VALIDATION ============

/**
 * Validate username format and length
 * @param {string} username - Username to validate
 * @returns {object} { isValid: boolean, errors: string[] }
 */
export function validateUsername(username) {
  const errors = [];

  if (!username) {
    return { isValid: false, errors: [VALIDATION_MESSAGES.REQUIRED] };
  }

  if (username.length < 3 || username.length > 50) {
    errors.push(VALIDATION_MESSAGES.USERNAME_LENGTH);
  }

  if (!REGEX_PATTERNS.USERNAME.test(username)) {
    errors.push(VALIDATION_MESSAGES.USERNAME_INVALID);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============ REQUIRED FIELD VALIDATION ============

/**
 * Check if field is empty
 * @param {any} value - Field value
 * @returns {boolean}
 */
export function isRequired(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return !!value;
}

// ============ NUMERIC VALIDATION ============

/**
 * Validate integer
 * @param {any} value - Value to validate
 * @param {object} options - Min and max values
 * @returns {object} { isValid: boolean, error: string | null }
 */
export function validateInteger(value, options = {}) {
  if (!isRequired(value)) {
    return { isValid: false, error: VALIDATION_MESSAGES.REQUIRED };
  }

  const num = parseInt(value, 10);

  if (isNaN(num)) {
    return { isValid: false, error: VALIDATION_MESSAGES.NUMERIC_INVALID };
  }

  if (options.min !== undefined && num < options.min) {
    return { isValid: false, error: `Must be at least ${options.min}` };
  }

  if (options.max !== undefined && num > options.max) {
    return { isValid: false, error: `Must be at most ${options.max}` };
  }

  return { isValid: true, error: null };
}

/**
 * Validate decimal number
 * @param {any} value - Value to validate
 * @param {object} options - Min and max values
 * @returns {object} { isValid: boolean, error: string | null }
 */
export function validateDecimal(value, options = {}) {
  if (!isRequired(value)) {
    return { isValid: false, error: VALIDATION_MESSAGES.REQUIRED };
  }

  const num = parseFloat(value);

  if (isNaN(num)) {
    return { isValid: false, error: VALIDATION_MESSAGES.NUMERIC_INVALID };
  }

  if (options.min !== undefined && num < options.min) {
    return { isValid: false, error: `Must be at least ${options.min}` };
  }

  if (options.max !== undefined && num > options.max) {
    return { isValid: false, error: `Must be at most ${options.max}` };
  }

  return { isValid: true, error: null };
}

// ============ LENGTH VALIDATION ============

/**
 * Validate text length
 * @param {string} value - Text to validate
 * @param {object} options - Min and max length
 * @returns {object} { isValid: boolean, error: string | null }
 */
export function validateLength(value, options = {}) {
  if (options.required && !isRequired(value)) {
    return { isValid: false, error: VALIDATION_MESSAGES.REQUIRED };
  }

  if (!value) {
    return { isValid: true, error: null };
  }

  const length = String(value).length;

  if (options.min !== undefined && length < options.min) {
    return { isValid: false, error: `Must be at least ${options.min} characters` };
  }

  if (options.max !== undefined && length > options.max) {
    return { isValid: false, error: `Must be at most ${options.max} characters` };
  }

  return { isValid: true, error: null };
}

// ============ URL VALIDATION ============

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {object} { isValid: boolean, error: string | null }
 */
export function validateUrl(url) {
  if (!isRequired(url)) {
    return { isValid: false, error: VALIDATION_MESSAGES.REQUIRED };
  }

  const isValid = REGEX_PATTERNS.URL.test(url);
  return {
    isValid,
    error: isValid ? null : VALIDATION_MESSAGES.URL_INVALID
  };
}

// ============ PHONE VALIDATION ============

/**
 * Validate phone number format
 * @param {string} phone - Phone number to validate
 * @returns {object} { isValid: boolean, error: string | null }
 */
export function validatePhone(phone) {
  if (!isRequired(phone)) {
    return { isValid: false, error: VALIDATION_MESSAGES.REQUIRED };
  }

  const isValid = REGEX_PATTERNS.PHONE.test(phone) && phone.length >= 10;
  return {
    isValid,
    error: isValid ? null : VALIDATION_MESSAGES.PHONE_INVALID
  };
}

// ============ BATCH VALIDATION ============

/**
 * Validate multiple fields at once
 * @param {object} formData - Form data object
 * @param {object} schema - Validation schema
 * @returns {object} Errors object with field names as keys
 *
 * @example
 * const schema = {
 *   email: { validator: validateEmail },
 *   password: { validator: validatePassword },
 *   username: { validator: validateUsername }
 * };
 * const errors = validateForm(formData, schema);
 */
export function validateForm(formData, schema) {
  const errors = {};

  for (const [fieldName, fieldSchema] of Object.entries(schema)) {
    const value = formData[fieldName];
    const validator = fieldSchema.validator;

    if (!validator) continue;

    const result = validator(value, fieldSchema.options);

    if (!result.isValid) {
      errors[fieldName] = result.error || result.errors?.[0] || 'Invalid field';
    }
  }

  return errors;
}

// ============ HELPER FUNCTIONS ============

/**
 * Sanitize input by trimming whitespace
 * @param {string} input - Input to sanitize
 * @returns {string}
 */
export function sanitizeInput(input) {
  return String(input).trim();
}

/**
 * Normalize email (lowercase and trim)
 * @param {string} email - Email to normalize
 * @returns {string}
 */
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/**
 * Check if validation result has errors
 * @param {object} result - Validation result
 * @returns {boolean}
 */
export function hasErrors(result) {
  return !result.isValid || (result.errors && result.errors.length > 0);
}

export default {
  REGEX_PATTERNS,
  VALIDATION_MESSAGES,
  validatePassword,
  validatePasswordConfirmation,
  validateEmail,
  validateUsername,
  isRequired,
  validateInteger,
  validateDecimal,
  validateLength,
  validateUrl,
  validatePhone,
  validateForm,
  sanitizeInput,
  normalizeEmail,
  hasErrors
};
