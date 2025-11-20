/**
 * Jest configuration for Synercore Import Schedule
 * Configured for both Node (backend) and React (frontend) testing
 */

export default {
  // Use Node test environment for backend tests
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js',
  ],

  // Module name mapping for resolving modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
  },

  // Transform files using Node's ESM support
  transform: {},

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'server/**/*.js',
    'src/**/*.js',
    'src/**/*.jsx',
    '!server/index.js',
    '!src/main.jsx',
    '!**/*.test.js',
    '!**/*.spec.js',
    '!**/node_modules/**',
  ],

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },

  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx'],
};
