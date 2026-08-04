import { OpenServiceModuleGraphUnavailableError } from '../../server-errors.ts';
import type {
  AnyToolsetDefinition,
  AnyToolsetMethod,
  ToolsetCtx,
  ToolsetTelemetry,
} from '../../shared/open-service/toolset-definition.ts';
import { toCliMethodName } from '../../shared/open-service/toolset-names.ts';
import type { StorybookInstanceRecord } from './instances/types.ts';
import { bootstrapToolsRuntime, type ToolsRuntime } from './bootstrap.ts';
import {
  discoverRunningInstance,
  type InstanceDiscovery,
  type ToolsTarget,
} from './discover-instance.ts';
import { renderMethodHelp, renderToolsHelp, renderToolsetHelp } from './help.ts';
import { parseToolsTokens, type ToolsOutputFlags } from './tool-tokens.ts';

/**
 * Why an invocation stopped before its handler executed, for the `tools-command` telemetry event.
 */
export type ToolsInterceptReason =
  | 'invalid-arguments'
  | 'unknown-toolset'
  | 'unknown-tool'
  | 'requires-dev-server'
  | 'attach-unavailable';

/**
 * Telemetry-facing classification of a run. `help` marks lookups, excluded from the
 * `tools-command` event so they cannot skew success rates. `failure` is a completed run whose
 * outcome was `ok: false` or an agent-facing error — the tool did its job and reported bad news,
 * so no crash report is sent. `error` carries unexpected failures for the sanitized error path.
 */
export type ToolsCommandOutcome =
  | { kind: 'success' }
  | { kind: 'help' }
  | { kind: 'failure' }
  | { kind: 'intercept'; reason: ToolsInterceptReason }
  | { kind: 'error'; error: unknown };

export type ToolsRunResult = {
  exitCode: 0 | 1;
  output: string;
  outcome: ToolsCommandOutcome;
  /** From `-o`/`--output`; the caller writes `output` there instead of stdout. */
  outputPath?: string;
};

export type ToolsInvocation = {
  toolset?: string;
  tool?: string;
  /** Pass-through tokens after the tool name. */
  tokens: string[];
  target: ToolsTarget;
  /** Values of the same flags when given before the toolset name (commander-owned). */
  flags?: ToolsOutputFlags;
};

/** Injectable dependencies for tests. */
export type ToolsRunDeps = {
  bootstrap?: typeof bootstrapToolsRuntime;
  discoverInstance?: typeof discoverRunningInstance;
  /** Sink for the per-method toolset telemetry events; absent when telemetry is disabled. */
  methodTelemetry?: ToolsetTelemetry;
};

/**
 * Methods that consume the module-graph open service, requiring this invocation to host the graph
 * (settled engine + populated change-detection statuses) before their handler runs. A CLI
 * implementation detail: everything else resolves the graph adapter to "absent" so no query can
 * ever hang.
 */
const MODULE_GRAPH_METHODS = new Set(['stories.changed', 'stories.findByComponent']);

/**
 * The `requiresDevServer` methods that only need a live origin, which instance discovery can
 * provide without attaching to the dev server's state. The remaining trait-marked methods are
 * state-bound and cannot run from this CLI until connect mode (Milestone 5b) exists. The
 * distinction is deliberately invisible in the surface — one trait, one contract.
 */
const ORIGIN_ONLY_METHODS = new Set(['stories.preview']);

/** `find-by-component` -> `findByComponent`, accepting an already-camelCase spelling unchanged. */
function toMethodKey(cliName: string): string {
  return cliName.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function isAgentFacingError(error: unknown): error is Error {
  return error instanceof Error && (error as { agentFacing?: boolean }).agentFacing === true;
}

/**
 * Run one `storybook tools` invocation against the toolsets the target Storybook configuration
 * registers in this process. This is the whole command behind the commander wiring: dispatch,
 * help, argument parsing and validation, the requires-dev-server contract, and the mechanical
 * outcome mapping (markdown to stdout, `--json` for data, `ok` drives the exit code).
 */
export async function runToolsCommand(
  invocation: ToolsInvocation,
  deps: ToolsRunDeps = {}
): Promise<ToolsRunResult> {
  const { toolset: toolsetName, tool: toolName, tokens, target, flags = {} } = invocation;

  const parsed = parseToolsTokens(tokens, flags);
  if (!parsed.ok) {
    return {
      exitCode: 1,
      output: parsed.error,
      outcome: { kind: 'intercept', reason: 'invalid-arguments' },
      outputPath: flags.output,
    };
  }

  // `-o/--output` applies to whatever the run produced — help, intercepts, and tool results
  // alike — matching the ai CLI, where the output file always receives the printed text.
  const result = (partial: Omit<ToolsRunResult, 'outputPath'>): ToolsRunResult => ({
    ...partial,
    outputPath: parsed.output,
  });

  const methodRef = toolsetName && toolName ? `${toolsetName}.${toMethodKey(toolName)}` : undefined;
  const hostModuleGraph =
    !parsed.help && methodRef !== undefined && MODULE_GRAPH_METHODS.has(methodRef);

  let runtime: ToolsRuntime;
  try {
    runtime = await (deps.bootstrap ?? bootstrapToolsRuntime)(target, { hostModuleGraph });
  } catch (error) {
    return result({
      exitCode: 1,
      output: `Could not load the Storybook configuration for this project: ${
        error instanceof Error ? error.message : String(error)
      }`,
      outcome: { kind: 'error', error },
    });
  }

  const ctx = buildContext(runtime, deps, undefined, undefined);

  if (!toolsetName) {
    return result({
      exitCode: 0,
      output: renderToolsHelp(runtime.configDir, runtime.toolsets, ctx),
      outcome: { kind: 'help' },
    });
  }

  const toolset = runtime.toolsets.find((candidate) => candidate.id === toolsetName);
  if (!toolset) {
    return result({
      exitCode: 1,
      output: formatUnknownToolset(toolsetName, runtime),
      outcome: { kind: 'intercept', reason: 'unknown-toolset' },
    });
  }

  if (!toolName) {
    return result({
      exitCode: 0,
      output: renderToolsetHelp(toolset, ctx),
      outcome: { kind: 'help' },
    });
  }

  const methodKey = Object.keys(toolset.methods).find(
    (key) => key === toMethodKey(toolName) || toCliMethodName(key) === toolName
  );
  const method: AnyToolsetMethod | undefined = methodKey ? toolset.methods[methodKey] : undefined;
  if (!methodKey || !method) {
    return result({
      exitCode: 1,
      output: formatUnknownTool(toolName, toolset),
      outcome: { kind: 'intercept', reason: 'unknown-tool' },
    });
  }
  const commandPath = `npx storybook tools ${toolset.id} ${toCliMethodName(methodKey)}`;

  if (parsed.help) {
    return result({
      exitCode: 0,
      output: renderMethodHelp(toolset, methodKey, method, ctx),
      outcome: { kind: 'help' },
    });
  }

  let origin: string | undefined;
  if (method.requiresDevServer) {
    const discovery = await (deps.discoverInstance ?? discoverRunningInstance)(target);
    if (!discovery.record) {
      return result({
        exitCode: 1,
        output: formatRequiresDevServer(commandPath, discovery),
        outcome: { kind: 'intercept', reason: 'requires-dev-server' },
      });
    }
    if (!ORIGIN_ONLY_METHODS.has(`${toolset.id}.${methodKey}`)) {
      return result({
        exitCode: 1,
        output: formatAttachUnavailable(commandPath, discovery.record),
        outcome: { kind: 'intercept', reason: 'attach-unavailable' },
      });
    }
    origin = discovery.record.url;
  }

  if (
    hostModuleGraph &&
    runtime.moduleGraphReadiness &&
    runtime.moduleGraphReadiness.status !== 'ready'
  ) {
    const error = new OpenServiceModuleGraphUnavailableError({
      reason: describeUnreadyModuleGraph(runtime.moduleGraphReadiness),
    });
    return result({ exitCode: 1, output: error.message, outcome: { kind: 'failure' } });
  }

  const validation = await method.schema['~standard'].validate(parsed.args);
  if (validation.issues) {
    return result({
      exitCode: 1,
      output: formatValidationIssues(commandPath, validation.issues),
      outcome: { kind: 'intercept', reason: 'invalid-arguments' },
    });
  }

  try {
    const outcome = await method.handler(
      validation.value,
      buildContext(runtime, deps, origin, toolset)
    );
    const output = parsed.json
      ? JSON.stringify(outcome.data, null, 2)
      : joinMarkdown(outcome.markdown);
    return result({
      exitCode: outcome.ok ? 0 : 1,
      output,
      outcome: { kind: outcome.ok ? 'success' : 'failure' },
    });
  } catch (error) {
    // An agent-facing error is a tool speaking to the agent and naming its own recovery — surface
    // it verbatim as a result, not as a crash.
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

function buildContext(
  runtime: ToolsRuntime,
  deps: ToolsRunDeps,
  origin: string | undefined,
  toolset: AnyToolsetDefinition | undefined
): ToolsetCtx {
  const { methodTelemetry } = deps;
  return {
    consumer: 'cli',
    ...(origin ? { origin } : {}),
    getService: runtime.getService,
    ...(methodTelemetry && toolset
      ? {
          telemetry: ((event, payload) =>
            methodTelemetry(event, {
              toolset: toolset.telemetryGroup,
              ...payload,
            })) satisfies ToolsetTelemetry,
        }
      : {}),
  };
}

function joinMarkdown(markdown: string | string[]): string {
  return Array.isArray(markdown) ? markdown.join('\n\n') : markdown;
}

function formatUnknownToolset(toolsetName: string, runtime: ToolsRuntime): string {
  const available = runtime.toolsets.map((toolset) => `- \`${toolset.id}\``).join('\n');
  return `Unknown toolset \`${toolsetName}\`. The Storybook configuration at ${runtime.configDir} provides:

${available}

Run \`npx storybook tools --help\` for every tool.`;
}

function formatUnknownTool(toolName: string, toolset: AnyToolsetDefinition): string {
  const available = Object.keys(toolset.methods)
    .map((key) => `- \`${toCliMethodName(key)}\``)
    .join('\n');
  return `Unknown tool \`${toolName}\`. The \`${toolset.id}\` toolset provides:

${available}

Run \`npx storybook tools ${toolset.id}\` for their descriptions.`;
}

function formatRequiresDevServer(commandPath: string, discovery: InstanceDiscovery): string {
  const lines = [
    `\`${commandPath}\` requires a running Storybook dev server, and none was found for this project. Start it first (for example \`npm run storybook\`), then re-run this command.`,
  ];
  if (discovery.records.length > 0) {
    const candidates = discovery.records
      .map((record) => `- ${record.url} (cwd \`${record.cwd}\`)`)
      .join('\n');
    lines.push(
      '',
      `Running Storybook instances that did not match this project — target one with \`--cwd\` or \`--config-dir\`:`,
      candidates
    );
  }
  return lines.join('\n');
}

function formatAttachUnavailable(commandPath: string, record: StorybookInstanceRecord): string {
  return `Found your Storybook running at ${record.url}, but \`${commandPath}\` cannot attach to a running Storybook yet — it becomes available in an upcoming release.`;
}

function describeUnreadyModuleGraph(
  readiness: NonNullable<ToolsRuntime['moduleGraphReadiness']>
): string {
  if (readiness.status === 'unavailable') {
    return readiness.reason === 'disabled'
      ? 'Change detection is disabled in this project (`features.changeDetection` is false).'
      : readiness.reason;
  }
  if (readiness.status === 'error') {
    return `Change detection failed: ${readiness.error.message}`;
  }
  return 'The module graph did not become ready.';
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
