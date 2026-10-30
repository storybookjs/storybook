import { withTelemetry } from 'storybook/internal/server';
import { telemetry } from '@storybook/core/internal/telemetry';
import type { CLIOptions } from '@storybook/core/internal/types';

import { getService } from '@storybook/core/internal/deep/shared/open-service/server';
import { getRegisteredToolsets } from '@storybook/core/open-service';
import { createStorybook, runWithStorybook, type Storybook } from 'storybook/internal/instance';
import { resolveStorybookConfigDir, toCatalogEntry } from '@storybook/open-service/internal';
import type { CommandFailureHandler } from '../tools/register.ts';
import { getSetupMarkdownOutput } from './content/setup-prompts/index.ts';
import { resolveSkillInputs } from './inputs.ts';
import { getProjectInfo } from './project-info.ts';
import { recordSetupRun } from './record-setup-run.ts';
import {
  resolveSkillsIntent,
  runSkillsCommand,
  type SkillsRunDeps,
  type SkillsRunResult,
} from './run.ts';

export type SkillsCommandOptions = {
  cwd?: string;
  configDir?: string;
  help?: boolean;
  all?: boolean;
  /** From the shared command options in `bin/core.ts`; consumed by `withTelemetry`. */
  disableTelemetry?: boolean;
  /** From the shared command options in `bin/core.ts`; consumed by the failure handler. */
  logfile?: string | boolean;
};

/** The body of `storybook skills`, imported only when the command runs. */
export async function runSkillsAction(
  tokens: string[],
  options: SkillsCommandOptions,
  handleCommandFailure: CommandFailureHandler
): Promise<void> {
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
  const run = async (): Promise<void> => {
    const result = await runSkillsCommand(invocation, defaultDeps());
    await printResult(result);
    if (result.setupRun) {
      await recordSetupRun(result.setupRun);
    }
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
  // behind that natural drain cannot clear (mirrors `cli/tools/action.ts`).
  process.exit();
}

function defaultDeps(): SkillsRunDeps {
  let storybook: Storybook | undefined;
  // Services and toolsets live in the loaded instance, so read them inside its context.
  const inStorybook = <T>(fn: () => T): T => (storybook ? runWithStorybook(storybook, fn) : fn());
  return {
    async loadStorybook({ configDir }) {
      const instance = createStorybook({ configDir, mode: 'headless' });
      await instance.ready();
      storybook = instance;
      return instance;
    },
    resolveSkillInputs: (instance) => inStorybook(() => resolveSkillInputs(instance)),
    getProjectInfo,
    getSetupMarkdown: getSetupMarkdownOutput,
    describeToolsets: () =>
      inStorybook(() =>
        getRegisteredToolsets().map((toolset) =>
          toCatalogEntry(toolset, {
            transport: 'cli',
            getService: (serviceId, options) =>
              inStorybook(() => getService(serviceId as never, options)),
          })
        )
      ),
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
