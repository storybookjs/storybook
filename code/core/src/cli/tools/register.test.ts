/**
 * The stream contract of the commander wiring: with `--json`, stdout carries only the printed
 * result — writes during telemetry resolution, the command body, and the telemetry report all
 * land on stderr — and the original writer is restored afterwards, also when the run fails.
 * Everything behind the wiring is covered by `run.test.ts`.
 */

import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

import { withTelemetry } from 'storybook/internal/core-server';

import { Command } from 'commander';

import { registerToolsPassthrough } from './register.ts';
import { runToolsCommand } from './run.ts';

vi.mock('storybook/internal/core-server', () => ({
  // Stands in for `resolveTelemetryState`, which evaluates the project's `main.ts` — the
  // pre-body window where user config code can write to stdout.
  withTelemetry: vi.fn(async (_event, _options, run: () => Promise<unknown>) => {
    process.stdout.write('noise during telemetry resolution\n');
    return run();
  }),
  sendTelemetryError: vi.fn(),
}));

vi.mock('storybook/internal/telemetry', () => ({
  // Stands in for the report that runs after the result is printed — the post-print window.
  telemetry: vi.fn(async () => {
    process.stdout.write('noise after the result\n');
  }),
}));

vi.mock('storybook/internal/node-logger', () => ({
  logger: { log: vi.fn(), debug: vi.fn() },
}));

vi.mock('./run.ts', () => ({ runToolsCommand: vi.fn() }));

function makeProgram() {
  const program = new Command();
  const toolsCommand = program.command('tools');
  registerToolsPassthrough(program, toolsCommand, () => async (error: unknown) => {
    throw error;
  });
  return program;
}

let stdoutSpy: MockInstance<typeof process.stdout.write>;
let stderrSpy: MockInstance<typeof process.stderr.write>;

beforeEach(() => {
  vi.restoreAllMocks();
  stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation((_chunk, ...args) => {
    const callback = args.find((arg) => typeof arg === 'function');
    callback?.();
    return true;
  });
  stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  vi.mocked(runToolsCommand).mockImplementation(async () => {
    process.stdout.write('noise during the run\n');
    return { exitCode: 0, output: '{"ok":true}', outcome: { kind: 'success' }, attachMode: 'auto' };
  });
});

describe('the --json stream contract', () => {
  it('prints only the result on stdout; every mid-command write lands on stderr', async () => {
    const originalWrite = process.stdout.write;

    await makeProgram().parseAsync(['tools', 'docs', 'list', '--json'], { from: 'user' });

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(stdoutSpy.mock.calls[0][0]).toBe('{"ok":true}\n');
    const stderrText = stderrSpy.mock.calls.map(([chunk]) => chunk).join('');
    expect(stderrText).toContain('noise during telemetry resolution');
    expect(stderrText).toContain('noise during the run');
    expect(stderrText).toContain('noise after the result');
    expect(process.stdout.write).toBe(originalWrite);
  });

  it('restores stdout when the command fails', async () => {
    const originalWrite = process.stdout.write;
    vi.mocked(withTelemetry).mockRejectedValueOnce(new Error('boom'));

    await expect(
      makeProgram().parseAsync(['tools', 'docs', 'list', '--json'], { from: 'user' })
    ).rejects.toThrow('boom');

    expect(process.stdout.write).toBe(originalWrite);
  });

  it('leaves stdout alone without --json', async () => {
    vi.mocked(runToolsCommand).mockImplementation(async () => {
      process.stdout.write('noise during the run\n');
      return {
        exitCode: 0,
        output: 'markdown result',
        outcome: { kind: 'success' },
        attachMode: 'auto',
      };
    });

    await makeProgram().parseAsync(['tools', 'docs', 'list'], { from: 'user' });

    const stdoutText = stdoutSpy.mock.calls.map(([chunk]) => chunk).join('');
    expect(stdoutText).toContain('noise during the run');
    expect(stdoutText).toContain('markdown result\n');
    expect(stderrSpy).not.toHaveBeenCalled();
  });
});
