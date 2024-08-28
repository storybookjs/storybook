const path = require('path');

const scriptPath = path.join(__dirname, '..', 'scripts');

module.exports = {
  root: true,
  extends: [path.join(scriptPath, '.eslintrc.cjs')],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  plugins: ['local-rules'],
  rules: {
    'import/no-extraneous-dependencies': [
      'error',
      { devDependencies: true, peerDependencies: true },
    ],
    'import/no-unresolved': 'off', // covered by typescript
    'eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
    'eslint-comments/no-unused-disable': 'error',
    'react-hooks/rules-of-hooks': 'off',
    'import/extensions': 'off', // for mjs, we sometimes need extensions
    'jsx-a11y/control-has-associated-label': 'off',
    'import/no-extraneous-dependencies': [
      'error',
      { devDependencies: true, peerDependencies: true },
    ],

    '@typescript-eslint/dot-notation': [
      'error',
      {
        allowIndexSignaturePropertyAccess: true,
      },
    ],
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'vite',
            message: 'Please dynamically import from vite instead, to force the use of ESM',
            allowTypeImports: true,
          },
        ],
      },
    ],
    '@typescript-eslint/default-param-last': 'off',
  },
  overrides: [
    {
      // this package depends on a lot of peerDependencies we don't want to specify, because npm would install them
      files: ['**/frameworks/angular/template/**/*'],
      rules: {
        '@typescript-eslint/no-useless-constructor': 'off',
        '@typescript-eslint/dot-notation': 'off',
      },
    },
    {
      files: ['*.js', '*.jsx', '*.json', '*.html', '**/.storybook/*.ts', '**/.storybook/*.tsx'],
      parserOptions: {
        project: null,
      },
      rules: {
        '@typescript-eslint/dot-notation': 'off',
        '@typescript-eslint/no-implied-eval': 'off',
        '@typescript-eslint/no-throw-literal': 'off',
        '@typescript-eslint/return-await': 'off',
      },
    },
    {
      // this package depends on a lot of peerDependencies we don't want to specify, because npm would install them
      files: ['**/builder-vite/**/*.html'],
      rules: {
        '@typescript-eslint/no-unused-expressions': 'off', // should become error, in the future
      },
    },
    {
      files: ['**/.storybook/**', '**/scripts/**/*', 'vitest.d.ts', '**/vitest.config.*'],
      rules: {
        'import/no-extraneous-dependencies': [
          'error',
          { packageDir: [__dirname], devDependencies: true, peerDependencies: true },
        ],
      },
    },
    {
      files: [
        '*.test.*',
        '*.spec.*',
        '**/addons/docs/**/*',
        '**/__tests__/**',
        '**/__testfixtures__/**',
        '**/*.test.*',
        '**/*.stories.*',
        '**/*.mockdata.*',
        '**/template/**/*',
      ],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
    {
      files: ['**/__tests__/**', '**/__testfixtures__/**', '**/*.test.*', '**/*.stories.*'],
      rules: {
        '@typescript-eslint/no-empty-function': 'off',
      },
    },
    {
      files: ['**/__testfixtures__/**'],
      rules: {
        'react/forbid-prop-types': 'off',
        'react/no-unused-prop-types': 'off',
        'react/require-default-props': 'off',
      },
    },
    {
      files: ['**/*.stories.*'],
      rules: {
        'no-console': 'off',
      },
    },
    {
      files: ['**/renderers/preact/**/*'],
      rules: {
        'react/react-in-jsx-scope': 'off',
        'react/prop-types': 'off',
      },
    },
    {
      files: ['**/*.tsx', '**/*.ts'],
      rules: {
        'no-shadow': 'off',
        '@typescript-eslint/ban-types': 'warn', // should become error, in the future
        'react/require-default-props': 'off',
        'react/prop-types': 'off', // we should use types
        'react/forbid-prop-types': 'off', // we should use types
        'no-dupe-class-members': 'off', // this is called overloads in typescript
        'react/no-unused-prop-types': 'off', // we should use types
        'react/default-props-match-prop-types': 'off', // we should use types
        'import/no-named-as-default': 'warn',
        'import/no-named-as-default-member': 'warn',
        'react/destructuring-assignment': 'warn',

        // This warns about importing interfaces and types in a normal import, it's arguably better to import with the `type` prefix separate from the runtime imports,
        // I leave this as a warning right now because we haven't really decided yet, and the codebase is riddled with errors if I set to 'error'.
        // It IS set to 'error' for JS files.
        'import/named': 'warn',
      },
    },
    {
      files: ['**/*.d.ts'],
      rules: {
        'vars-on-top': 'off',
        'no-var': 'off', // this is how typescript works
        'spaced-comment': 'off',
      },
    },
    {
      files: ['**/builder-vite/input/iframe.html'],
      rules: {
        'no-undef': 'off', // ignore "window" undef errors
      },
    },
    {
      files: ['**/*.ts', '!**/*.test.*', '!**/*.spec.*'],
      excludedFiles: ['**/*.test.*', '**/*.mockdata.*'],
      rules: {
        'local-rules/no-uncategorized-errors': 'warn',
      },
    },
    {
      files: ['**/*.ts', '!**/*.test.*', '!**/*.spec.*'],
      excludedFiles: ['**/*.test.*'],
      rules: {
        'local-rules/storybook-monorepo-imports': 'error',
      },
    },
    {
      files: ['./core/src/preview-errors.ts'],
      excludedFiles: ['**/*.test.*'],
      rules: {
        'local-rules/no-duplicated-error-codes': 'error',
      },
    },
  ],
};
