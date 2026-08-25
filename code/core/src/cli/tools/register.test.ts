/**
 * The commander wiring of `storybook tools`: the parts `run.test.ts` cannot see because they live
 * around the run, not inside it — how the result reaches stdout, and the logger silencing that
 * keeps a `--json` stdout parseable.
 */
import { logger } from 'storybook/internal/node-logger';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';
import { writeFile } from 'node:fs/promises';

import { registerToolsPassthrough } from './register.ts';
import { runToolsCommand, type ToolsRunResult } from './run.ts';

vi.mock('./run.ts', { spy: true });
vi.mock('node:fs/promises', { spy: true });
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
  const success = (output: string): ToolsRunResult => ({
    exitCode: 0,
    output,
    outcome: { kind: 'success' },
  });

  beforeEach(() => {
    logger.setLogLevel('info');
    // `-o/--output` reaches the real `writeFile` otherwise, and these runs are about the log level.
    vi.mocked(writeFile).mockResolvedValue(undefined);
    vi.mocked(runToolsCommand).mockImplementation(async () => success('{"ok":true}'));
  });

  afterEach(() => {
    vi.clearAllMocks();
    logger.setLogLevel('info');
    exitSpy.mockClear();
  });

  describe('when the tool logs while a --json result is on its way to stdout', () => {
    beforeEach(() => {
      vi.mocked(runToolsCommand).mockImplementation(async () => {
        logger.warn('Multiple story files share the component id');
        return success('{"ok":true}');
      });
    });

    it('keeps stdout free of log output', async () => {
      const stdout = await runCli(['docs', 'show', '--json']);

      expect(() => JSON.parse(stdout)).not.toThrow();
      expect(stdout).not.toContain('Multiple story files');
    });
  });

  describe('when the run throws', () => {
    beforeEach(() => {
      vi.mocked(runToolsCommand).mockRejectedValue(new Error('boom'));
    });

    it('restores the log level anyway', async () => {
      await expect(runCli(['docs', 'show', '--json'])).rejects.toThrow(
        'unexpected command failure'
      );

      expect(logger.getLogLevel()).toBe('info');
    });
  });

  describe('when stdout is not a JSON document', () => {
    const levels: string[] = [];

    beforeEach(() => {
      levels.length = 0;
      vi.mocked(runToolsCommand).mockImplementation(async () => {
        levels.push(logger.getLogLevel());
        return success('markdown');
      });
    });

    it('leaves logging on without --json, and when the JSON goes to a file', async () => {
      await runCli(['docs', 'show']);
      await runCli(['docs', 'show', '--json', '--output', 'out.json']);

      expect(levels).toEqual(['info', 'info']);
    });

    it('leaves logging on for an incomplete command path, which lists tools as markdown', async () => {
      await runCli(['--json']);
      await runCli(['docs', '--json']);

      expect(levels).toEqual(['info', 'info']);
    });
  });
});
