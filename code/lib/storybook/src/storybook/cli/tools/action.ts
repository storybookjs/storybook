import { writeFile } from 'node:fs/promises';

import { logger } from '@storybook/core/internal/node-logger';
import type { CLIOptions } from '@storybook/core/internal/types';
import { resolve } from 'pathe';

import type { Tools } from '@storybook/open-service';
import {
  discoverRunningInstance,
  getToolsTelemetrySink,
  reportToolsCommandEvent,
  resolveStorybookConfigDir,
  sanitizeNamePart,
  servesToolsetRpc,
  type ToolsTelemetrySink,
} from '@storybook/open-service/internal';
import { runToolsCommand, type ToolsRunResult } from './run.ts';
import { isJsonToolsRun, parsePort, type ToolsOutputFlags } from './tool-tokens.ts';

/** `handleCommandFailure` from `bin/core.ts`, passed in to avoid an import cycle. */
export type CommandFailureHandler = (
  logFilePath: string | boolean | undefined
) => (error: unknown) => Promise<never>;

export type ToolsPassthroughOptions = ToolsOutputFlags & {
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

type ToolsRunSummary = {
  toolset: string | undefined;
  tool: string | undefined;
  result: ToolsRunResult;
  duration: number;
};

/** What `onSettled` did with a result: when it settled, whether printing failed, and whether the host took the record. */
type SettledState = { duration: number; printError?: { error: unknown }; sent: boolean };

/**
 * The body of `storybook tools`. A run that will attach over the toolset RPC loads nothing from
 * the project: the dev server records its `tools-command` event under its own configuration.
 * Every other run resolves the telemetry opt-out from the project's `main.ts` and reports here.
 */
export async function runToolsAction(
  toolset: string | undefined,
  tool: string | undefined,
  tokens: string[],
  options: ToolsPassthroughOptions,
  handleCommandFailure: CommandFailureHandler
): Promise<void> {
  const cliOptions = pickCliOptions(options);
  const flags: ToolsOutputFlags = {
    input: options.input,
    json: options.json,
    output: options.output,
    help: options.help,
    attach: options.noAttach ? false : options.attach,
  };
  // `--json` promises a parseable stdout, but writers this realm does not own print to it:
  // `withTelemetry` evaluates the project's `main.ts` to resolve the telemetry opt-out before the
  // command body runs (and the module cache means import-time logging fires only in that first
  // load), config loading and the tool log through clack-backed node-logger and vite, and the
  // telemetry report after the result can log as well. Divert every stdout write to stderr for the
  // whole command; `printResult` writes the result through the saved writer.
  const originalStdoutWrite = process.stdout.write;
  if (isJsonToolsRun(tokens, flags)) {
    // Bound, not assigned: both streams share the inherited `Writable.prototype.write`, which
    // dispatches on `this` — unbound it would keep writing to stdout.
    process.stdout.write = process.stderr.write.bind(process.stderr) as typeof process.stdout.write;
  }
  try {
    const remote = await attachesOverToolsetRpc(options);
    const body = (): Promise<void> =>
      runAndReport({ toolset, tool, tokens, options, flags, cliOptions, remote }, (result) =>
        printResult(result, originalStdoutWrite)
      );
    if (remote) {
      await body().catch(handleCommandFailure(options.logfile));
    } else {
      const { withTelemetry } = await import('storybook/internal/server');
      // Like `init`, the fallback keeps telemetry on when no main config is loadable: running
      // from a cwd without a Storybook is a failure this event exists to measure. The explicit
      // opt-outs (env var, flag, loadable `core.disableTelemetry`) still apply.
      await withTelemetry(
        'tools-command',
        { cliOptions, fallbackTelemetryState: true },
        body
      ).catch(handleCommandFailure(options.logfile));
    }
  } finally {
    process.stdout.write = originalStdoutWrite;
  }
  // Exit explicitly: tool handlers may leave live handles behind that natural drain cannot clear —
  // the vitest child process's IPC pipe among them (its owner kills the child from a process exit
  // handler, which only fires once exit is under way). `printResult` set a non-zero
  // `process.exitCode` when the run failed, and the failure handler above never returns; both
  // paths preserve their code.
  process.exit();
}

/**
 * Whether the run will attach to a dev server that serves the toolset RPC. A registry read only;
 * anything it misjudges still runs correctly and reports from this process.
 */
async function attachesOverToolsetRpc(options: ToolsPassthroughOptions): Promise<boolean> {
  if (options.noAttach || options.attach === false) {
    return false;
  }
  const port = parsePort(options.port);
  if (!port.ok) {
    return false;
  }
  try {
    const { currentRecord } = await discoverRunningInstance({
      cwd: options.cwd,
      configDir: options.configDir,
      ...(port.port !== undefined ? { port: port.port } : {}),
    });
    return servesToolsetRpc(currentRecord);
  } catch {
    return false;
  }
}

async function runAndReport(
  run: {
    toolset: string | undefined;
    tool: string | undefined;
    tokens: string[];
    options: ToolsPassthroughOptions;
    flags: ToolsOutputFlags;
    cliOptions: CLIOptions;
    remote: boolean;
  },
  print: (result: ToolsRunResult) => Promise<void>
): Promise<void> {
  const { toolset, tool, tokens, options, flags, cliOptions } = run;
  // The dev server's listening socket keeps its event loop alive; this realm has no server, and
  // some of the async work the toolsets await (native parser/resolver calls in the module-graph
  // engine) holds no libuv handle while in flight. Without a keep-alive the loop can drain
  // mid-await and Node exits silently with code 0.
  const keepAlive = setInterval(() => {}, 60_000);
  const start = Date.now();
  let settled: SettledState | undefined;
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
        {
          // A remote host's sink only works while the host is open, so print and report here.
          onSettled: async (settledResult: ToolsRunResult, tools: Tools): Promise<void> => {
            const state: SettledState = {
              duration: Date.now() - start,
              sent: false,
            };
            settled = state;
            const sink = getToolsTelemetrySink(tools);
            try {
              await print(settledResult);
            } catch (error) {
              state.printError = { error };
            }
            if (sink) {
              const summary = { toolset, tool, result: settledResult, duration: state.duration };
              await reportToolsCommandTelemetry(summary, cliOptions, sink);
              state.sent = true;
            }
          },
        }
      );
    }
  } finally {
    clearInterval(keepAlive);
  }
  // Assigned inside `onSettled`, which control-flow analysis cannot see.
  const done = settled as SettledState | undefined;
  const summary = { toolset, tool, result, duration: done?.duration ?? Date.now() - start };
  try {
    if (done?.printError) {
      throw done.printError.error;
    }
    if (!done) {
      await print(result);
    }
  } finally {
    // The tool has executed either way, so a failed `--output` write must not lose the event.
    // Reporting after printing keeps a slow telemetry endpoint from ever delaying the user's result.
    if (!done?.sent) {
      const report = (): Promise<void> => reportToolsCommandTelemetry(summary, cliOptions);
      if (run.remote) {
        // Expected an RPC host but ran elsewhere (fallback, gate): resolve the opt-out first.
        const { withTelemetry } = await import('storybook/internal/server');
        await withTelemetry('tools-command', { cliOptions, fallbackTelemetryState: true }, report);
      } else {
        await report();
      }
    }
  }
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
 * Fire the `tools-command` event, once per executed tool. The handler's own report, returned on
 * its outcome, is merged into the same record. Help lookups are excluded so they cannot skew
 * success rates. Unexpected failures additionally go through the standard sanitized error path;
 * `failure` outcomes (the tool ran and reported bad news) do not. With a `sink`, the attached dev
 * server sends the record and no error report leaves this process.
 */
async function reportToolsCommandTelemetry(
  run: ToolsRunSummary,
  cliOptions: CLIOptions,
  sink?: ToolsTelemetrySink
): Promise<void> {
  const { toolset, tool, result, duration } = run;
  const { outcome } = result;
  if (outcome.kind === 'help') {
    return;
  }
  await reportToolsCommandEvent(
    {
      ...(toolset !== undefined ? { toolset: sanitizeNamePart(toolset) } : {}),
      ...(tool !== undefined ? { tool: sanitizeNamePart(tool) } : {}),
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
    { report: result.report, configDir: cliOptions.configDir, sink }
  );
  if (outcome.kind === 'error' && !sink) {
    const { sendTelemetryError } = await import('storybook/internal/server');
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
