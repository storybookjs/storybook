import { optionalEnvToBoolean } from 'storybook/internal/common';

import type { Command } from 'commander';

import { type AiToolRunResult, runAiListTools, runAiTool } from './run-tool.ts';

/**
 * The `storybook ai <tool>` MCP passthrough is experimental (storybookjs/storybook#35124) and only
 * registered when this feature flag is set; without it, `storybook ai` exposes `setup` only.
 */
export function isAiCliFeatureEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return optionalEnvToBoolean(env.STORYBOOK_FEATURE_AI_CLI) === true;
}

const CWD_DESCRIPTION =
  'Project directory of the target Storybook (defaults to the current working directory)';

/**
 * Register the MCP passthrough on the `ai` command: a `list-tools` subcommand plus a generic
 * `[tool] [toolArgs...]` argument pair that forwards any tool call to the running Storybook's MCP
 * server. `passThroughOptions` hands every token after the tool name to the tool untouched, which
 * requires positional options on the program.
 */
export function registerAiMcpPassthrough(program: Command, aiCommand: Command): void {
  program.enablePositionalOptions();

  aiCommand
    .command('list-tools')
    .description('List the MCP tools exposed by the running Storybook')
    .option('--cwd <path>', CWD_DESCRIPTION)
    .action(async (options: { cwd?: string }) => {
      printResult(await runAiListTools({ cwd: options.cwd }));
    });

  aiCommand
    .argument('[tool]', 'Name of an MCP tool exposed by the running Storybook')
    .argument(
      '[toolArgs...]',
      'Tool arguments as `--key value` flags; values are JSON-parsed when possible'
    )
    .option('--cwd <path>', CWD_DESCRIPTION)
    .option(
      '--json <object>',
      'Raw JSON object with the tool arguments (escape hatch for complex values)'
    )
    .passThroughOptions()
    .action(
      async (
        tool: string | undefined,
        toolArgs: string[],
        options: { cwd?: string; json?: string }
      ) => {
        if (!tool) {
          aiCommand.outputHelp();
          return;
        }
        printResult(await runAiTool(tool, toolArgs, { cwd: options.cwd, json: options.json }));
      }
    );
}

function printResult({ output, exitCode }: AiToolRunResult): void {
  process.stdout.write(`${output}\n`);
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
