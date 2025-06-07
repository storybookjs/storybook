import { beforeEach, expect, test, vi } from 'vitest';

import { autoblock } from './index';
import { type BlockerModule, createBlocker } from './types';

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<any>()),
  writeFile: vi.fn(),
}));
vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    info: vi.fn(),
    line: vi.fn(),
    plain: vi.fn(),
  },
  prompt: {
    logBox: vi.fn((x) => x),
  },
}));

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

const mockPackageManager = {
  getInstalledVersion: vi.fn(),
  isPackageInstalled: vi.fn(),
} as any;

const baseOptions: Parameters<typeof autoblock>[0] = {
  configDir: '.storybook',
  mainConfig: {
    stories: [],
  },
  mainConfigPath: '.storybook/main.ts',
  packageManager: mockPackageManager,
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default mock behavior: package not installed
  mockPackageManager.getInstalledVersion.mockResolvedValue(null);
  mockPackageManager.isPackageInstalled.mockResolvedValue(false);
});

test('with empty list', async () => {
  const result = await autoblock({ ...baseOptions }, []);
  expect(result).toBe(null);
});

test('all passing', async () => {
  const result = await autoblock({ ...baseOptions }, [
    Promise.resolve({ blocker: blockers.alwaysPass }),
    Promise.resolve({ blocker: blockers.alwaysPass }),
  ] as BlockerModule<any>[]);
  expect(result?.[0].result).toEqual(false);
  expect(result?.[1].result).toEqual(false);
});

test('1 fail', async () => {
  const result = await autoblock({ ...baseOptions }, [
    Promise.resolve({ blocker: blockers.alwaysPass }),
    Promise.resolve({ blocker: blockers.alwaysFail }),
  ] as BlockerModule<any>[]);

  expect(result?.[0].result).toEqual(false);
  expect(result?.[1].result).toEqual({ bad: true });
});

test('detects svelte-webpack5 usage', async () => {
  // This test checks if the blocker correctly identifies the @storybook/svelte-webpack5 package
  mockPackageManager.isPackageInstalled.mockImplementation((packageName: string) => {
    if (packageName === '@storybook/svelte-webpack5') {
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  });

  const result = await autoblock(baseOptions, [
    import('./block-svelte-webpack5'),
  ] as BlockerModule<any>[]);

  expect(result?.[0].result).toEqual(true);
});

test('allows non-svelte-webpack5 projects', async () => {
  // This test verifies the blocker doesn't trigger for projects not using @storybook/svelte-webpack5
  mockPackageManager.isPackageInstalled.mockImplementation((packageName: string) => {
    if (packageName === '@storybook/svelte-webpack5') {
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  });

  const result = await autoblock(baseOptions, [
    import('./block-svelte-webpack5'),
  ] as BlockerModule<any>[]);

  expect(result?.[0].result).toEqual(false);
});
