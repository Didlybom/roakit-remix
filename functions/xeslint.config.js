export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.dev.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
