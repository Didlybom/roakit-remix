module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  settings: {
    react: { version: 'detect' },
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/jsx-runtime',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['tsconfig.json', 'tsconfig.dev.json'],
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  ignorePatterns: ['/build/**/*', '/app/proto/**/*'],
  plugins: ['@typescript-eslint', '@stylistic', 'react', 'react-hooks', 'jest'],
  rules: {
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/consistent-type-definitions': ['off'],
    '@typescript-eslint/prefer-nullish-coalescing': ['off'],
    'no-console': ['error'],
    'arrow-parens': ['error', 'as-needed'],
    '@typescript-eslint/no-misused-promises': [
      'error',
      { checksVoidReturn: { attributes: false } },
    ],
  },
};
