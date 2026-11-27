import { once } from 'storybook/internal/node-logger';

import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dev } from '../cli/dev.ts';
import { registerDevCommand } from './dev-command.ts';

const { warnCalls } = vi.hoisted(() => ({ warnCalls: [] as string[] }));

// A self-contained node-logger stand-in (a real `logger` + warn-once `deprecate`), so the test and
// the command under test share one consistent module instance.
vi.mock('storybook/internal/node-logger', () => {
  const logged = new Set<string>();
  const warn = (message: string) => {
    warnCalls.push(message);
  };
  const once = (log: (message: string) => void) => (message: string) => {
    if (logged.has(message)) {
      return undefined;
    }
    logged.add(message);
    return log(message);
  };
  return {
    logger: {
      warn,
      error: vi.fn(),
      log: vi.fn(),
      intro: vi.fn(),
      outro: vi.fn(),
      setLogLevel: vi.fn(),
      setLevel: vi.fn(),
    },
    once: Object.assign(
      once(() => {}),
      { clear: () => logged.clear() }
    ),
    deprecate: once(warn),
  };
});

vi.mock('../cli/dev.ts', () => ({ dev: vi.fn(async () => {}) }));

/**
 * Builds the real `dev` command on a fresh in-process Commander program (core.ts parses
 * `process.argv` at import time, so the tests cannot import it directly).
 */
const buildProgram = () => {
  const out: string[] = [];
  const err: string[] = [];
  const program = new Command();
  program.exitOverride();
  program.configureOutput({
    writeOut: (str) => {
      out.push(str);
    },
    writeErr: (str) => {
      err.push(str);
    },
  });
  const handleCommandFailure = vi.fn(async (): Promise<never> => {
    throw new Error('handleCommandFailure should not be called');
  });
  registerDevCommand((name) => program.command(name), handleCommandFailure);
  return { program, out, err, handleCommandFailure };
};

const parseDev = async (argv: string[]) => {
  // The removal warning is detected in the raw process.argv (the resolved `open` option cannot
  // distinguish `--no-open` from the default), so mirror the production invocation there.
  process.argv = ['node', 'storybook', 'dev', ...argv];
  const { program, ...rest } = buildProgram();
  await program.parseAsync(['node', 'storybook', 'dev', ...argv]);
  return rest;
};

const getResolvedOptions = () => vi.mocked(dev).mock.calls.at(-1)?.[0];

describe('dev command', () => {
  const realArgv = process.argv;

  beforeEach(() => {
    once.clear();
    warnCalls.length = 0;
    vi.mocked(dev).mockClear();
  });

  afterEach(() => {
    process.argv = realArgv;
  });

  it('accepts the removed --no-open flag without a parse error and resolves open: false', async () => {
    const { err, handleCommandFailure } = await parseDev(['--no-open']);

    expect(err).toEqual([]);
    expect(handleCommandFailure).not.toHaveBeenCalled();
    expect(getResolvedOptions()?.open).toBe(false);
  });

  it('warns exactly once about the removal', async () => {
    await parseDev(['--no-open']);

    expect(warnCalls).toHaveLength(1);
    expect(warnCalls[0]).toMatch(/--no-open/);
    expect(warnCalls[0]).toMatch(/--open/);

    // A second invocation in the same process does not repeat the warning.
    await parseDev(['--no-open']);
    expect(warnCalls).toHaveLength(1);
  });

  it('resolves open: false when --open and --no-open are both passed (last wins)', async () => {
    const { err } = await parseDev(['--open', '--no-open']);

    expect(err).toEqual([]);
    expect(getResolvedOptions()?.open).toBe(false);
    expect(warnCalls).toHaveLength(1);
  });

  it('still parses when --no-open comes after other arguments', async () => {
    const { err } = await parseDev(['-p', '6006', '--no-open']);

    expect(err).toEqual([]);
    expect(getResolvedOptions()?.open).toBe(false);
    expect(getResolvedOptions()?.port).toBe(6006);
  });

  it('does not warn and keeps opt-in --open behavior when the flag is not passed', async () => {
    await parseDev([]);
    expect(warnCalls).toEqual([]);
    expect(getResolvedOptions()?.open).toBe(false);

    await parseDev(['--open']);
    expect(warnCalls).toEqual([]);
    expect(getResolvedOptions()?.open).toBe(true);
  });
});
