module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/no-unescaped-entities': 'off',
    'react/display-name': 'warn',
    'react-hooks/exhaustive-deps': 'warn',
    'no-empty': 'warn',
    'no-prototype-builtins': 'warn',
    'no-useless-escape': 'warn',
    'no-inner-declarations': 'warn',
  },
  overrides: [
    {
      files: ['**/__tests__/**', '**/*.test.*', '**/*.spec.*'],
      env: {
        jest: true,
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules', 'build', 'coverage'],
};
