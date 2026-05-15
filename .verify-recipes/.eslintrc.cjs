module.exports = {
  root: true,
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', project: false },
  env: { node: true, es2022: true },
  plugins: ['@typescript-eslint', 'verify-recipes'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: 'none', varsIgnorePattern: 'none' },
    ],

    // Security: forbid dynamic code execution
    'no-eval': 'error',
    'no-new-func': 'error',
    'no-implied-eval': 'error',
    'no-restricted-globals': ['error', 'eval', 'Function'],

    // Security (C6): deny every node: built-in (and its bare-form alias).
    // ESLint's no-restricted-imports has no "allow-list" mode, so we
    // enumerate the dangerous module names explicitly and pair it with
    // a `node:*` glob to catch the prefixed forms regardless of which
    // built-in shows up. The intent is an allow-list: imports allowed
    // in recipes are limited to `@playwright/test`, `./_util.ts`, and
    // `./_util` (and the deny-regex tripwire enforces the same).
    'no-restricted-imports': [
      'error',
      {
        paths: [
          { name: 'child_process' },
          { name: 'node:child_process' },
          { name: 'fs' },
          { name: 'fs/promises' },
          { name: 'node:fs' },
          { name: 'node:fs/promises' },
          { name: 'net' },
          { name: 'node:net' },
          { name: 'dns' },
          { name: 'node:dns' },
          { name: 'http' },
          { name: 'node:http' },
          { name: 'https' },
          { name: 'node:https' },
          { name: 'module' },
          { name: 'node:module' },
          { name: 'vm' },
          { name: 'node:vm' },
          { name: 'cluster' },
          { name: 'node:cluster' },
          { name: 'worker_threads' },
          { name: 'node:worker_threads' },
          { name: 'os' },
          { name: 'node:os' },
          { name: 'path' },
          { name: 'node:path' },
          { name: 'stream' },
          { name: 'node:stream' },
          { name: 'tls' },
          { name: 'node:tls' },
        ],
        patterns: [
          {
            group: ['node:*'],
            message:
              'node: built-ins are forbidden in recipes. Imports allowed: @playwright/test, ./_util.ts, ./_util.',
          },
        ],
      },
    ],

    // Security (C6): forbid runtime resolver / dynamic eval / native bindings.
    // Each selector pins one obfuscation path that would otherwise sneak past
    // the static import allow-list.
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.name='require']",
        message: 'Runtime require() is forbidden in recipes.',
      },
      {
        selector: "MemberExpression[property.name='require']",
        message:
          'Member-access require (e.g. `foo.require`, `module.require`) is forbidden in recipes.',
      },
      {
        selector:
          "MemberExpression[object.object.name='process'][object.property.name='mainModule']",
        message: 'process.mainModule.* access is forbidden in recipes.',
      },
      {
        selector: "MemberExpression[object.name='globalThis'][computed=true]",
        message: 'Computed globalThis[...] access is forbidden in recipes.',
      },
      {
        selector: 'ImportExpression',
        message: 'Dynamic import() is forbidden in recipes.',
      },
      {
        selector: "Identifier[name='createRequire']",
        message: 'createRequire is forbidden in recipes.',
      },
      {
        selector: "MemberExpression[property.name='_load']",
        message: 'Module._load access is forbidden in recipes.',
      },
      {
        selector: "MemberExpression[object.name='process'][property.name='binding']",
        message: 'process.binding() is forbidden in recipes.',
      },
      {
        selector: "MemberExpression[object.name='process'][property.name='dlopen']",
        message: 'process.dlopen is forbidden in recipes.',
      },
      {
        selector:
          "CallExpression[callee.object.name='process'][callee.property.name=/^(exit|kill|binding)$/]",
        message: 'process.exit/kill/binding are forbidden in recipes.',
      },
      {
        selector: "CallExpression[callee.name='fetch']",
        message: 'Global fetch is forbidden in recipes; use page.* primitives.',
      },
    ],

    // Custom structural rules for Playwright recipe correctness
    'verify-recipes/listener-before-goto': 'error',
    'verify-recipes/attach-pattern': 'error',
  },
};
