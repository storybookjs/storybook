/**
 * The commander wiring of `storybook tools`: the parts `run.test.ts` cannot see because they live
 * around the run, not inside it — how the result reaches stdout, and the logger silencing that
 * keeps a `--json` stdout parseable.
 */
import { logger } from 'storybook/internal/node-logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { registerToolsPassthrough } from './register.ts';
import type { ToolsRunResult } from './run.ts';

const { runToolsCommand } = vi.hoisted(() => ({ runToolsCommand: vi.fn() }));

vi.mock('./run.ts', () => ({ runToolsCommand }));
vi.mock('node:fs/promises', () => ({ writeFile: vi.fn() }));
// The shared setup replaces the logger with spies; this file is about the real one's level.
vi.mock('storybook/internal/node-logger', async (importOriginal) =>
  importOriginal<typeof import('storybook/internal/node-logger')>()
);
vi.mock('storybook/internal/core-server', () => ({
  withTelemetry: (_name: string, _options: unknown, run: () => Promise<void>) => run(),
  sendTelemetryError: vi.fn(),
}));
vi.mock('storybook/internal/telemetry', () => ({ telemetry: vi.fn() }));

/** Runs the registered action for `storybook tools <argv>` and returns what reached stdout. */
async function runCli(argv: string[]): Promise<string> {
  const program = new Command();
  program.exitOverride();
  const toolsCommand = program.command('tools').exitOverride();
  registerToolsPassthrough(program, toolsCommand, () => async () => {
    throw new Error('unexpected command failure');
  });

  let stdout = '';
  const writeSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((chunk: string | Uint8Array, ...rest: unknown[]) => {
      stdout += String(chunk);
      const callback = rest.at(-1);
      if (typeof callback === 'function') {
        (callback as () => void)();
      }
      return true;
    });
  try {
    await program.parseAsync(['node', 'storybook', 'tools', ...argv]);
  } finally {
    writeSpy.mockRestore();
  }
  return stdout;
}

describe('registerToolsPassthrough', () => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never);

  beforeEach(() => {
    logger.setLogLevel('info');
    runToolsCommand.mockImplementation(
      async (): Promise<ToolsRunResult> => ({
        exitCode: 0,
        output: '{"ok":true}',
        outcome: { kind: 'success' },
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    logger.setLogLevel('info');
  });

  afterEach(() => exitSpy.mockClear());

  it('keeps a --json stdout free of log output while the tool runs', async () => {
    runToolsCommand.mockImplementation(async (): Promise<ToolsRunResult> => {
      logger.warn('Multiple story files share the component id');
      return { exitCode: 0, output: '{"ok":true}', outcome: { kind: 'success' } };
    });

    const stdout = await runCli(['docs', 'show', '--json']);

    expect(() => JSON.parse(stdout)).not.toThrow();
    expect(stdout).not.toContain('Multiple story files');
  });

  it('restores the log level once the run is over, including when it throws', async () => {
    runToolsCommand.mockRejectedValue(new Error('boom'));

    await expect(runCli(['docs', 'show', '--json'])).rejects.toThrow('unexpected command failure');

    expect(logger.getLogLevel()).toBe('info');
  });

  it('leaves logging on without --json, and when the JSON goes to a file', async () => {
    const outputs: string[] = [];
    runToolsCommand.mockImplementation(async (): Promise<ToolsRunResult> => {
      outputs.push(logger.getLogLevel());
      return { exitCode: 0, output: 'markdown', outcome: { kind: 'success' } };
    });

    await runCli(['docs', 'show']);
    await runCli(['docs', 'show', '--json', '--output', 'out.json']);

    expect(outputs).toEqual(['info', 'info']);
  });
});
