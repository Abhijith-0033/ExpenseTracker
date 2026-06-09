// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const tsConfig = expoConfig.find(c => c.plugins && c.plugins['@typescript-eslint']);
const tsPlugin = tsConfig ? tsConfig.plugins['@typescript-eslint'] : null;

module.exports = defineConfig([
  ...expoConfig,
  {
    ignores: ['dist/*'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        module: 'readonly',
        require: 'readonly',
        process: 'readonly',
        exports: 'readonly',
        global: 'readonly',
      },
    },
    plugins: tsPlugin ? { '@typescript-eslint': tsPlugin } : {},
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'none',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'none',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      'react-hooks/exhaustive-deps': 'off',
    },
  },
]);
