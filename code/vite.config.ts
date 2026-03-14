import { defineConfig } from 'vite-plus';

export default defineConfig({
  lint: {
    plugins: ['typescript', 'react', 'jsx-a11y', 'import'],
    jsPlugins: [
      'eslint-plugin-storybook',
      'eslint-plugin-playwright',
      'eslint-plugin-compat',
      'eslint-plugin-depend',
      {
        name: 'local-rules',
        specifier: '../scripts/eslint-plugin-local-rules',
      },
    ],
    categories: {
      correctness: 'warn',
    },
    options: {
      // Disabled: tsgolint doesn't support baseUrl (https://github.com/oxc-project/tsgolint/issues/351)
      // typeAware: true,
      // typeCheck: true,
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      'no-unused-vars': 'off',
      'no-use-before-define': 'off',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-aria',
              message:
                "Don't import from react-aria directly, please use the specific submodule like @react-aria/overlays instead",
            },
            {
              name: 'react-stately',
              message:
                "Don't import from react-stately directly, please use the specific submodule like @react-stately/overlays instead",
            },
            {
              name: 'react-aria-components',
              message:
                "Don't import from react-aria-components root, but use the react-aria-components/patched-dist/ComponentX entrypoints which are optimised for tree-shaking.",
            },
            {
              name: 'es-toolkit',
              message:
                "Don't import from es-toolkit root, but use the sub-exports like es-toolkit/array entrypoints instead which are optimised for tree-shaking.",
            },
            {
              name: 'lodash',
              message: 'lodash is banned. Use es-toolkit instead.',
            },
            {
              name: 'lodash-es',
              message: 'lodash-es is banned. Use es-toolkit instead.',
            },
            {
              name: 'chalk',
              message: 'chalk is banned.',
            },
            {
              name: 'qs',
              message: 'qs is banned.',
            },
            {
              name: 'handlebars',
              message: 'handlebars is banned.',
            },
            {
              name: 'fs-extra',
              message: 'fs-extra is banned.',
            },
          ],
        },
      ],

      'typescript/no-require-imports': 'off',
      'typescript/no-implied-eval': 'error',
      'typescript/no-explicit-any': 'warn',
      'typescript/no-wrapper-object-types': 'warn',
      'typescript/no-empty-object-type': 'warn',
      'typescript/ban-ts-comment': 'error',
      'typescript/no-unused-vars': 'warn',
      'typescript/no-redeclare': 'off',
      'typescript/no-unsafe-function-type': 'warn',
      'typescript/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
      'typescript/default-param-last': 'off',
      'typescript/triple-slash-reference': 'off',
      'typescript/return-await': 'off',

      'compat/compat': 'error',

      'depend/ban-dependencies': [
        'error',
        {
          modules: ['lodash', 'lodash-es', 'chalk', 'qs', 'handlebars', 'fs-extra'],
        },
      ],

      'react/no-unescaped-entities': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/rules-of-hooks': 'off',
      'react/exhaustive-deps': 'warn',

      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/control-has-associated-label': 'off',

      'import/no-named-as-default': 'warn',
      'import/no-named-as-default-member': 'warn',
      'import/named': 'off',
    },
    overrides: [
      {
        files: ['*.html'],
        rules: {
          'typescript/no-unused-vars': 'off',
        },
      },
      {
        files: ['**/frameworks/angular/template/**/*'],
        rules: {
          'typescript/no-useless-constructor': 'off',
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
        rules: {
          'typescript/no-implied-eval': 'off',
          'typescript/return-await': 'off',
        },
      },
      {
        files: ['**/builder-vite/**/*.html'],
        rules: {
          'no-unused-expressions': 'off',
        },
      },
      {
        files: [
          '**/*.test.*',
          '**/*.spec.*',
          '**/addons/docs/**/*',
          '**/__tests__/**',
          '**/__testfixtures__/**',
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
          'typescript/no-empty-function': 'off',
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
          'storybook/await-interactions': 'error',
          'storybook/context-in-play-function': 'error',
          'storybook/default-exports': 'error',
          'storybook/hierarchy-separator': 'warn',
          'storybook/no-redundant-story-name': 'warn',
          'storybook/prefer-pascal-case': 'warn',
          'storybook/story-exports': 'error',
          'storybook/use-storybook-expect': 'error',
          'storybook/use-storybook-testing-library': 'error',
        },
      },
      {
        files: ['**/*.tsx', '**/*.ts'],
        rules: {
          'no-shadow': 'off',
          'no-dupe-class-members': 'off',
          'react/prop-types': 'off',
          'react/forbid-prop-types': 'off',
          'react/no-unused-prop-types': 'off',
          'react/require-default-props': 'off',
          'react/default-props-match-prop-types': 'off',
          'react/destructuring-assignment': 'warn',
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
        files: ['**/*.d.ts'],
        rules: {
          'no-var': 'off',
          'vars-on-top': 'off',
        },
      },
      {
        files: ['**/builder-vite/input/iframe.html'],
        rules: {
          'no-undef': 'off',
        },
      },
      {
        files: ['**/*.ts', '!**/*.test.*', '!**/*.spec.*', '!**/*.mockdata.*'],
        rules: {
          'local-rules/no-uncategorized-errors': 'warn',
        },
      },
      {
        files: ['**/*.ts', '!**/*.test.*', '!**/*.spec.*'],
        rules: {
          'local-rules/storybook-monorepo-imports': 'error',
        },
      },
      {
        files: ['core/src/preview-errors.ts'],
        rules: {
          'local-rules/no-duplicated-error-codes': 'error',
        },
      },
      {
        files: ['e2e-tests/*.ts'],
        rules: {
          'playwright/no-skipped-test': ['warn', { allowConditional: true }],
          'playwright/no-raw-locators': 'off',
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
    ignorePatterns: [
      'dist',
      'build',
      'coverage',
      'node_modules',
      'storybook-static',
      'built-storybooks',
      'lib/codemod/src/transforms/__testfixtures__',
      '*.bundle.js',
      '*.js.map',
      'ember-output',
      '.yarn',
      'core/assets',
      'core/src/core-server/utils/__search-files-tests__',
      'core/src/core-server/utils/__mockdata__/src/Empty.stories.ts',
      'core/report',
      'sandbox',
      '**/frameworks/angular/template/**',
    ],
  },
  fmt: {
    printWidth: 100,
    tabWidth: 2,
    bracketSpacing: true,
    trailingComma: 'es5',
    singleQuote: true,
    arrowParens: 'always',
    importOrder: [
      '^node:',
      '^(vitest|@testing-library)',
      '^react(-dom(/client)?(/server)?)?$',
      '^storybook/internal',
      '^@storybook/[^-]*$',
      '^@storybook/(?!addon-)(.*)$',
      '^@storybook/addon-(.*)$',
      '<THIRD_PARTY_MODULES>',
      '^[./]',
    ],
    importOrderSeparation: true,
    importOrderSortSpecifiers: true,
    jsdocPreferCodeFences: true,
    tsdoc: true,
    braceStyle: '1tbs',
    sortPackageJson: false,
    overrides: [
      {
        files: ['*.component.html'],
        options: { parser: 'angular' },
      },
      {
        files: ['**/frameworks/angular/src/**/*.ts', '**/frameworks/angular/template/**/*.ts'],
        options: { parser: 'babel-ts' },
      },
      {
        files: ['*.md', '*.mdx'],
        options: {
          importOrderSeparation: false,
          importOrderSortSpecifiers: false,
        },
      },
    ],
    ignorePatterns: [
      '*.mdx',
      '.yarn',
      '.vscode',
      'dist',
      'bench',
      '.nx/cache',
      'core/report',
      '.nx/workspace-data',
      'core/src/core-server/presets/common-manager.ts',
      'lib/eslint-plugin/docs/rules/no-stories-of.md',
      '**/frameworks/angular/template/**',
    ],
  },
});
