import { optionalEnvToBoolean } from 'storybook/internal/common';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Command } from 'commander';

import { registerSkillsCommand } from './register.ts';
import { runSkillsCommand } from './run.ts';

vi.mock('./run.ts', { spy: true });

function buildProgram() {
  const program = new Command();
  program.exitOverride();
  const skillsCommand = program
    .command('skills')
    .description('Agent skills served by the target Storybook configuration')
    .option(
      '--disable-telemetry',
      'Disable sending telemetry data',
      optionalEnvToBoolean(process.env.STORYBOOK_DISABLE_TELEMETRY)
    )
    .exitOverride();
  skillsCommand.configureOutput({ writeOut: () => {}, writeErr: () => {} });
  registerSkillsCommand(program, skillsCommand, () => async (error: unknown): Promise<never> => {
    throw error;
  });
  return program;
}

beforeEach(() => {
  vi.mocked(runSkillsCommand).mockResolvedValue({ output: 'ok', exitCode: 0 });
  vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(runSkillsCommand).mockReset();
});

describe('registerSkillsCommand', () => {
  it('does not treat `help` as Commander help', async () => {
    const program = buildProgram();
    await expect(
      program.parseAsync(['node', 'storybook', 'skills', 'help', 'stories'])
    ).rejects.toThrow(/too many arguments for 'list'/i);
    expect(runSkillsCommand).not.toHaveBeenCalled();
  });
});
