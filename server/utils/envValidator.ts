/**
 * Environment variable validator
 * Checks for required variables on startup and provides helpful error messages
 */

interface EnvConfig {
  required: boolean;
  description: string;
  example: string;
  default?: string;
}

const REQUIRED_VARS: Record<string, EnvConfig> = {
  DATABASE_URL: {
    required: true,
    description: 'PostgreSQL connection string',
    example: 'postgresql://user:password@host:port/database'
  },
  JWT_SECRET: {
    required: true,
    description: 'Secret key for JWT signing (access tokens)',
    example: 'your-secret-key-min-32-chars'
  },
  JWT_REFRESH_SECRET: {
    required: false,
    description: 'Secret key for JWT refresh tokens (optional, falls back to JWT_SECRET)',
    example: 'your-refresh-secret-min-32-chars'
  },
  NODE_ENV: {
    required: false,
    description: 'Application environment (development, production)',
    example: 'production',
    default: 'production'
  },
  PORT: {
    required: false,
    description: 'Server port',
    example: '5001',
    default: '5001'
  },
  FRONTEND_URL: {
    required: false,
    description: 'Frontend application URL for CORS',
    example: 'https://synercore-import-schedule.vercel.app'
  }
};

const OPTIONAL_VARS: Record<string, string> = {
  SENDGRID_API_KEY: 'SendGrid API key for email sending',
  SMTP_HOST: 'SMTP server host for email',
  SMTP_PORT: 'SMTP server port',
  SMTP_USER: 'SMTP authentication username',
  SMTP_PASSWORD: 'SMTP authentication password',
  SMTP_SECURE: 'Use TLS for SMTP (true/false)',
  EMAIL_USER: 'Default email sender address',
  EMAIL_HOST: 'Email service provider hostname',
  EMAIL_PASSWORD: 'Email service password',
  NOTIFICATION_EMAIL_FROM: 'Email address for system notifications',
  ALLOWED_ORIGINS: 'Comma-separated list of allowed CORS origins',
  RAILWAY_ENVIRONMENT: 'Railway deployment environment indicator',
  FORCE_DB_SSL: 'Force SSL for database connection (1 or 0)',
  DISABLE_SSL_VERIFY: 'Disable SSL verification for development (true/false)',
  PG_POOL_MAX: 'Maximum database connections',
  PG_IDLE_TIMEOUT_MS: 'Database connection idle timeout',
  PG_CONNECTION_TIMEOUT_MS: 'Database connection timeout'
};

interface MissingVar {
  name: string;
  description: string;
  example: string;
}

interface InvalidVar {
  name: string;
  issue: string;
  current: string;
}

/**
 * Validate all required environment variables
 */
export function validateEnvironment(): void {
  const missing: MissingVar[] = [];
  const invalid: InvalidVar[] = [];

  // Check required variables
  for (const [varName, config] of Object.entries(REQUIRED_VARS)) {
    if (config.required && !process.env[varName]) {
      missing.push({
        name: varName,
        description: config.description,
        example: config.example
      });
    }
  }

  // Check JWT secret length (should be at least 32 characters)
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    invalid.push({
      name: 'JWT_SECRET',
      issue: 'Must be at least 32 characters long',
      current: `${process.env.JWT_SECRET.length} characters`
    });
  }

  if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
    invalid.push({
      name: 'JWT_REFRESH_SECRET',
      issue: 'Must be at least 32 characters long',
      current: `${process.env.JWT_REFRESH_SECRET.length} characters`
    });
  }

  // If there are issues, throw detailed error
  if (missing.length > 0 || invalid.length > 0) {
    let message = '❌ Environment Validation Failed\n\n';

    if (missing.length > 0) {
      message += '📋 MISSING REQUIRED VARIABLES:\n';
      missing.forEach(item => {
        message += `\n  • ${item.name}\n`;
        message += `    Description: ${item.description}\n`;
        message += `    Example: ${item.example}\n`;
      });
    }

    if (invalid.length > 0) {
      message += '\n⚠️  INVALID VARIABLES:\n';
      invalid.forEach(item => {
        message += `\n  • ${item.name}\n`;
        message += `    Issue: ${item.issue}\n`;
        message += `    Current: ${item.current}\n`;
      });
    }

    message += '\n\n📝 Add these variables to your .env file or deployment platform.\n';
    message += '🔗 See documentation for setup instructions.\n';

    throw new Error(message);
  }

  logValidationSuccess();
}

/**
 * Log validation success with summary of environment
 */
function logValidationSuccess(): void {
  const vars = {
    'Environment': process.env.NODE_ENV || 'production',
    'Port': process.env.PORT || '5001',
    'Database': maskUrl(process.env.DATABASE_URL),
    'Frontend URL': process.env.FRONTEND_URL || 'Not set',
    'JWT Secret': process.env.JWT_SECRET ? '✓ Set' : '✗ Missing',
    'Email Service': getEmailService()
  };

  console.log('✓ Environment Validation Passed');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Object.entries(vars).forEach(([key, value]) => {
    console.log(`  ${key.padEnd(20)}: ${value}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

/**
 * Mask sensitive parts of database URL
 */
function maskUrl(url?: string): string {
  if (!url) return 'Not set';
  try {
    const masked = url.replace(/([a-zA-Z0-9]+):([a-zA-Z0-9!@#$%^&*]+)@/, '$1:****@');
    return masked.length > 50 ? masked.substring(0, 50) + '...' : masked;
  } catch {
    return 'Invalid URL';
  }
}

/**
 * Detect which email service is configured
 */
function getEmailService(): string {
  if (process.env.SENDGRID_API_KEY) return 'SendGrid';
  if (process.env.SMTP_HOST) return `SMTP (${process.env.SMTP_HOST})`;
  return 'Not configured';
}

/**
 * Get summary of optional variables that are set
 */
export function getOptionalVarsSummary(): string[] {
  const configured: string[] = [];
  for (const varName of Object.keys(OPTIONAL_VARS)) {
    if (process.env[varName]) {
      configured.push(varName);
    }
  }
  return configured;
}

/**
 * Log environment info for debugging (use in development)
 */
export function logEnvironmentInfo(): void {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  console.log('\n📊 Environment Configuration:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Required vars
  console.log('\n✓ Required Variables:');
  Object.entries(REQUIRED_VARS).forEach(([name, config]) => {
    const value = process.env[name];
    const status = value ? '✓' : '✗';
    console.log(`  ${status} ${name.padEnd(25)}: ${config.description}`);
  });

  // Configured optional vars
  const configured = getOptionalVarsSummary();
  if (configured.length > 0) {
    console.log('\n✓ Optional Variables Configured:');
    configured.forEach(name => {
      console.log(`  ✓ ${name.padEnd(25)}: ${OPTIONAL_VARS[name]}`);
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

export default {
  validateEnvironment,
  getOptionalVarsSummary,
  logEnvironmentInfo
};
