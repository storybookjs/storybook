import { versions } from 'storybook/internal/common';

import type {
  AnyToolsetDefinition,
  AnyToolsetMethod,
  ToolsetCtx,
  ToolsetTelemetry,
} from '../../shared/open-service/toolset-definition.ts';
import {
  toCliMethodName,
  toMcpToolName,
  type ToolsetMethodId,
} from '../../shared/open-service/toolset-names.ts';
import { getService } from '../../shared/open-service/server.ts';
import { getRegisteredToolsets } from '../../shared/open-service/toolset-registry.ts';
import type { StorybookInstanceRecord } from './instances/types.ts';
import { callMcpTool } from './mcp-client.ts';
import { createTools, type Tools, type ToolsClientInfo } from './sdk/index.ts';
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

/** Identifies this CLI to the tools SDK that hosts its run. */
const CLI_CLIENT_INFO: ToolsClientInfo = {
  name: 'storybook-cli',
  version: versions.storybook,
  kind: 'cli',
};

/** Injectable dependencies for tests. */
export type ToolsRunDeps = {
  createTools?: typeof createTools;
  discoverInstance?: typeof discoverRunningInstance;
  /** Stub for {@link PROXY_VIA_MCP_METHODS}; goes away with the proxy in Milestone 5b. */
  mcpToolCall?: typeof callMcpTool;
  /** Sink for the per-method toolset telemetry events; absent when telemetry is disabled. */
  methodTelemetry?: ToolsetTelemetry;
};

/**
 * The `requiresDevServer` methods that only need a live origin, which instance discovery can
 * provide without attaching to the dev server's state. The remaining trait-marked methods are
 * state-bound and cannot run from this CLI until connect mode (Milestone 5b) exists. The
 * distinction is deliberately invisible in the surface — one trait, one contract.
 */
const ORIGIN_ONLY_METHODS = new Set(['stories.preview']);

/**
 * State-bound methods this CLI forwards to the dev server's `@storybook/addon-mcp` endpoint
 * instead of running locally, so the whole tool surface works before connect mode exists.
 *
 * A stopgap until Milestone 5b: connect mode attaches to the dev server's own open-service state,
 * at which point these methods run through the normal handler path and this set, its dispatch
 * branch and the `mcpToolCall` dependency get deleted. `mcp-client.ts` goes with them once
 * `storybook ai` — its other consumer — is removed. Only methods `@storybook/addon-mcp` exposes
 * through the standard derived MCP name can be listed here.
 */
const PROXY_VIA_MCP_METHODS: ReadonlySet<string> = new Set([
  'review.create',
] satisfies ToolsetMethodId[]);

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

  let tools: Tools | undefined;
  try {
    tools = await (deps.createTools ?? createTools)({
      cwd: target.cwd,
      configDir: target.configDir,
      mode: 'local',
      clientInfo: CLI_CLIENT_INFO,
    });
  } catch (error) {
    // The SDK's own message already names the failure and the configuration it could not load.
    return result({
      exitCode: 1,
      output: error instanceof Error ? error.message : String(error),
      outcome: { kind: 'error', error },
    });
  }

  try {
    return await runWithHost(tools, {
      toolsetName,
      toolName,
      parsed,
      result,
      target,
      deps,
    });
  } finally {
    await tools.close();
  }
}

async function runWithHost(
  tools: Tools,
  args: {
    toolsetName: string | undefined;
    toolName: string | undefined;
    parsed: Extract<ReturnType<typeof parseToolsTokens>, { ok: true }>;
    result: (partial: Omit<ToolsRunResult, 'outputPath'>) => ToolsRunResult;
    target: ToolsTarget;
    deps: ToolsRunDeps;
  }
): Promise<ToolsRunResult> {
  const { toolsetName, toolName, parsed, result, target, deps } = args;
  const toolsets = getRegisteredToolsets();
  const configDir = tools.storybook.configDir;
  const ctx: ToolsetCtx = {
    transport: 'cli',
    getService: (serviceId, options) => getService(serviceId as never, options),
    ...(deps.methodTelemetry ? { telemetry: deps.methodTelemetry } : {}),
  };

  if (!toolsetName) {
    return result({
      exitCode: 0,
      output: renderToolsHelp(configDir, toolsets, ctx),
      outcome: { kind: 'help' },
    });
  }

  const toolset = toolsets.find((candidate) => candidate.id === toolsetName);
  if (!toolset) {
    return result({
      exitCode: 1,
      output: formatUnknownToolset(toolsetName, configDir, toolsets),
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
  /** The method the toolset actually resolved, which the dev-server contract dispatches on. */
  const resolvedRef = `${toolset.id}.${methodKey}`;

  if (parsed.help) {
    return result({
      exitCode: 0,
      output: renderMethodHelp(toolset, methodKey, method, ctx),
      outcome: { kind: 'help' },
    });
  }

  let origin: string | undefined;
  let proxyTarget: StorybookInstanceRecord | undefined;
  if (method.requiresDevServer) {
    const discovery = await (deps.discoverInstance ?? discoverRunningInstance)(target);
    if (!discovery.currentRecord) {
      return result({
        exitCode: 1,
        output: formatRequiresDevServer(commandPath, discovery),
        outcome: { kind: 'intercept', reason: 'requires-dev-server' },
      });
    }
    if (PROXY_VIA_MCP_METHODS.has(resolvedRef)) {
      if (!discovery.currentRecord.mcp.endpoint) {
        return result({
          exitCode: 1,
          output: formatProxyEndpointMissing(commandPath, discovery.currentRecord),
          outcome: { kind: 'intercept', reason: 'attach-unavailable' },
        });
      }
      proxyTarget = discovery.currentRecord;
      // No core method reaches this arm today — it guards trait-marked methods from toolsets
      // outside core's own set, which have no MCP tool name to proxy to.
    } else if (!ORIGIN_ONLY_METHODS.has(resolvedRef)) {
      return result({
        exitCode: 1,
        output: formatAttachUnavailable(commandPath, discovery.currentRecord),
        outcome: { kind: 'intercept', reason: 'attach-unavailable' },
      });
    }
    origin = discovery.currentRecord.url;
  }

  const validation = await method.input['~standard'].validate(parsed.args);
  if (validation.issues) {
    return result({
      exitCode: 1,
      output: formatValidationIssues(commandPath, validation.issues),
      outcome: { kind: 'intercept', reason: 'invalid-arguments' },
    });
  }

  try {
    if (proxyTarget) {
      // The dev server runs the handler, so its telemetry and side effects stay in the process
      // that owns them; this side only unwraps the reply the same way the MCP adapter wrapped it.
      const reply = await (deps.mcpToolCall ?? callMcpTool)(proxyTarget, {
        name: toMcpToolName(resolvedRef as ToolsetMethodId),
        arguments: validation.value as Record<string, unknown>,
      });
      const text = (reply.content ?? [])
        .filter(
          (item): item is { type: 'text'; text: string } => item.type === 'text' && !!item.text
        )
        .map((item) => item.text)
        .join('\n\n');
      return result({
        exitCode: reply.isError ? 1 : 0,
        // `--json` prints whatever structured data the reply carries; a reply without it (an
        // error from a method that declares no failure data) falls back to the text rather than
        // inventing a shape, and the exit code still tells a script the call failed.
        output:
          parsed.json && reply.structuredContent !== undefined
            ? JSON.stringify(reply.structuredContent, null, 2)
            : text,
        outcome: { kind: reply.isError ? 'failure' : 'success' },
      });
    }

    const outcome = await tools.call(resolvedRef, validation.value as Record<string, unknown>, {
      ...(origin ? { origin } : {}),
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

function joinMarkdown(markdown: string | string[]): string {
  return Array.isArray(markdown) ? markdown.join('\n\n') : markdown;
}

function formatUnknownToolset(
  toolsetName: string,
  configDir: string,
  toolsets: AnyToolsetDefinition[]
): string {
  const available = toolsets.map((toolset) => `- \`${toolset.id}\``).join('\n');
  return `Unknown toolset \`${toolsetName}\`. The Storybook configuration at ${configDir} provides:

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

function formatProxyEndpointMissing(commandPath: string, record: StorybookInstanceRecord): string {
  return `Found your Storybook running at ${record.url}, but \`${commandPath}\` runs inside that Storybook and it is not serving the endpoint this command needs. Add \`@storybook/addon-mcp\` to the \`addons\` array in your Storybook configuration, restart the dev server, then re-run this command.`;
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
