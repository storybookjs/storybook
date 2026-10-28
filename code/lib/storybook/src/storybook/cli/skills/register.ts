import type { Command } from 'commander';

import type { CommandFailureHandler } from '../tools/register.ts';
import type { SkillsCommandOptions } from './action.ts';
import { SKILLS_OPTION_SPECS } from './run.ts';

/**
 * Register `storybook skills`. The action is imported when it runs, so registering the command
 * loads no server or instance code.
 */
export function registerSkillsCommand(
  program: Command,
  skillsCommand: Command,
  handleCommandFailure: CommandFailureHandler
): void {
  program.enablePositionalOptions();

  skillsCommand
    .helpOption(false)
    .helpCommand(false)
    .usage('[options] [id]')
    .argument('[tokens...]', 'A skill id from `storybook skills --help`');

  for (const { flags, description } of SKILLS_OPTION_SPECS) {
    skillsCommand.option(flags, description);
  }

  skillsCommand.action(async (tokens: string[], options: SkillsCommandOptions): Promise<void> => {
    const { runSkillsAction } = await import('./action.ts');
    await runSkillsAction(tokens, options, handleCommandFailure);
  });
}
