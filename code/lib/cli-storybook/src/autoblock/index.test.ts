import { stripVTControlCharacters } from 'node:util';

import { expect, test, vi } from 'vitest';

import { JsPackageManagerFactory } from 'storybook/internal/common';
import { logger as loggerRaw } from 'storybook/internal/node-logger';

import { autoblock } from './index';
import { createBlocker } from './types';

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  writeFile: vi.fn(),
}));
vi.mock('boxen', () => ({
  default: vi.fn((x) => x),
}));
vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    info: vi.fn(),
    line: vi.fn(),
    plain: vi.fn(),
  },
}));

const logger = vi.mocked(loggerRaw);

const blockers = {
  alwaysPass: createBlocker({
    id: 'alwaysPass',
    check: async () => false,
    log: () => 'Always pass',
  }),
  alwaysFail: createBlocker({
    id: 'alwaysFail',
    check: async () => ({ bad: true }),
    log: () => 'Always fail',
  }),
  alwaysFail2: createBlocker({
    id: 'alwaysFail2',
    check: async () => ({ disaster: true }),
    log: () => 'Always fail 2',
  }),
} as const;

const baseOptions: Parameters<typeof autoblock>[0] = {
  configDir: '.storybook',
  mainConfig: {
    stories: [],
  },
  mainConfigPath: '.storybook/main.ts',
  packageJson: {
    dependencies: {},
    devDependencies: {},
  },
  packageManager: JsPackageManagerFactory.getPackageManager({ force: 'npm' }),
};

test('with empty list', async () => {
  const result = await autoblock({ ...baseOptions }, []);
  expect(result).toBe(null);
  expect(logger.plain).not.toHaveBeenCalledWith(expect.stringContaining('No blockers found'));
});

test('all passing', async () => {
  const result = await autoblock({ ...baseOptions }, [
    Promise.resolve({ blocker: blockers.alwaysPass }),
    Promise.resolve({ blocker: blockers.alwaysPass }),
  ]);
  expect(result).toBe(null);
  expect(logger.plain).toHaveBeenCalledWith(expect.stringContaining('No blockers found'));
});

test('1 fail', async () => {
  const result = await autoblock({ ...baseOptions }, [
    Promise.resolve({ blocker: blockers.alwaysPass }),
    Promise.resolve({ blocker: blockers.alwaysFail }),
  ]);

  expect(result).toBe('alwaysFail');
  expect(stripVTControlCharacters(logger.plain.mock.calls[0][0])).toMatchInlineSnapshot(`
    "Storybook has found potential blockers in your project that need to be resolved before upgrading:

    Always fail

    ─────────────────────────────────────────────────

    Fix the above issues and try running the upgrade command again."
  `);
});

test('multiple fails', async () => {
  const result = await autoblock({ ...baseOptions }, [
    Promise.resolve({ blocker: blockers.alwaysPass }),
    Promise.resolve({ blocker: blockers.alwaysFail }),
    Promise.resolve({ blocker: blockers.alwaysFail2 }),
  ]);
  expect(stripVTControlCharacters(logger.plain.mock.calls[0][0])).toMatchInlineSnapshot(`
    "Storybook has found potential blockers in your project that need to be resolved before upgrading:

    Always fail

    ─────────────────────────────────────────────────

    Always fail 2

    ─────────────────────────────────────────────────

    Fix the above issues and try running the upgrade command again."
  `);

  expect(result).toBe('alwaysFail');
});

test('detects svelte-webpack5 usage', async () => {
  // This test checks if the blocker correctly identifies the @storybook/svelte-webpack5 package
  const result = await autoblock(
    {
      ...baseOptions,
      packageJson: {
        dependencies: {
          '@storybook/svelte-webpack5': '^8.0.0',
        },
        devDependencies: {},
      },
    },
    [import('./block-svelte-webpack5')]
  );

  expect(result).toBe('svelteWebpack5Removal');
});

test('allows non-svelte-webpack5 projects', async () => {
  // This test verifies the blocker doesn't trigger for projects not using @storybook/svelte-webpack5
  const result = await autoblock(
    {
      ...baseOptions,
      packageJson: {
        dependencies: {
          '@storybook/svelte-vite': '^8.0.0',
        },
        devDependencies: {},
      },
    },
    [import('./block-svelte-webpack5')]
  );

  expect(result).toBeNull();
});
