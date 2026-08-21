import { logger, type LogLevel } from 'storybook/internal/node-logger';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { globalSettings, Settings } from '../cli/globalSettings.ts';
import { addSharedCliOptions } from './cli-command.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../cli/globalSettings.ts', { spy: true });

const parse = (program: Command, argv: string[]) =>
  program.parseAsync(['node', 'storybook', ...argv]);

function buildProgram(name: string, defaultLogLevel: LogLevel) {
  const program = new Command();
  program.exitOverride();
  const action = vi.fn();
  addSharedCliOptions(program.command(name), defaultLogLevel).action(action);
  return { program, action };
}

describe('addSharedCliOptions log level', () => {
  beforeEach(() => {
    vi.mocked(logger.setLogLevel).mockImplementation(() => {});
    vi.mocked(globalSettings).mockResolvedValue(
      new Settings('/unused-settings.json', { version: 1 })
    );
  });

  afterEach(() => {
    vi.mocked(logger.setLogLevel).mockReset();
    vi.mocked(globalSettings).mockReset();
  });

  it('defaults agent commands to silent so logger output stays off', async () => {
    const { program, action } = buildProgram('tools', 'silent');

    await parse(program, ['tools']);

    expect(action).toHaveBeenCalledOnce();
    expect(logger.setLogLevel).toHaveBeenCalledWith('silent');
  });

  it('keeps human-facing commands at info when no log flags are passed', async () => {
    const { program } = buildProgram('dev', 'info');

    await parse(program, ['dev']);

    expect(logger.setLogLevel).toHaveBeenCalledWith('info');
  });

  it('lets --loglevel override the silent default', async () => {
    const { program } = buildProgram('tools', 'silent');

    await parse(program, ['tools', '--loglevel', 'warn']);

    expect(logger.setLogLevel).toHaveBeenCalledWith('warn');
  });

  it('lets --debug override both the silent default and --loglevel', async () => {
    const { program } = buildProgram('ai', 'silent');

    await parse(program, ['ai', '--loglevel', 'error', '--debug']);

    expect(logger.setLogLevel).toHaveBeenCalledWith('debug');
  });

  it('applies the parent default when an agent subcommand runs', async () => {
    const program = new Command();
    program.exitOverride();
    const action = vi.fn();
    const ai = addSharedCliOptions(program.command('ai'), 'silent');
    ai.command('setup').action(action);

    await parse(program, ['ai', 'setup']);

    expect(action).toHaveBeenCalledOnce();
    expect(logger.setLogLevel).toHaveBeenCalledWith('silent');
  });
});
