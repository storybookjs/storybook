import storybook from '../dist/index.js';

export default [
  ...storybook.configs['flat/recommended'],
  {
    // not part of `recommended`; enabled here so the demo shows its CSF4 coverage too
    files: ['**/*.stories.js'],
    rules: { 'storybook/csf-component': 'warn' },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    rules: {},
  },
];
