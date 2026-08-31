import { versions } from 'storybook/internal/common';

import type { ToolsetTelemetry } from '../../shared/open-service/toolset-definition.ts';
import { parseToolsetMethodId, toCliMethodName } from '../../shared/open-service/toolset-names.ts';
import type { StorybookInstanceRecord } from './instances/types.ts';
import {
  attachGateReasonFromError,
  createTools,
  formatMultiInstanceNotice,
  isAttachGateError,
  toolsCommandDimensions,
  wrapMethodTelemetry,
  ToolsRuntimeError,
  type CreateToolsDeps,
  type CreateToolsOptions,
  type Tools,
  type ToolsAttachGateReason,
  type ToolsClientInfo,
  type ToolsHostKind,
  type ToolsMode,
} from './sdk/index.ts';
import {
  discoverRunningInstance,
  type InstanceDiscovery,
  type ToolsTarget,
} from './discover-instance.ts';
import {
  renderMethodHelpFromCatalog,
  renderToolsHelpFromCatalog,
  renderToolsetHelpFromCatalog,
} from './help.ts';
import {
  parsePort,
  parseToolsTokens,
  type ParsedToolsTokens,
  type ToolsOutputFlags,
} from './tool-tokens.ts';

/**
 * Why an invocation stopped before its handler executed, for the `tools-command` telemetry event.
 */
export type ToolsInterceptReason =
  | 'invalid-arguments'
  | 'unknown-toolset'
  | 'unknown-tool'
  | 'requires-dev-server';

/**
 * Telemetry-facing classification of a run. `help` marks lookups, excluded from the
 * `tools-command` event so they cannot skew success rates. `failure` is a completed run whose
 * outcome was `ok: false` or an agent-facing error — the tool did its job and reported bad news,
 * so no crash report is sent. `attach-gate` is a hard attach failure (`--attach`, or SDK
 * `mode: 'attached'`). `error` carries unexpected failures for the sanitized error path.
 */
export type ToolsCommandOutcome =
  | { kind: 'success' }
  | { kind: 'help' }
  | { kind: 'failure' }
  | { kind: 'intercept'; reason: ToolsInterceptReason }
  | { kind: 'attach-gate'; reason: ToolsAttachGateReason }
  | { kind: 'error'; error: unknown };

export type ToolsRunResult = {
  exitCode: 0 | 1;
  output: string;
  outcome: ToolsCommandOutcome;
  /** From `-o`/`--output`; the caller writes `output` there instead of stdout. */
  outputPath?: string;
  /** Requested attach mode, including `auto`. */
  requestedMode: ToolsMode;
  /** Resolved host mode for the `tools-command` event; `auto` only when no host was created. */
  attachMode: ToolsMode;
  /** Set once a host exists. */
  host?: ToolsHostKind;
  /** Set when `auto` could not attach and loaded the project configuration instead. */
  fallbackNotice?: string;
  /** Why `auto` loaded locally instead of attaching. */
  fallbackReason?: ToolsAttachGateReason;
  /** Set when the attached host chose among several matching instances; printed to stderr. */
  multiInstanceNotice?: string;
  /** True when the attached host chose among several matching instances; drives telemetry. */
  multipleMatches?: boolean;
};

export type ToolsInvocation = {
  toolset?: string;
  tool?: string;
  /** Pass-through tokens after the tool name. */
  tokens: string[];
  target: ToolsTarget;
  /** Raw `--port` value (commander-owned, given before the toolset name). */
  port?: string;
  /** Values of the same flags when given before the toolset name (commander-owned). */
  flags?: ToolsOutputFlags;
  /** `true` from `--attach`, `false` from `--no-attach`, omitted for the attach-preferred default. */
  attach?: boolean;
};

/** Identifies this CLI to the tools SDK that hosts its run. */
const CLI_CLIENT_INFO: ToolsClientInfo = {
  name: 'storybook-cli',
  version: versions.storybook,
  kind: 'cli',
};

/** Injectable dependencies for tests. */
export type ToolsRunDeps = {
  createTools?: (options?: CreateToolsOptions, deps?: CreateToolsDeps) => Promise<Tools>;
  discoverInstance?: typeof discoverRunningInstance;
  /** Sink for the per-method toolset telemetry events; absent when telemetry is disabled. */
  methodTelemetry?: ToolsetTelemetry;
};

/** `find-by-component` -> `findByComponent`, accepting an already-camelCase spelling unchanged. */
function toMethodKey(cliName: string): string {
  return cliName.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function isAgentFacingError(error: unknown): error is Error {
  return error instanceof Error && (error as { agentFacing?: boolean }).agentFacing === true;
}

function isInvalidInputError(error: unknown): error is ToolsRuntimeError {
  return error instanceof ToolsRuntimeError && error.data.reason === 'invalid-input';
}

function normalizeHelpFlag(invocation: ToolsInvocation): ToolsInvocation {
  if (invocation.tool !== '--help' && invocation.tool !== '-h') {
    return invocation;
  }
  return {
    ...invocation,
    tool: undefined,
    flags: { ...invocation.flags, help: true },
  };
}

function resolveToolsMode(
  invocationAttach: boolean | undefined,
  parsedAttach: boolean | undefined
): ToolsMode {
  const flag = parsedAttach ?? invocationAttach;
  if (flag === true) {
    return 'attached';
  }
  if (flag === false) {
    return 'local';
  }
  return 'auto';
}

/**
 * Run one `storybook tools` invocation against the toolsets the target Storybook configuration
 * registers in this process. This is the whole command behind the commander wiring: dispatch,
 * help, argument parsing, the requires-dev-server contract, and the mechanical
 * outcome mapping (markdown to stdout, `--json` for data, `ok` drives the exit code).
 */
export async function runToolsCommand(
  invocation: ToolsInvocation,
  deps: ToolsRunDeps = {}
): Promise<ToolsRunResult> {
  const normalized = normalizeHelpFlag(invocation);
  const { tokens, flags = {}, attach } = normalized;

  const parsed = parseToolsTokens(tokens, flags);
  const requestedMode = parsed.ok
    ? resolveToolsMode(attach, parsed.attach)
    : resolveToolsMode(attach, undefined);
  if (!parsed.ok) {
    return {
      exitCode: 1,
      output: parsed.error,
      outcome: { kind: 'intercept', reason: 'invalid-arguments' },
      outputPath: flags.output,
      requestedMode,
      attachMode: requestedMode,
    };
  }

  const parsedPort = parsePort(normalized.port);
  if (!parsedPort.ok) {
    return {
      exitCode: 1,
      output: parsedPort.error,
      outcome: { kind: 'intercept', reason: 'invalid-arguments' },
      outputPath: parsed.output,
      requestedMode,
      attachMode: requestedMode,
    };
  }
  const target: ToolsTarget = {
    ...normalized.target,
    ...(parsedPort.port !== undefined ? { port: parsedPort.port } : {}),
  };

  // `-o/--output` applies to whatever the run produced — help, intercepts, and tool results
  // alike — matching the ai CLI, where the output file always receives the printed text.
  const result = (
    partial: Omit<ToolsRunResult, 'outputPath' | 'attachMode' | 'requestedMode'>
  ): ToolsRunResult => ({
    ...partial,
    outputPath: parsed.output,
    requestedMode,
    attachMode: requestedMode,
  });

  let tools: Tools;
  const create: (options?: CreateToolsOptions, deps?: CreateToolsDeps) => Promise<Tools> =
    deps.createTools ?? createTools;
  try {
    tools = await create({
      cwd: target.cwd,
      configDir: target.configDir,
      ...(target.port != null ? { port: target.port } : {}),
      mode: requestedMode,
      clientInfo: CLI_CLIENT_INFO,
    });
  } catch (error) {
    if (isAttachGateError(error)) {
      return result({
        exitCode: 1,
        output: error instanceof Error ? error.message : String(error),
        outcome: { kind: 'attach-gate', reason: attachGateReasonFromError(error) },
      });
    }
    return result({
      exitCode: 1,
      output: error instanceof Error ? error.message : String(error),
      outcome: { kind: 'error', error },
    });
  }

  try {
    const methodTelemetry =
      tools.mode === 'local' && deps.methodTelemetry
        ? wrapMethodTelemetry(
            deps.methodTelemetry,
            toolsCommandDimensions({
              clientInfo: tools.clientInfo,
              requestedMode: tools.requestedMode,
              resolvedMode: tools.mode,
              host: tools.host,
              fallbackReason: tools.fallbackReason,
            })
          )
        : deps.methodTelemetry;
    const dispatchDeps: ToolsRunDeps = { ...deps, methodTelemetry };
    const dispatched = await dispatchTools(
      tools,
      { ...normalized, target },
      parsed,
      dispatchDeps,
      requestedMode,
      result
    );
    return {
      ...dispatched,
      requestedMode: tools.requestedMode,
      attachMode: tools.mode,
      host: tools.host,
      fallbackNotice: tools.fallbackNotice,
      fallbackReason: tools.fallbackReason,
      ...(tools.storybook.siblings?.length
        ? { multiInstanceNotice: formatMultiInstanceNotice(tools.storybook), multipleMatches: true }
        : {}),
    };
  } finally {
    await tools.close();
  }
}

async function dispatchTools(
  tools: Tools,
  invocation: ToolsInvocation,
  parsed: Extract<ParsedToolsTokens, { ok: true }>,
  deps: ToolsRunDeps,
  requestedMode: ToolsMode,
  result: (
    partial: Omit<ToolsRunResult, 'outputPath' | 'attachMode' | 'requestedMode'>
  ) => ToolsRunResult
): Promise<ToolsRunResult> {
  const { toolset: toolsetName, tool: toolName } = invocation;
  let catalog;
  try {
    catalog = await tools.describe();
  } catch (error) {
    if (isAgentFacingError(error)) {
      return result({ exitCode: 1, output: error.message, outcome: { kind: 'failure' } });
    }
    return result({
      exitCode: 1,
      output: error instanceof Error ? error.message : String(error),
      outcome: { kind: 'error', error },
    });
  }

  if (!toolsetName) {
    return result({
      exitCode: 0,
      output: renderToolsHelpFromCatalog(catalog),
      outcome: { kind: 'help' },
    });
  }

  const entry = catalog.toolsets.find((candidate) => candidate.id === toolsetName);
  if (!entry) {
    return result({
      exitCode: 1,
      output: formatUnknownToolsetFromCatalog(toolsetName, catalog),
      outcome: { kind: 'intercept', reason: 'unknown-toolset' },
    });
  }

  if (!toolName) {
    return result({
      exitCode: 0,
      output: renderToolsetHelpFromCatalog(entry),
      outcome: { kind: 'help' },
    });
  }

  const method = entry.methods.find((candidate) => {
    const { methodName } = parseToolsetMethodId(candidate.ref);
    return methodName === toMethodKey(toolName) || toCliMethodName(methodName) === toolName;
  });
  if (!method) {
    return result({
      exitCode: 1,
      output: formatUnknownToolFromCatalog(toolName, entry),
      outcome: { kind: 'intercept', reason: 'unknown-tool' },
    });
  }

  if (parsed.help) {
    return result({
      exitCode: 0,
      output: renderMethodHelpFromCatalog(entry, method),
      outcome: { kind: 'help' },
    });
  }

  const { methodName } = parseToolsetMethodId(method.ref);
  const commandPath = `npx storybook tools ${entry.id} ${toCliMethodName(methodName)}`;

  if (tools.mode === 'local' && method.requiresDevServer) {
    const discovery = await (deps.discoverInstance ?? discoverRunningInstance)(invocation.target);
    return result({
      exitCode: 1,
      output: formatRequiresDevServer(commandPath, discovery, requestedMode),
      outcome: { kind: 'intercept', reason: 'requires-dev-server' },
    });
  }

  try {
    const outcome = await tools.call(method.ref, parsed.args, {
      ...(tools.storybook.url ? { origin: tools.storybook.url } : {}),
      ...(deps.methodTelemetry ? { telemetry: deps.methodTelemetry } : {}),
    });
    const output = parsed.json
      ? JSON.stringify(outcome.data, null, 2)
      : joinMarkdown(outcome.markdown);
    return result({
      exitCode: outcome.ok ? 0 : 1,
      output,
      outcome: { kind: outcome.ok ? 'success' : 'failure' },
    });
  } catch (error) {
    if (isInvalidInputError(error)) {
      return result({
        exitCode: 1,
        output: formatValidationIssues(commandPath, error.data.issues ?? []),
        outcome: { kind: 'intercept', reason: 'invalid-arguments' },
      });
    }
    if (isAgentFacingError(error)) {
      return result({ exitCode: 1, output: error.message, outcome: { kind: 'failure' } });
    }
    return result({
      exitCode: 1,
      output: error instanceof Error ? error.message : String(error),
      outcome: { kind: 'error', error },
    });
  }
}

function formatUnknownToolsetFromCatalog(
  toolsetName: string,
  catalog: { configDir: string; toolsets: { id: string }[] }
): string {
  const available = catalog.toolsets.map((toolset) => `- \`${toolset.id}\``).join('\n');
  return `Unknown toolset \`${toolsetName}\`. The Storybook configuration at ${catalog.configDir} provides:

${available}

Run \`npx storybook tools --help\` for every tool.`;
}

function formatUnknownToolFromCatalog(
  toolName: string,
  entry: { id: string; methods: { ref: string }[] }
): string {
  const available = entry.methods
    .map((method) => `- \`${toCliMethodName(parseToolsetMethodId(method.ref).methodName)}\``)
    .join('\n');
  return `Unknown tool \`${toolName}\`. The \`${entry.id}\` toolset provides:

${available}

Run \`npx storybook tools ${entry.id}\` for their descriptions.`;
}

function joinMarkdown(markdown: string | string[]): string {
  return Array.isArray(markdown) ? markdown.join('\n\n') : markdown;
}

function formatRequiresDevServer(
  commandPath: string,
  discovery: InstanceDiscovery,
  requestedMode: ToolsMode
): string {
  if (discovery.currentRecord && requestedMode === 'local') {
    return `Found your Storybook running at ${discovery.currentRecord.url}, but \`${commandPath}\` cannot run from a local tools host. Re-run without \`--no-attach\` to attach to that instance.`;
  }
  if (discovery.currentRecord) {
    return `Found your Storybook running at ${discovery.currentRecord.url}, but \`${commandPath}\` could not attach to it. Start or restart that Storybook, then re-run this command.`;
  }

  const lines = [
    `\`${commandPath}\` requires a running Storybook dev server, and none was found for this project. Start it first (for example \`npm run storybook\`), then re-run this command.`,
  ];
  if (discovery.records.length > 0) {
    const candidates = discovery.records
      .map((record: StorybookInstanceRecord) => `- ${record.url} (cwd \`${record.cwd}\`)`)
      .join('\n');
    lines.push(
      '',
      `Running Storybook instances that did not match this project — target one with \`--cwd\` or \`--config-dir\`:`,
      candidates
    );
  }
  return lines.join('\n');
}

type ValidationIssues = ReadonlyArray<{
  message: string;
  path?: ReadonlyArray<PropertyKey | { key?: unknown }>;
}>;

function formatValidationIssues(commandPath: string, issues: ValidationIssues): string {
  const lines = issues.map((issue) => {
    const path = issue.path
      ?.map((segment) =>
        typeof segment === 'object' && segment !== null ? String(segment.key) : String(segment)
      )
      .join('.');
    return path ? `- \`${path}\`: ${issue.message}` : `- ${issue.message}`;
  });
  return `Invalid arguments for \`${commandPath}\`:

${lines.join('\n')}

Run \`${commandPath} --help\` for the expected arguments.`;
}
