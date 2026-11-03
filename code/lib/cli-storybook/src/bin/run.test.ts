import { describe, expect, test, vi } from 'vitest';

import { run } from './run.ts';

const mockAdd = vi.hoisted(() => vi.fn());
const mockSandbox = vi.hoisted(() => vi.fn());
const mockTelemetry = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../add.ts', () => ({ add: mockAdd }));
vi.mock('../sandbox.ts', () => ({ sandbox: mockSandbox }));
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
});
