module.exports = {
  extends: ['@remix-run/eslint-config'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json', 'tsconfig.dev.json'],
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  ignorePatterns: ['/build/**/*', '/app/proto/**/*'],
  rules: {
    'no-console': ['error'],
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
  },
};
