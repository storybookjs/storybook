const path = require('path');

const scriptPath = path.join(__dirname, '..', 'scripts');

module.exports = {
  root: true,
  extends: [
    path.join(scriptPath, '.eslintrc.cjs'),
    'plugin:storybook/recommended',
    'plugin:compat/recommended',
  ],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  rules: {
    'import/no-extraneous-dependencies': 'off',
    'react/react-in-jsx-scope': 'off',
    'import/no-unresolved': 'off', // covered by typescript
    'eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
    'eslint-comments/no-unused-disable': 'error',
    'react-hooks/rules-of-hooks': 'off',
    'jsx-a11y/no-autofocus': 'warn',
    'import/extensions': 'off', // for mjs, we sometimes need extensions
    'jsx-a11y/control-has-associated-label': 'off',
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
          {
            name: 'react-aria',
            message:
              "Don't import from react-aria directly, please use the specific submodule like @react-aria/overlays instead",
            allowTypeImports: false,
          },
          {
            name: 'react-stately',
            message:
              "Don't import from react-stately directly, please use the specific submodule like @react-stately/overlays instead",
            allowTypeImports: false,
          },
          {
            name: 'react-aria-components',
            message:
              "Don't import from react-aria-components root, but use the react-aria-components/patched-dist/ComponentX entrypoints which are optimised for tree-shaking. Might require addition patching of the package if using new, unpatched components. See https://github.com/storybookjs/storybook/pull/32594",
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
      files: [
        '*.js',
        '*.jsx',
        '*.json',
        '*.html',
        '**/.storybook/*.ts',
        '**/.storybook/*.tsx',
        '**/.storybook/**/*.ts',
        '**/.storybook/**/*.tsx',
      ],
      parserOptions: {
        project: null,
      },
      rules: {
        '@typescript-eslint/dot-notation': 'off',
        '@typescript-eslint/no-implied-eval': 'off',
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
      files: [
        '*.test.*',
        '*.spec.*',
        '**/addons/docs/**/*',
        '**/__tests__/**',
        '**/__testfixtures__/**',
        '**/*.test.*',
        '**/*.test-d.*',
        '**/*.stories.*',
        '**/*.mockdata.*',
        '**/template/**/*',
      ],
      rules: {
        'compat/compat': 'off',
        'jsx-a11y/click-events-have-key-events': 'off',
        'jsx-a11y/no-static-element-interactions': 'off',
        'jsx-a11y/iframe-has-title': 'off',
        'jsx-a11y/alt-text': 'off',
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
    {
      files: ['./e2e-tests/*.ts'],
      extends: ['plugin:playwright/recommended'],
      rules: {
        'playwright/no-skipped-test': [
          'warn',
          {
            allowConditional: true,
          },
        ],
        'playwright/no-raw-locators': 'off', // TODO: enable this, requires the UI to actually be accessible
        'playwright/prefer-comparison-matcher': 'error',
        'playwright/prefer-equality-matcher': 'error',
        'playwright/prefer-hooks-on-top': 'error',
        'playwright/prefer-strict-equal': 'error',
        'playwright/prefer-to-be': 'error',
        'playwright/prefer-to-contain': 'error',
        'playwright/prefer-to-have-count': 'error',
        'playwright/prefer-to-have-length': 'error',
        'playwright/require-to-throw-message': 'error',
        'playwright/require-top-level-describe': 'error',
      },
    },
    {
      files: ['**/renderers/**/*.stories.*', '**/core/template/**/*.stories.*'],
      rules: {
        'storybook/no-renderer-packages': 'off',
      },
    },
  ],
};
