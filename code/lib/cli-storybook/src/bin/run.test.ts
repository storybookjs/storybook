import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  type JsPackageManager,
  JsPackageManagerFactory,
  removeAddon,
} from 'storybook/internal/common';

import { doAutomigrate } from '../automigrate/index.ts';
import { upgrade } from '../upgrade.ts';

import { run } from './run.ts';

const mockAdd = vi.hoisted(() => vi.fn());
const mockSandbox = vi.hoisted(() => vi.fn());
const mockTelemetry = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../add.ts', () => ({ add: mockAdd }));
vi.mock('../sandbox.ts', () => ({ sandbox: mockSandbox }));
vi.mock('../upgrade.ts', { spy: true });
vi.mock('../automigrate/index.ts', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
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

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(upgrade).mockResolvedValue(undefined);
    vi.mocked(doAutomigrate).mockResolvedValue(undefined);
    vi.mocked(removeAddon).mockResolvedValue(undefined);
    vi.mocked(JsPackageManagerFactory.getPackageManager).mockReturnValue({
      type: 'npm',
    } as JsPackageManager);
  });

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
    await run(['node', 'storybook', 'upgrade', ...args]);

    expect(upgrade).toHaveBeenCalledWith(expect.objectContaining({ skipInstall }));
    if (args.includes('--skip-check')) {
      expect(upgrade).toHaveBeenCalledWith(expect.objectContaining({ skipCheck: true }));
    }
    expect(exitSpy).not.toHaveBeenCalled();
  });

  test.each([
    { name: 'default', flag: undefined, skipInstall: false },
    { name: '--no-install', flag: '--no-install', skipInstall: true },
    { name: '--install', flag: '--install', skipInstall: false },
    { name: 'legacy --skip-install', flag: '--skip-install', skipInstall: true },
  ])('add, remove, and automigrate forward $name', async ({ flag, skipInstall }) => {
    for (const [command, commandFn] of [
      ['add', mockAdd],
      ['remove', vi.mocked(removeAddon)],
      ['automigrate', vi.mocked(doAutomigrate)],
    ] as const) {
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
