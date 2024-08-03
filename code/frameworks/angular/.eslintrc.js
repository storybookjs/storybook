module.exports = {
  rules: {
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'no-type-imports', disallowTypeAnnotations: false },
    ],
  },
  overrides: [
    {
      files: ['template/**/*.*'],
      rules: {
        'import/no-extraneous-dependencies': 'off',
      },
    },
  ],
};
