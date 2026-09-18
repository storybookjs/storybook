import { experimental_loadStorybook, withTelemetry } from 'storybook/internal/core-server';
import { telemetry } from 'storybook/internal/telemetry';
import type { CLIOptions } from 'storybook/internal/types';

import type { Command } from 'commander';

import { resolveStorybookConfigDir } from '../tools/config-dir.ts';
import type { CommandFailureHandler } from '../tools/register.ts';
import { getSetupMarkdownOutput } from './content/setup-prompts/index.ts';
import { resolveSkillInputs } from './inputs.ts';
import { getProjectInfo } from './project-info.ts';
import {
  SKILLS_OPTION_SPECS,
  resolveSkillsIntent,
  runSkillsCommand,
  type SkillsRunDeps,
  type SkillsRunResult,
} from './run.ts';

type SkillsCommandOptions = {
  cwd?: string;
  configDir?: string;
  help?: boolean;
  all?: boolean;
  /** From the shared command options in `bin/core.ts`; consumed by `withTelemetry`. */
  disableTelemetry?: boolean;
  /** From the shared command options in `bin/core.ts`; consumed by the failure handler. */
  logfile?: string | boolean;
};

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

  skillsCommand.action(async (tokens: string[], options: SkillsCommandOptions) => {
    const cliOptions: CLIOptions = {
      disableTelemetry: options.disableTelemetry,
      logfile: options.logfile,
      configDir: resolveStorybookConfigDir({ cwd: options.cwd, configDir: options.configDir }),
    };
    const invocation = {
      tokens: tokens ?? [],
      help: options.help,
      all: options.all,
      target: { cwd: options.cwd, configDir: options.configDir },
    };
    const intent = resolveSkillsIntent(invocation);
    const run = async () => {
      const result = await runSkillsCommand(invocation, defaultDeps());
      await printResult(result);
      if (result.skill) {
        await telemetry('skills-get', { skill: result.skill }, { configDir: cliOptions.configDir });
      }
    };
    if (intent.kind === 'catalog') {
      await run();
    } else {
      await withTelemetry('skills-get', { cliOptions, fallbackTelemetryState: true }, run).catch(
        handleCommandFailure(options.logfile)
      );
    }
    // Exit explicitly: loading the target Storybook configuration may leave live handles
    // behind that natural drain cannot clear (mirrors `cli/tools/register.ts`).
    process.exit();
  });
}

function defaultDeps(): SkillsRunDeps {
  return {
    loadStorybook: experimental_loadStorybook,
    resolveSkillInputs,
    getProjectInfo,
    getSetupMarkdown: getSetupMarkdownOutput,
  };
}

async function printResult(result: SkillsRunResult): Promise<void> {
  if (result.errorOutput) {
    await new Promise<void>((done) =>
      process.stderr.write(`${result.errorOutput}\n`, () => done())
    );
  }
  if (result.output) {
    await new Promise<void>((done) => process.stdout.write(`${result.output}\n`, () => done()));
  }
  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }
}
