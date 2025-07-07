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
    log: () => ({ title: 'Always pass', message: 'Always pass' }),
  }),
  alwaysFail: createBlocker({
    id: 'alwaysFail',
    check: async () => ({ bad: true }),
    log: () => ({ title: 'Always fail', message: 'Always fail' }),
  }),
  alwaysFail2: createBlocker({
    id: 'alwaysFail2',
    check: async () => ({ disaster: true }),
    log: () => ({ title: 'Always fail 2', message: 'Always fail 2' }),
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
