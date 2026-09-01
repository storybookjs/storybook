import { optionalEnvToBoolean } from 'storybook/internal/common';
import { withTelemetry } from 'storybook/internal/core-server';
import { telemetry } from 'storybook/internal/telemetry';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { registerSkillsCommand } from './register.ts';
import { runSkillsCommand } from './run.ts';

vi.mock('./run.ts', { spy: true });
vi.mock('storybook/internal/core-server', () => ({
  withTelemetry: vi.fn(async (_event, _options, run: () => Promise<unknown>) => run()),
  experimental_loadStorybook: vi.fn(),
}));
vi.mock('storybook/internal/telemetry', { spy: true });

function buildProgram() {
  const program = new Command();
  program.exitOverride();
  const handleCommandFailure = vi.fn(() => async (error: unknown): Promise<never> => {
    throw error;
  });

  const skillsCommand = program
    .command('skills')
    .description('Agent skills served by the target Storybook configuration')
    .option(
      '--disable-telemetry',
      'Disable sending telemetry data',
      optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY)
    )
    .option('--logfile [path]', 'Write all debug logs to the specified file')
    .exitOverride();
  skillsCommand.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerSkillsCommand(program, skillsCommand, handleCommandFailure);

  return { program };
}

function parse(program: Command, argv: string[]) {
  return program.parseAsync(['node', 'storybook', ...argv]);
}

beforeEach(() => {
  vi.mocked(runSkillsCommand).mockResolvedValue({
    output: 'ok',
    exitCode: 0,
    kind: 'get',
    skill: 'stories',
  });
  vi.mocked(withTelemetry).mockImplementation(async (_eventType, _options, run) => run());
  vi.mocked(telemetry).mockResolvedValue(undefined);
  vi.spyOn(process.stdout, 'write').mockImplementation((_chunk, ...args) => {
    const callback = args.find((arg) => typeof arg === 'function');
    callback?.();
    return true;
  });
  vi.spyOn(process.stderr, 'write').mockImplementation((_chunk, ...args) => {
    const callback = args.find((arg) => typeof arg === 'function');
    callback?.();
    return true;
  });
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(runSkillsCommand).mockReset();
  process.exitCode = undefined;
});

describe('registerSkillsCommand', () => {
  it('passes a bare skill id through as tokens', async () => {
    const { program } = buildProgram();
    await parse(program, ['skills', 'stories']);

    expect(vi.mocked(runSkillsCommand).mock.calls[0]?.[0]).toEqual({
      tokens: ['stories'],
      help: undefined,
      target: { cwd: undefined, configDir: undefined },
    });
  });

  it('keeps the `get <id>` spelling', async () => {
    const { program } = buildProgram();
    await parse(program, ['skills', 'get', 'setup']);

    expect(vi.mocked(runSkillsCommand).mock.calls[0]?.[0]).toMatchObject({
      tokens: ['get', 'setup'],
    });
  });

  it('does not intercept `help` as commander help', async () => {
    const { program } = buildProgram();
    await parse(program, ['skills', 'help', 'stories']);

    expect(vi.mocked(runSkillsCommand).mock.calls[0]?.[0]).toMatchObject({
      tokens: ['help', 'stories'],
    });
  });

  it('forwards `-h` after a skill id', async () => {
    vi.mocked(runSkillsCommand).mockResolvedValue({
      output: 'usage',
      exitCode: 0,
      kind: 'help',
      skill: 'write-story',
    });
    const { program } = buildProgram();
    await parse(program, ['skills', 'write-story', '-h']);

    expect(vi.mocked(runSkillsCommand).mock.calls[0]?.[0]).toMatchObject({
      tokens: ['write-story'],
      help: true,
    });
    expect(telemetry).not.toHaveBeenCalled();
  });
});
