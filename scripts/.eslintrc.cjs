module.exports = {
  root: true,
  extends: [
    "plugin:oxlint/recommended",
    '@storybook/eslint-config-storybook',
    'plugin:storybook/recommended',
    'plugin:depend/recommended'
  ],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.json'],
  },
  rules: {
    // remove as shared eslint has jest rules removed
    '@typescript-eslint/ban-ts-comment': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { disallowTypeAnnotations: false }],
    'no-use-before-define': 'off',
    'eslint-comments/disable-enable-pair': ['error', { allowWholeFile: true }],
    "depend/ban-dependencies": ["error", {
      "modules": ["lodash", "chalk", "qs", "handlebars", "fs-extra"]
    }]
  },
  overrides: [
    {
      files: ['*.mjs'],
      rules: {
        'import/extensions': ['error', 'always'],
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
      ],
      parserOptions: {
        project: null,
      },
      rules: {
        // '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/dot-notation': 'off',
        '@typescript-eslint/no-implied-eval': 'off',
        '@typescript-eslint/no-throw-literal': 'off',
        '@typescript-eslint/return-await': 'off',
      },
    },
  ],
};
