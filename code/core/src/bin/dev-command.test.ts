import { deprecate, logger, once } from 'storybook/internal/node-logger';

import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { dev } from '../cli/dev.ts';
import { registerDevCommand } from './dev-command.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../cli/dev.ts', { spy: true });

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

const warnedMessages = () => vi.mocked(logger.warn).mock.calls.map(([message]) => message);

describe('dev command', () => {
  const realArgv = process.argv;

  beforeEach(() => {
    once.clear();
    vi.mocked(dev).mockClear();
    vi.mocked(dev).mockImplementation(async () => {});
    vi.mocked(logger.warn).mockClear();
    vi.mocked(deprecate).mockClear();
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

    expect(vi.mocked(deprecate).mock.calls).toHaveLength(1);
    expect(warnedMessages()).toHaveLength(1);
    expect(warnedMessages()[0]).toMatch(/--no-open/);
    expect(warnedMessages()[0]).toMatch(/--open/);

    // A second invocation in the same process does not repeat the warning.
    await parseDev(['--no-open']);
    expect(warnedMessages()).toHaveLength(1);
  });

  it('resolves open: false when --open and --no-open are both passed (last wins)', async () => {
    const { err } = await parseDev(['--open', '--no-open']);

    expect(err).toEqual([]);
    expect(getResolvedOptions()?.open).toBe(false);
    expect(warnedMessages()).toHaveLength(1);
  });

  it('still parses when --no-open comes after other arguments', async () => {
    const { err } = await parseDev(['-p', '6006', '--no-open']);

    expect(err).toEqual([]);
    expect(getResolvedOptions()?.open).toBe(false);
    expect(getResolvedOptions()?.port).toBe(6006);
  });

  it('does not warn and keeps opt-in --open behavior when the flag is not passed', async () => {
    await parseDev([]);
    expect(warnedMessages()).toEqual([]);
    expect(getResolvedOptions()?.open).toBe(false);

    await parseDev(['--open']);
    expect(warnedMessages()).toEqual([]);
    expect(getResolvedOptions()?.open).toBe(true);
  });
});
