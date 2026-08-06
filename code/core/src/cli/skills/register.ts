import { experimental_loadStorybook, withTelemetry } from 'storybook/internal/core-server';
import { telemetry } from 'storybook/internal/telemetry';
import type { CLIOptions } from 'storybook/internal/types';

import type { Command } from 'commander';

import { resolveStorybookConfigDir } from '../tools/config-dir.ts';
import type { CommandFailureHandler } from '../tools/register.ts';
import { getSetupMarkdownOutput } from './content/setup-prompts/index.ts';
import { resolveSkillInputs } from './inputs.ts';
import { getProjectInfo } from './project-info.ts';
import { runSkillsCommand, type SkillsRunDeps, type SkillsRunResult } from './run.ts';

type SkillsGetOptions = {
  cwd?: string;
  configDir?: string;
  /** From the shared command options in `bin/core.ts`; consumed by `withTelemetry`. */
  disableTelemetry?: boolean;
  /** From the shared command options in `bin/core.ts`; consumed by the failure handler. */
  logfile?: string | boolean;
};

/**
 * Register `storybook skills [list]` and `storybook skills get <id>`: agent-facing instruction
 * documents served by the target Storybook configuration (storybookjs/storybook#35526). Unlike
 * `storybook tools`, there is no passthrough — just a static list and a single-id lookup — so this
 * mirrors `cli/tools/register.ts` without its positional-argument plumbing.
 */
export function registerSkillsCommand(
  program: Command,
  skillsCommand: Command,
  handleCommandFailure: CommandFailureHandler
): void {
  skillsCommand
    .command('list', { isDefault: true })
    .description('List the skills served by this Storybook')
    .action(async () => {
      const result = await runSkillsCommand({ subcommand: 'list', target: {} }, defaultDeps());
      await printResult(result);
    });

  skillsCommand
    .command('get')
    .description("Print a skill's full instructions as markdown")
    .argument('[id]', 'One of the skills from `storybook skills list`')
    .option('--cwd <dir>', 'Project directory of the target Storybook')
    .option('-c, --config-dir <dir-name>', 'Storybook config directory of the target Storybook')
    .action(async (id: string | undefined, options: SkillsGetOptions, cmd: Command) => {
      const parentOptions = (cmd.parent?.opts() ?? {}) as SkillsGetOptions;
      const merged = { ...parentOptions, ...options };
      const cliOptions: CLIOptions = {
        disableTelemetry: merged.disableTelemetry,
        logfile: merged.logfile,
        configDir: resolveStorybookConfigDir({ cwd: merged.cwd, configDir: merged.configDir }),
      };
      await withTelemetry('skills-get', { cliOptions, fallbackTelemetryState: true }, async () => {
        const result = await runSkillsCommand(
          { subcommand: 'get', id, target: { cwd: merged.cwd, configDir: merged.configDir } },
          defaultDeps()
        );
        await printResult(result);
        if (result.skill && result.exitCode === 0) {
          await telemetry(
            'skills-get',
            { skill: result.skill },
            { configDir: cliOptions.configDir }
          );
        }
      }).catch(handleCommandFailure(merged.logfile));
      // Exit explicitly: loading the target Storybook configuration may leave live handles
      // behind that natural drain cannot clear (mirrors `cli/tools/register.ts`'s `get` action).
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

/** Print to stdout/stderr, awaiting the flush before the caller exits. */
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
