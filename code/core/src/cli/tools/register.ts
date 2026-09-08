import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { sendTelemetryError, withTelemetry } from 'storybook/internal/core-server';
import { logger } from 'storybook/internal/node-logger';
import { telemetry } from 'storybook/internal/telemetry';
import type { CLIOptions } from 'storybook/internal/types';

import { Option, type Command } from 'commander';

import type { ToolsetTelemetry } from '../../shared/open-service/toolset-definition.ts';
import { resolveStorybookConfigDir } from './config-dir.ts';
import { runToolsCommand, type ToolsRunResult } from './run.ts';
import { isJsonToolsRun, TOOLS_OPTION_SPECS, type ToolsOutputFlags } from './tool-tokens.ts';

/** `handleCommandFailure` from `bin/core.ts`, passed in to avoid an import cycle. */
export type CommandFailureHandler = (
  logFilePath: string | boolean | undefined
) => (error: unknown) => Promise<never>;

type ToolsPassthroughOptions = ToolsOutputFlags & {
  cwd?: string;
  configDir?: string;
  port?: string;
  attach?: boolean;
  noAttach?: boolean;
  /** From the shared command options in `bin/core.ts`; consumed by `withTelemetry`. */
  disableTelemetry?: boolean;
  /** From the shared command options in `bin/core.ts`; consumed by the failure handler. */
  logfile?: string | boolean;
};

/**
 * Register the `storybook tools` passthrough: a generic `[toolset] [tool] [args...]` argument
 * triple that runs the toolsets registered by the target Storybook configuration. Attach is the
 * default when a matching instance is running; `--no-attach` forces a local host.
 * `passThroughOptions` hands every token after the tool name to the tool untouched, which requires
 * positional options on the program.
 *
 * Commander's built-in (synchronous) help is replaced with our own `-h, --help` option so the help
 * output can be derived from the toolsets the target project registers. Target-selection options
 * (`--cwd`, `--config-dir`) belong before the toolset name; the output flags (`--json`,
 * `--input`, `--output`, `--help`) are accepted on both sides of it.
 */
export function registerToolsPassthrough(
  program: Command,
  toolsCommand: Command,
  handleCommandFailure: CommandFailureHandler
): void {
  program.enablePositionalOptions();

  toolsCommand
    .helpOption(false)
    .usage('[options] [toolset] [tool] [args...]')
    .argument('[toolset]', 'A toolset provided by the target Storybook configuration')
    .argument('[tool]', "One of the toolset's tools, e.g. `stories find-by-component`")
    .argument(
      '[args...]',
      'Tool arguments as `--key value` flags; values are JSON-parsed when possible'
    );

  for (const { flags, description } of TOOLS_OPTION_SPECS) {
    if (flags === '--no-attach') {
      const option = new Option(flags, description);
      // Commander treats `--no-*` as the negation of `--*`, which would default `--attach` to true.
      option.negate = false;
      toolsCommand.addOption(option);
      continue;
    }
    toolsCommand.option(flags, description);
  }

  toolsCommand
    .passThroughOptions()
    .action(
      async (
        toolset: string | undefined,
        tool: string | undefined,
        tokens: string[],
        options: ToolsPassthroughOptions
      ) => {
        const cliOptions = pickCliOptions(options);
        const flags: ToolsOutputFlags = {
          input: options.input,
          json: options.json,
          output: options.output,
          help: options.help,
          attach: options.noAttach ? false : options.attach,
        };
        // `--json` promises a parseable stdout, but writers this realm does not own print to it:
        // `withTelemetry` evaluates the project's `main.ts` to resolve the telemetry opt-out
        // before the command body runs (and the module cache means import-time logging fires only
        // in that first load), config loading and the tool log through clack-backed node-logger
        // and vite, and the telemetry report after the result can log as well. Divert every
        // stdout write to stderr for the whole command; `printResult` writes the result through
        // the saved writer.
        const originalStdoutWrite = process.stdout.write;
        if (isJsonToolsRun(tokens, flags)) {
          // Bound, not assigned: both streams share the inherited `Writable.prototype.write`,
          // which dispatches on `this` — unbound it would keep writing to stdout.
          process.stdout.write = process.stderr.write.bind(
            process.stderr
          ) as typeof process.stdout.write;
        }
        try {
          // Like `init`, the fallback keeps telemetry on when no main config is loadable: running
          // from a cwd without a Storybook is a failure this event exists to measure. The explicit
          // opt-outs (env var, flag, loadable `core.disableTelemetry`) still apply.
          await withTelemetry(
            'tools-command',
            { cliOptions, fallbackTelemetryState: true },
            async () => {
              // The dev server's listening socket keeps its event loop alive; this realm has no
              // server, and some of the async work the toolsets await (native parser/resolver calls
              // in the module-graph engine) holds no libuv handle while in flight. Without a
              // keep-alive the loop can drain mid-await and Node exits silently with code 0.
              const keepAlive = setInterval(() => {}, 60_000);
              const start = Date.now();
              let result: ToolsRunResult;
              try {
                if (options.attach && options.noAttach) {
                  result = {
                    exitCode: 1,
                    output: 'Cannot combine `--attach` and `--no-attach`.',
                    outcome: { kind: 'intercept', reason: 'invalid-arguments' },
                    requestedMode: 'auto',
                    attachMode: 'auto',
                  };
                } else {
                  result = await runToolsCommand(
                    {
                      toolset,
                      tool,
                      tokens,
                      target: { cwd: options.cwd, configDir: options.configDir },
                      port: options.port,
                      attach: options.noAttach ? false : options.attach,
                      flags,
                    },
                    { methodTelemetry: createMethodTelemetrySink(cliOptions) }
                  );
                }
              } finally {
                clearInterval(keepAlive);
              }
              const duration = Date.now() - start;
              try {
                await printResult(result, originalStdoutWrite);
              } finally {
                // The tool has executed either way, so a failed `--output` write must not lose the
                // event. Reporting after printing keeps a slow telemetry endpoint from ever
                // delaying the user's result.
                await reportToolsCommandTelemetry(toolset, tool, result, duration, cliOptions);
              }
            }
          ).catch(handleCommandFailure(options.logfile));
        } finally {
          process.stdout.write = originalStdoutWrite;
        }
        // Exit explicitly: tool handlers may leave live handles behind that natural drain cannot
        // clear — the vitest child process's IPC pipe among them (its owner kills the child from a
        // process exit handler, which only fires once exit is under way). `printResult` set a
        // non-zero `process.exitCode` when the run failed, and the failure handler above never
        // returns; both paths preserve their code.
        process.exit();
      }
    );
}

/**
 * The cliOptions handed to the telemetry machinery. Only the opt-out tier is forwarded — the
 * passthrough's own options may contain paths and are never sent in payloads. `configDir` points
 * at the config location of the *target* Storybook so `withTelemetry` resolves
 * `core.disableTelemetry` from the project the command is aimed at. It is read locally, never
 * sent.
 */
function pickCliOptions(options: ToolsPassthroughOptions): CLIOptions {
  const targetCwd = options.cwd ?? process.cwd();
  return {
    disableTelemetry: options.disableTelemetry,
    logfile: options.logfile,
    configDir: resolveStorybookConfigDir({ cwd: targetCwd, configDir: options.configDir }),
  };
}

/**
 * The per-method toolset telemetry sink. Events pass through `telemetry()`, which honors the
 * resolved opt-out state, so the sink itself never has to know whether telemetry is enabled. They
 * report under the same `tools-command` event as the per-invocation record, distinguished by the
 * `event` field the method supplies (mirroring how MCP method events report under `addon-mcp`).
 */
function createMethodTelemetrySink(cliOptions: CLIOptions): ToolsetTelemetry {
  return async (event, payload) => {
    try {
      await telemetry('tools-command', { event, ...payload }, { configDir: cliOptions.configDir });
    } catch (error) {
      logger.debug(`Error collecting telemetry: ${String(error)}`);
    }
  };
}

/**
 * Tool and toolset names are a fixed, project-defined vocabulary of short identifiers. Anything
 * else is arbitrary agent input (a typo'd path, a stray flag value) that must not be sent
 * verbatim, so it is collapsed to a placeholder. The intercept reason still tells the failure
 * class apart.
 */
function sanitizeNamePart(part: string): string {
  return /^[\w-]{1,64}$/.test(part) ? part : '(invalid)';
}

/**
 * Fire the `tools-command` event, once per executed tool, modeled on the `ai-command` event
 * (storybookjs/storybook#35131). Help lookups are excluded so they cannot skew success rates.
 * Unexpected failures additionally go through the standard sanitized error path; `failure`
 * outcomes (the tool ran and reported bad news) do not.
 */
async function reportToolsCommandTelemetry(
  toolset: string | undefined,
  tool: string | undefined,
  result: ToolsRunResult,
  duration: number,
  cliOptions: CLIOptions
): Promise<void> {
  const { outcome } = result;
  if (outcome.kind === 'help') {
    return;
  }
  const command =
    [toolset, tool]
      .filter((part): part is string => part !== undefined)
      .map(sanitizeNamePart)
      .join(' ') || '(none)';
  await telemetry(
    'tools-command',
    {
      command,
      success: outcome.kind === 'success',
      outcome: outcome.kind,
      client: 'cli',
      requestedMode: result.requestedMode,
      attachMode: result.attachMode,
      ...(result.host && (result.attachMode === 'attached' || result.attachMode === 'local')
        ? { resolvedMode: result.attachMode }
        : {}),
      ...(result.host ? { host: result.host } : {}),
      ...(result.multipleMatches ? { multipleMatches: true } : {}),
      ...(result.fallbackReason ? { attachGate: result.fallbackReason } : {}),
      ...(outcome.kind === 'attach-gate' ? { attachGate: outcome.reason } : {}),
      ...(outcome.kind === 'intercept' ? { interceptReason: outcome.reason } : {}),
      duration,
    },
    // Metadata must describe the target project, consistent with the opt-out resolution.
    { configDir: cliOptions.configDir }
  );
  if (outcome.kind === 'error') {
    await sendTelemetryError(outcome.error, 'tools-command', { cliOptions });
  }
}

/** Print to stdout, or to the file given via `-o, --output`. Notices go to stderr. */
async function printResult(
  { output, exitCode, outputPath, fallbackNotice, multiInstanceNotice }: ToolsRunResult,
  stdoutWrite: typeof process.stdout.write
): Promise<void> {
  for (const notice of [fallbackNotice, multiInstanceNotice]) {
    if (notice) {
      await new Promise<void>((resolveWrite) => {
        process.stderr.write(`${notice}\n`, () => resolveWrite());
      });
    }
  }
  if (outputPath) {
    const resolvedPath = resolve(outputPath);
    await writeFile(resolvedPath, `${output}\n`, 'utf-8');
    logger.log(`Output written to ${resolvedPath}`);
  } else {
    // Awaiting the flush matters because the command exits explicitly right after: `process.exit`
    // truncates output still buffered in a piped stdout, and agents pipe this output.
    // `stdoutWrite` is the stream's saved original writer, so the result escapes the `--json`
    // diversion above.
    await new Promise<void>((resolveWrite) => {
      stdoutWrite.call(process.stdout, `${output}\n`, undefined, () => resolveWrite());
    });
  }
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
