import { logTracker, logger, type LogLevel } from 'storybook/internal/node-logger';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { globalSettings, Settings } from '../cli/globalSettings.ts';
import {
  addSharedCliOptions,
  defaultLogLevelForCommand,
  writeCommandFailureDiagnostics,
} from './cli-command.ts';

vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('../cli/globalSettings.ts', { spy: true });

const parse = (program: Command, argv: string[]) =>
  program.parseAsync(['node', 'storybook', ...argv]);

function buildProgram(name: string, defaultLogLevel?: LogLevel) {
  const program = new Command();
  program.exitOverride();
  const action = vi.fn();
  addSharedCliOptions(
    program.command(name),
    defaultLogLevel ?? defaultLogLevelForCommand(name)
  ).action(action);
  return { program, action };
}

describe('defaultLogLevelForCommand', () => {
  it('defaults ai, tools, and skills to silent, and every other command to info', () => {
    expect(defaultLogLevelForCommand('ai')).toBe('silent');
    expect(defaultLogLevelForCommand('tools')).toBe('silent');
    expect(defaultLogLevelForCommand('skills')).toBe('silent');
    expect(defaultLogLevelForCommand('dev')).toBe('info');
    expect(defaultLogLevelForCommand('build')).toBe('info');
    expect(defaultLogLevelForCommand('index')).toBe('info');
  });
});

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

  it.each(['ai', 'tools', 'skills'] as const)(
    'defaults the registered %s command to silent so logger chatter stays off',
    async (name) => {
      const { program, action } = buildProgram(name);

      await parse(program, [name]);

      expect(action).toHaveBeenCalledOnce();
      expect(logger.setLogLevel).toHaveBeenCalledWith('silent');
    }
  );

  it('keeps human-facing commands at info when no log flags are passed', async () => {
    const { program } = buildProgram('dev');

    await parse(program, ['dev']);

    expect(logger.setLogLevel).toHaveBeenCalledWith('info');
  });

  it('lets --loglevel override the silent default', async () => {
    const { program } = buildProgram('tools');

    await parse(program, ['tools', '--loglevel', 'warn']);

    expect(logger.setLogLevel).toHaveBeenCalledWith('warn');
  });

  it('lets --debug override both the silent default and --loglevel', async () => {
    const { program } = buildProgram('ai');

    await parse(program, ['ai', '--loglevel', 'error', '--debug']);

    expect(logger.setLogLevel).toHaveBeenCalledWith('debug');
  });

  it('applies the parent default when an agent subcommand runs', async () => {
    const program = new Command();
    program.exitOverride();
    const action = vi.fn();
    const ai = addSharedCliOptions(program.command('ai'), defaultLogLevelForCommand('ai'));
    ai.command('setup').action(action);

    await parse(program, ['ai', 'setup']);

    expect(action).toHaveBeenCalledOnce();
    expect(logger.setLogLevel).toHaveBeenCalledWith('silent');
  });
});

describe('writeCommandFailureDiagnostics', () => {
  beforeEach(() => {
    vi.mocked(logger.diagnostic).mockImplementation(() => {});
    vi.mocked(logTracker.writeToFile).mockResolvedValue('/tmp/debug-storybook.log');
  });

  afterEach(() => {
    vi.mocked(logger.diagnostic).mockReset();
    vi.mocked(logTracker.writeToFile).mockReset();
  });

  it('writes the logfile location and exit notice through the diagnostic channel', async () => {
    await writeCommandFailureDiagnostics(true);

    expect(logger.diagnostic).toHaveBeenCalledWith(
      'Debug logs are written to: /tmp/debug-storybook.log'
    );
    expect(logger.diagnostic).toHaveBeenCalledWith('Storybook exited with an error');
  });

  it('still writes the exit notice when the logfile cannot be written', async () => {
    vi.mocked(logTracker.writeToFile).mockRejectedValue(new Error('EACCES'));

    await writeCommandFailureDiagnostics(true);

    expect(logger.diagnostic).toHaveBeenCalledOnce();
    expect(logger.diagnostic).toHaveBeenCalledWith('Storybook exited with an error');
  });
});
