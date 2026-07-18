import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import prettier from 'eslint-config-prettier'

// Flat config (ESLint 9). Type-aware linting over src: the recommended TS ruleset,
// the React hooks rules (exhaustive-deps, rules-of-hooks), the react-refresh
// fast-refresh guard, and jsx-a11y accessibility rules. `prettier` is applied
// LAST so it disables every stylistic rule that would fight the formatter -
// Prettier owns formatting, ESLint owns correctness.
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', '*.config.js', '*.config.ts'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.es2022 },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Tests: allow non-null assertions and relax the fast-refresh rule.
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  // Must be last: turn off ESLint rules that conflict with Prettier.
  prettier,
)
