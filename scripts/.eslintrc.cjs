module.exports = {
  root: true,
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:depend/recommended',
    'plugin:eslint-comments/recommended',
    'plugin:import/react-native',
    'plugin:prettier/recommended',
    'plugin:react-hooks/recommended',
    'plugin:react/recommended',
    'plugin:jsx-a11y/recommended',
  ],
  env: {
    es6: true,
    node: true,
  },
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 8,
    sourceType: 'module',
    extraFileExtensions: ['.html', '.md', '.json', '.svg', '.tag'],
  },
  settings: {
    react: {
      version: 'detect',
    },
    'html/html-extensions': ['.html'],
    'import/core-modules': ['enzyme'],
    'import/ignore': ['node_modules\\/(?!@storybook)'],
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts', '.tsx', '.mjs', '.d.ts'],
        paths: ['node_modules/', 'node_modules/@types/'],
      },
    },
  },
  plugins: [
    'local-rules',
    'compat',
    'file-progress',
    '@typescript-eslint',
    'import',
    'json',
    'html',
    'prettier',
  ],
  rules: {
    'react/no-unescaped-entities': 'off',
    'no-unused-vars': 'off',
    // TODO: Storybook 10 - When we do the ESM migration we must turn this rule on
    '@typescript-eslint/no-require-imports': 'off',
    '@typescript-eslint/no-implied-eval': 'error',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-wrapper-object-types': 'warn',
    '@typescript-eslint/no-empty-object-type': 'warn',
    '@typescript-eslint/ban-ts-comment': 'error',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-redeclare': 'off',
    '@typescript-eslint/no-unsafe-function-type': 'warn',
    '@typescript-eslint/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
    'no-use-before-define': 'off',
    'eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
    'depend/ban-dependencies': [
      'error',
      {
        modules: ['lodash', 'lodash-es', 'chalk', 'qs', 'handlebars', 'fs-extra'],
      },
    ],
  },
  overrides: [
    {
      files: ['*.html'],
      rules: {
        'no-underscore-dangle': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['*.mjs'],
      rules: {
        'import/extensions': ['error', 'always'],
      },
    },
    {
      files: ['*.js', '*.jsx', '*.json', '*.html', '**/.storybook/*.ts', '**/.storybook/*.tsx'],
      parserOptions: {
        project: null,
      },
      rules: {
        // '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/dot-notation': 'off',
        '@typescript-eslint/no-implied-eval': 'off',
        '@typescript-eslint/return-await': 'off',
      },
    },
  ],
};
