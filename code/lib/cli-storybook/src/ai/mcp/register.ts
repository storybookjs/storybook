import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { optionalEnvToBoolean } from 'storybook/internal/common';
import { sendTelemetryError, withTelemetry } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import type { CLIOptions } from 'storybook/internal/types';

import type { Command } from 'commander';

import {
  type AiCommandOutcome,
  type AiToolRunResult,
  buildStorybookCommandsHelp,
  runAiTool,
  runAiToolHelp,
} from './run-tool.ts';
import { scanCwdToken } from './tool-args.ts';

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

type AiPassthroughOptions = {
  cwd?: string;
  port?: string;
  json?: string;
  output?: string;
  help?: boolean;
  /** From the shared command options in `bin/run.ts`; consumed by `withTelemetry`. */
  disableTelemetry?: boolean;
  /** From the shared command options in `bin/run.ts`; consumed by the failure handler. */
  logfile?: string | boolean;
};

/** `handleCommandFailure` from `bin/run.ts`, passed in to avoid an import cycle. */
export type CommandFailureHandler = (
  logFilePath: string | boolean | undefined
) => (error: unknown) => Promise<never>;

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
export function registerAiMcpPassthrough(
  program: Command,
  aiCommand: Command,
  handleCommandFailure: CommandFailureHandler
): void {
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
      async (command: string | undefined, commandArgs: string[], options: AiPassthroughOptions) => {
        const cliOptions = pickCliOptions(options, commandArgs);
        // Like `init`, the fallback keeps telemetry on when no main config is loadable: running
        // from a cwd without a Storybook is the `no-instance` intercept this event exists to
        // measure. The explicit opt-outs (env var, flag, loadable `core.disableTelemetry`)
        // still apply.
        return withTelemetry(
          'ai-command',
          { cliOptions, fallbackTelemetryState: true },
          async () => {
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
            const start = Date.now();
            const result = await runAiTool(command, commandArgs, { ...target, json: options.json });
            const duration = Date.now() - start;
            try {
              await printResult(result, options.output);
            } finally {
              // The command has executed either way, so a failed `--output` write must not lose
              // the event. Reporting after printing keeps a slow telemetry endpoint from ever
              // delaying the user's result.
              await reportAiCommandTelemetry(command, result.outcome, duration, cliOptions);
            }
          }
        ).catch(handleCommandFailure(options.logfile));
      }
    );
}

/**
 * The cliOptions handed to the telemetry machinery. Only the opt-out tier is forwarded — the
 * passthrough's own options (cwd, port, json) may contain paths and are never sent in payloads.
 * `configDir` points at the default config location of the *target* Storybook so `withTelemetry`
 * resolves `core.disableTelemetry` from the project the command is aimed at (`--cwd` is accepted
 * both before and after the command name, and is scanned leniently so even invocations rejected
 * as `invalid-arguments` honor the target's opt-out); it is read locally, never sent.
 */
function pickCliOptions(options: AiPassthroughOptions, commandArgs: string[]): CLIOptions {
  const targetCwd = scanCwdToken(commandArgs) ?? options.cwd ?? process.cwd();
  return {
    disableTelemetry: options.disableTelemetry,
    logfile: options.logfile,
    configDir: resolve(targetCwd, '.storybook'),
  };
}

/**
 * Command names are a fixed, server-defined vocabulary of short identifiers. Anything else is
 * arbitrary agent input (a typo'd path, a stray flag value) that must not be sent verbatim, so it
 * is collapsed to a placeholder. The intercept reason still tells the failure class apart.
 */
function sanitizeCommandName(command: string): string {
  return /^[\w-]{1,64}$/.test(command) ? command : '(invalid)';
}

/**
 * Fire the `ai-command` event, once per executed command (storybookjs/storybook#35131). Help
 * lookups are excluded so they cannot skew command success rates. Server-side failures
 * additionally go through the standard sanitized error path, like errors thrown under
 * `withTelemetry`.
 */
async function reportAiCommandTelemetry(
  command: string,
  outcome: AiCommandOutcome,
  duration: number,
  cliOptions: CLIOptions
): Promise<void> {
  if (outcome.kind === 'help') {
    return;
  }
  await telemetry(
    'ai-command',
    {
      command: sanitizeCommandName(command),
      success: outcome.kind === 'success',
      ...(outcome.kind === 'intercept' && { interceptReason: outcome.reason }),
      duration,
    },
    // Metadata must describe the target project, consistent with the opt-out resolution.
    { configDir: cliOptions.configDir }
  );
  if (outcome.kind === 'error') {
    await sendTelemetryError(outcome.error, 'ai-command', { cliOptions });
  }
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
