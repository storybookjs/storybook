import { describe, expect, test, vi } from 'vitest';

import { run } from './run.ts';

const mockAdd = vi.hoisted(() => vi.fn());
const mockSandbox = vi.hoisted(() => vi.fn());
const mockUpgrade = vi.hoisted(() => vi.fn());
const mockAutomigrate = vi.hoisted(() => vi.fn());
const mockRemove = vi.hoisted(() => vi.fn());
const mockTelemetry = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../add.ts', () => ({ add: mockAdd }));
vi.mock('../sandbox.ts', () => ({ sandbox: mockSandbox }));
vi.mock('../upgrade.ts', () => ({ upgrade: mockUpgrade }));
vi.mock('../automigrate/index.ts', () => ({ doAutomigrate: mockAutomigrate }));
vi.mock('storybook/internal/common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/common')>();
  return {
    ...actual,
    removeAddon: mockRemove,
    JsPackageManagerFactory: {
      ...actual.JsPackageManagerFactory,
      getPackageManager: () => ({ type: 'npm' }),
    },
  };
});
vi.mock('storybook/internal/cli', () => ({
  globalSettings: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('storybook/internal/core-server', () => ({
  withTelemetry: (_eventType: string, _options: unknown, command: () => Promise<unknown>) =>
    command(),
}));
vi.mock('storybook/internal/telemetry', () => ({
  addToGlobalContext: vi.fn(),
  telemetry: mockTelemetry,
}));
vi.mock('storybook/internal/node-logger', async (importOriginal) => {
  const actual = await importOriginal<typeof import('storybook/internal/node-logger')>();
  return {
    ...actual,
    logTracker: {
      ...actual.logTracker,
      writeToFile: vi.fn().mockResolvedValue('debug-storybook.log'),
    },
  };
});

describe('run', () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

  test.each([
    {
      name: 'add',
      args: ['add', '@storybook/addon-essentials', '--yes'],
      commandFn: mockAdd,
    },
    {
      name: 'sandbox',
      args: ['sandbox'],
      commandFn: mockSandbox,
    },
  ] as const)('$name command exits 1 when its setup fails', async ({ name, args, commandFn }) => {
    commandFn.mockRejectedValueOnce(new Error(`${name} failed`));

    await run(['node', 'storybook', ...args]);

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  test('add command does not exit nonzero when it succeeds', async () => {
    mockAdd.mockResolvedValueOnce(undefined);

    await run(['node', 'storybook', 'add', '@storybook/addon-essentials', '--yes']);

    expect(mockAdd).toHaveBeenCalledWith(
      '@storybook/addon-essentials',
      expect.objectContaining({ yes: true })
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test.each([
    { name: 'default', args: [], skipInstall: false },
    { name: '--no-install', args: ['--no-install', '--skip-check'], skipInstall: true },
    { name: '--install', args: ['--install'], skipInstall: false },
  ])('upgrade forwards $name installation setting', async ({ args, skipInstall }) => {
    mockUpgrade.mockResolvedValueOnce(undefined);

    await run(['node', 'storybook', 'upgrade', ...args]);

    expect(mockUpgrade).toHaveBeenCalledWith(expect.objectContaining({ skipInstall }));
    if (args.includes('--skip-check')) {
      expect(mockUpgrade).toHaveBeenCalledWith(expect.objectContaining({ skipCheck: true }));
    }
    expect(exitSpy).not.toHaveBeenCalled();
    mockUpgrade.mockClear();
  });

  test.each([
    { name: 'default', flag: undefined, skipInstall: false },
    { name: '--no-install', flag: '--no-install', skipInstall: true },
    { name: '--install', flag: '--install', skipInstall: false },
    { name: 'legacy --skip-install', flag: '--skip-install', skipInstall: true },
  ])('add, remove, and automigrate forward $name', async ({ flag, skipInstall }) => {
    for (const [command, commandFn] of [
      ['add', mockAdd],
      ['remove', mockRemove],
      ['automigrate', mockAutomigrate],
    ] as const) {
      commandFn.mockResolvedValueOnce(undefined);
      const args = command === 'automigrate' ? [] : ['example-addon'];

      await run(['node', 'storybook', command, ...args, ...(flag ? [flag] : [])]);

      if (command === 'automigrate') {
        expect(commandFn).toHaveBeenCalledWith(expect.objectContaining({ skipInstall }));
      } else {
        expect(commandFn).toHaveBeenCalledWith(
          'example-addon',
          expect.objectContaining({ skipInstall })
        );
      }
      commandFn.mockClear();
    }
  });
});
