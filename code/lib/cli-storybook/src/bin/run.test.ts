import { describe, expect, test, vi } from 'vitest';

import { run } from './run.ts';

const mockAdd = vi.hoisted(() => vi.fn());
const mockTelemetry = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../add.ts', () => ({ add: mockAdd }));
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
  test('add command exits 1 when its setup fails', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockAdd.mockRejectedValueOnce(
      new Error('SB_CORE-SERVER_0006 (MainFileMissingError): No configuration files found')
    );

    run(['node', 'storybook', 'add', '@storybook/addon-essentials', '--yes']);

    await vi.waitFor(() => {
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  test('add command does not exit nonzero when it succeeds', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    mockAdd.mockResolvedValueOnce(undefined);

    run(['node', 'storybook', 'add', '@storybook/addon-essentials', '--yes']);

    await vi.waitFor(() => {
      expect(mockTelemetry).toHaveBeenCalledWith('add', {
        addon: '@storybook/addon-essentials',
        source: 'cli',
      });
    });
    expect(mockAdd).toHaveBeenCalledWith(
      '@storybook/addon-essentials',
      expect.objectContaining({ yes: true })
    );
    // Give the action's floating promise chain one tick to settle before asserting.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
