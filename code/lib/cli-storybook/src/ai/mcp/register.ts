import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { optionalEnvToBoolean } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import type { Command } from 'commander';

import {
  type AiToolRunResult,
  buildStorybookCommandsHelp,
  runAiTool,
  runAiToolHelp,
} from './run-tool.ts';

/**
 * The `storybook ai <tool>` MCP passthrough is experimental (storybookjs/storybook#35124) and only
 * registered when this feature flag is set; without it, `storybook ai` exposes `setup` only.
 */
export function isAiCliFeatureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return optionalEnvToBoolean(env.STORYBOOK_FEATURE_AI_CLI) === true;
}

const CWD_DESCRIPTION =
  'Project directory of the target Storybook (defaults to the current working directory)';
const PORT_DESCRIPTION =
  'Port of the target Storybook, to address one specific instance when several run at the same cwd';

/**
 * Register the passthrough on the `ai` command: a generic `[command] [args...]` argument pair that
 * forwards any command to the running Storybook's server (MCP under the hood, but that is an
 * implementation detail — user-facing copy says "commands"). `passThroughOptions` hands every
 * token after the command name to the command untouched, which requires positional options on the
 * program.
 *
 * Commander's built-in (synchronous) help is replaced with our own `-h, --help` option so the help
 * output can include the commands fetched from the running Storybook.
 */
export function registerAiMcpPassthrough(program: Command, aiCommand: Command): void {
  program.enablePositionalOptions();

  aiCommand
    .helpOption(false)
    .usage('[options] [command] [args...]')
    .argument('[command]', 'A command provided by the running Storybook')
    .argument(
      '[args...]',
      'Command arguments as `--key value` flags; values are JSON-parsed when possible'
    )
    .option('--cwd <path>', CWD_DESCRIPTION)
    .option('--port <number>', PORT_DESCRIPTION)
    .option(
      '--json <object>',
      'Raw JSON object with the command arguments (escape hatch for complex values)'
    )
    .option('-h, --help', 'Show help, including the commands provided by the running Storybook')
    .passThroughOptions()
    .action(
      async (
        command: string | undefined,
        commandArgs: string[],
        options: { cwd?: string; port?: string; json?: string; output?: string; help?: boolean }
      ) => {
        const target = { cwd: options.cwd, port: options.port };
        if (options.help && command) {
          await printResult(await runAiToolHelp(command, target), options.output);
          return;
        }
        if (options.help || !command) {
          const commandsSection = await buildStorybookCommandsHelp(target);
          process.stdout.write(`${aiCommand.helpInformation()}\n${commandsSection}\n`);
          return;
        }
        const result = await runAiTool(command, commandArgs, { ...target, json: options.json });
        await printResult(result, options.output);
      }
    );
}

/** Print to stdout, or to the file given via the `ai` command's `-o, --output` option. */
async function printResult(
  { output, exitCode }: AiToolRunResult,
  outputPath: string | undefined
): Promise<void> {
  if (outputPath) {
    const resolvedPath = resolve(outputPath);
    await writeFile(resolvedPath, `${output}\n`, 'utf-8');
    logger.log(`Output written to ${resolvedPath}`);
  } else {
    process.stdout.write(`${output}\n`);
  }
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
