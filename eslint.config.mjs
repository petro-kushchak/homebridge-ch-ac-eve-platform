import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { files: ['**/*.{js,mjs,cjs,ts}'] },
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,
  {
    rules: {
      'quotes': ['warn', 'single'],
      'semi': ['off'],
      'dot-notation': 'off',
      'eqeqeq': 'error',
      'curly': ['error', 'all'],
      'prefer-arrow-callback': ['warn'],
      'max-len': ['warn', 140],
      'no-console': ['warn'],
      'no-non-null-assertion': ['off'],

      'lines-between-class-members': [
        'warn',
        'always',
        {
          exceptAfterSingleLine: true,
        },
      ],

      'no-else-return': [
        'error',
        {
          allowElseIf: false,
        },
      ],

      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/array-type': ['warn'],
      '@typescript-eslint/prefer-for-of': ['warn'],
      '@typescript-eslint/adjacent-overload-signatures': ['warn'],
      '@typescript-eslint/method-signature-style': ['warn', 'method'],
      '@typescript-eslint/no-misused-new': ['error'],
      '@typescript-eslint/no-dynamic-delete': 'off',
    },
  },
  {
    files: ['**/*.spec.ts'],

    rules: {
    },
  },
];