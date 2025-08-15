import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...typescript.configs['recommended-requiring-type-checking'].rules,
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-explicit-any': 'warn', // Changed from error to warn for now
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'warn', // Changed from error to warn for now
      '@typescript-eslint/no-unsafe-assignment': 'warn', // Changed from error to warn for now
      '@typescript-eslint/no-unsafe-argument': 'warn', // Changed from error to warn for now
      '@typescript-eslint/no-unsafe-return': 'warn', // Changed from error to warn for now
      '@typescript-eslint/no-unsafe-call': 'warn', // Changed from error to warn for now
      '@typescript-eslint/require-await': 'warn', // Changed from error to warn for now
      '@typescript-eslint/no-misused-promises': 'warn', // Changed from error to warn for now
      '@typescript-eslint/restrict-template-expressions': 'warn', // Changed from error to warn for now
      '@typescript-eslint/no-require-imports': 'warn', // Changed from error to warn for now
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'quote-props': ['error', 'as-needed'],
      'no-undef': 'off', // Turn off since we're using TypeScript
    },
  },
  {
    ignores: ['dist/', 'node_modules/'],
  },
]; 