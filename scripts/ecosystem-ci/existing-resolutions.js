/**
 * List of resolutions from the root package.json that should NOT be copied to sandbox package.json.
 * These are the "existing" resolutions that Storybook maintains, as opposed to resolutions that
 * might be injected by ecosystem-ci repos.
 *
 * This array must stay in sync with the resolutions in the root package.json. Run the test in
 * before-test.test.ts to verify they match.
 */
export const EXISTING_RESOLUTIONS = [
  '@babel/runtime',
  '@babel/traverse',
  '@babel/types',
  '@playwright/test',
  '@testing-library/user-event@npm:^14.4.0',
  '@testing-library/user-event@npm:^14.6.1',
  '@types/babel__traverse@npm:*',
  '@types/babel__traverse@npm:^7.18.0',
  '@types/node',
  '@types/react',
  '@vitest/expect@npm:3.2.4',
  'aria-query@5.3.0',
  'esbuild',
  'playwright',
  'playwright-core',
  'react',
  'serialize-javascript',
  'type-fest',
  'typescript',
];
