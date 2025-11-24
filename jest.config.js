/**
 * Jest configuration for Synercore Import Schedule
 * Configured for both Node (backend) and React (frontend) testing
 */

export default {
  // Test projects configuration - separate configs for backend and frontend
  projects: [
    {
      // Backend tests (Node environment)
      displayName: 'backend',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/server/**/__tests__/**/*.test.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      transform: {},
    },
    {
      // Frontend tests (Browser environment - jsdom)
      displayName: 'frontend',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.js', '<rootDir>/src/**/__tests__/**/*.test.jsx', '<rootDir>/src/**/__tests__/**/*.test.ts', '<rootDir>/src/**/__tests__/**/*.test.tsx'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.frontend.js'],
      moduleNameMapper: {
        '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
      },
    },
  ],

  // Fallback for non-project tests
  testEnvironment: 'node',

  // Test file patterns (legacy, for non-project tests)
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js',
  ],

  // Module name mapping for resolving modules
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@server/(.*)$': '<rootDir>/server/$1',
  },

  // Transform files (configured per project above)
  transform: {},

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'server/**/*.{js,ts}',
    'src/**/*.{js,jsx,ts,tsx}',
    '!server/index.js',
    '!src/main.jsx',
    '!**/*.test.{js,jsx,ts,tsx}',
    '!**/*.spec.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
  ],

  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],

  // Test timeout
  testTimeout: 15000,

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
    // Higher thresholds for critical backend code
    './server/middleware/*.js': {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
    './server/controllers/*.{js,ts}': {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx'],

  // Watch plugins for better developer experience
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
};
