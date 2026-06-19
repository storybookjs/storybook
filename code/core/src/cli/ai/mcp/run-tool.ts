import { resolve } from 'node:path';

import * as v from 'valibot';

import { McpJsonRpcError, callMcpTool, listMcpTools } from './client.ts';
import { getInterceptMarkdown } from './intercepts.ts';
import {
  loadStorybookAiMetadata,
  resolveStorybookConfigDir,
  type StorybookAiMetadata,
} from './local-metadata.ts';
import { readRegistry } from './registry.ts';
import { resolveInstance } from './resolve-instance.ts';
import { parsePort, parseToolArgs } from './tool-args.ts';
import { ToolCallResultSchema } from './types.ts';
import type {
  InterceptReason,
  McpToolDescriptor,
  StorybookInstanceRecord,
  ToolCallResult,
} from './types.ts';

/**
 * Why an invocation failed before any command executed, for the `ai-command` telemetry event
 * (storybookjs/storybook#35131). Extends the instance-resolution intercepts with the two CLI-level
 * cases: arguments that never parsed, and command names the server does not provide.
 */
export type AiCommandInterceptReason = InterceptReason | 'invalid-arguments' | 'unknown-command';

/**
 * Telemetry-facing classification of a run. `help` marks lookups via `--help` flags, which are not
 * command executions and are excluded from the `ai-command` event so they cannot skew command
 * success rates. `error` carries command failures for the standard sanitized error path.
 */
export type AiCommandOutcome =
  | { kind: 'success' }
  | { kind: 'help' }
  | { kind: 'intercept'; reason: AiCommandInterceptReason }
  | { kind: 'error'; error: unknown };

export type AiToolRunResult = { exitCode: 0 | 1; output: string; outcome: AiCommandOutcome };

/**
 * The command executed and reported an error result. The message is deliberately
 * constant — the result text is arbitrary tool output (often containing project paths), and a
 * constant message keeps the telemetry error hash stable and aggregatable. The tool's error text
 * travels as `cause` instead, which the standard error path only uploads — path-sanitized — when
 * the user opted into crash reports.
 */
class McpToolResultError extends Error {
  constructor(options?: ErrorOptions) {
    super('The Storybook AI command returned an error result', options);
    this.name = 'McpToolResultError';
  }
}

class LocalAiToolError extends Error {
  constructor(options?: ErrorOptions) {
    super('The Storybook local AI command failed', options);
    this.name = 'LocalAiToolError';
  }
}

/** Injectable dependencies for tests. */
export type AiToolRunDeps = {
  registryDir?: string;
  fetchImpl?: typeof fetch;
  loadStorybookAiMetadata?: typeof loadStorybookAiMetadata;
};

export type AiToolOptions = {
  /** Project directory of the target Storybook; defaults to `process.cwd()`. */
  cwd?: string;
  /** Directory where to load Storybook configuration from; relative paths resolve from `cwd`. */
  configDir?: string;
  /** Port of the target Storybook, to address one specific instance when several share the cwd. */
  port?: string;
  /** Raw JSON object with tool arguments (escape hatch for complex values). */
  json?: string;
};

/**
 * Run a Storybook AI command and return its result as markdown. Commands exposed as local metadata
 * run without a dev server; runtime-bound commands still go through the running Storybook MCP
 * server and use the same repair-instruction markdown as `@storybook/mcp-proxy`.
 */
export async function runAiTool(
  toolName: string,
  toolArgTokens: string[],
  options: AiToolOptions = {},
  deps: AiToolRunDeps = {}
): Promise<AiToolRunResult> {
  const parsed = parseToolArgs(toolArgTokens, {
    json: options.json,
  });
  if (!parsed.ok) {
    return {
      exitCode: 1,
      output: parsed.error,
      outcome: { kind: 'intercept', reason: 'invalid-arguments' },
    };
  }
  if (parsed.help) {
    return toolHelp(toolName, options.cwd, options.configDir, deps);
  }

  const toolLookup = await lookupAiTool(toolName, options.cwd, options.configDir, deps);
  switch (toolLookup.kind) {
    case 'local':
      return runLocalAiTool(toolLookup.localTool, parsed.args);
    case 'result':
      return toolLookup.result;
    case 'runtime':
      break;
    default: {
      const exhaustive: never = toolLookup;
      return exhaustive;
    }
  }

  const parsedPort = parsePort(options.port);
  if (!parsedPort.ok) {
    return {
      exitCode: 1,
      output: parsedPort.error,
      outcome: { kind: 'intercept', reason: 'invalid-arguments' },
    };
  }

  const resolution = await resolveReadyInstance(options.cwd, parsedPort.port, deps);
  if (resolution.kind === 'error') {
    return {
      exitCode: 1,
      output: resolution.output,
      outcome: { kind: 'intercept', reason: resolution.reason },
    };
  }
  const { record, matches } = resolution;

  try {
    const result = await callMcpTool(
      record,
      { name: toolName, arguments: parsed.args },
      deps.fetchImpl
    );
    if (result.isError) {
      // addon-mcp reports unknown tools as an error *result* rather than a JSON-RPC error.
      const unknownTool = await describeUnknownTool(record, toolName, deps.fetchImpl);
      if (unknownTool) {
        return {
          exitCode: 1,
          output: unknownTool,
          outcome: { kind: 'intercept', reason: 'unknown-command' },
        };
      }
    }
    const siblings = matches.filter((r) => r !== record);
    const toolOutput = formatToolResult(result);
    const sections = [
      ...(siblings.length > 0 ? [formatMultiInstanceWarning(record, siblings)] : []),
      toolOutput,
    ];
    const output = sections.join('\n\n');
    if (result.isError) {
      return {
        exitCode: 1,
        output,
        outcome: { kind: 'error', error: new McpToolResultError({ cause: toolOutput }) },
      };
    }
    return { exitCode: 0, output, outcome: { kind: 'success' } };
  } catch (error) {
    if (error instanceof McpJsonRpcError) {
      const unknownTool = await describeUnknownTool(record, toolName, deps.fetchImpl);
      if (unknownTool) {
        return {
          exitCode: 1,
          output: unknownTool,
          outcome: { kind: 'intercept', reason: 'unknown-command' },
        };
      }
      return { exitCode: 1, output: error.message, outcome: { kind: 'error', error } };
    }
    return {
      exitCode: 1,
      output: formatServerUnreachable(record, error),
      outcome: { kind: 'error', error },
    };
  }
}

/**
 * Build the "Storybook commands" help section from Storybook config metadata, appended to
 * `storybook ai --help`. Help must never fail, so any error degrades to a short note explaining why
 * no commands are listed.
 */
export async function buildStorybookCommandsHelp(
  options: AiToolOptions = {},
  deps: AiToolRunDeps = {}
): Promise<string> {
  const unavailable = (note: string) => `Storybook commands: (unavailable — ${note})`;

  const metadataResult = await loadLocalMetadata(options.cwd, options.configDir, deps);
  if (metadataResult.kind === 'error') {
    return unavailable(
      `the Storybook config at ${metadataResult.configDir} could not be loaded: ${formatErrorMessage(
        metadataResult.error
      )}`
    );
  }
  const { metadata, configDir } = metadataResult;
  if (!metadata) {
    return unavailable(formatMetadataMissingHelp(configDir));
  }
  const { tools } = metadata;
  if (tools.length === 0) {
    return unavailable(`the Storybook config at ${configDir} provides no commands`);
  }

  const width = Math.max(...tools.map((tool) => tool.name.length)) + 2;
  const localToolNames = getLocalToolNames(metadata);
  const lines = tools.map((tool) => {
    const mode = localToolNames.has(tool.name) ? '[local]' : '[requires Storybook]';
    const summary = tool.description?.trim().split('\n')[0] ?? '';
    return `  ${tool.name.padEnd(width)}${mode.padEnd(21)}${summary}`;
  });
  const { instructions } = metadata;
  const trimmedInstructions = instructions?.trim();
  const sections = [`Storybook help from the Storybook configuration at ${configDir}:`, ''];
  if (trimmedInstructions) {
    sections.push('# Storybook workflow instructions', '', trimmedInstructions, '');
  }

  sections.push(
    '# Storybook commands',
    '',
    ...lines,
    '',
    '[local] commands run from configuration metadata without a running Storybook.',
    '[requires Storybook] commands are forwarded to the running Storybook server.',
    '',
    `Run 'storybook ai <command> --help' for a command's description and arguments.`
  );
  return sections.join('\n');
}

/** Show the description and arguments of a single command (`storybook ai <command> --help`). */
export async function runAiToolHelp(
  toolName: string,
  options: AiToolOptions = {},
  deps: AiToolRunDeps = {}
): Promise<AiToolRunResult> {
  return toolHelp(toolName, options.cwd, options.configDir, deps);
}

/** All paths are help lookups, so every outcome is `help` regardless of success. */
async function toolHelp(
  toolName: string,
  cwd: string | undefined,
  configDir: string | undefined,
  deps: AiToolRunDeps
): Promise<AiToolRunResult> {
  const outcome: AiCommandOutcome = { kind: 'help' };

  const metadataResult = await loadLocalMetadata(cwd, configDir, deps);
  if (metadataResult.kind === 'error') {
    return metadataLoadFailureResult(metadataResult, outcome);
  }
  const { metadata } = metadataResult;
  if (!metadata) {
    return metadataMissingResult(metadataResult.configDir, outcome);
  }
  const { tools } = metadata;

  const tool = tools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    return {
      exitCode: 1,
      output: formatUnknownMetadataTool(toolName, tools, metadataResult.configDir),
      outcome,
    };
  }
  return {
    exitCode: 0,
    output: formatToolHelp(tool, { local: getLocalToolNames(metadata).has(tool.name) }),
    outcome,
  };
}

type StorybookAiLocalTool = NonNullable<StorybookAiMetadata['localTools']>[string];

type AiToolLookup =
  | { kind: 'local'; localTool: StorybookAiLocalTool }
  | { kind: 'runtime' }
  | { kind: 'result'; result: AiToolRunResult };

async function lookupAiTool(
  toolName: string,
  cwd: string | undefined,
  configDir: string | undefined,
  deps: AiToolRunDeps
): Promise<AiToolLookup> {
  const metadataResult = await loadLocalMetadata(cwd, configDir, deps);
  if (metadataResult.kind === 'error') {
    return {
      kind: 'result',
      result: metadataLoadFailureResult(metadataResult, {
        kind: 'error',
        error: new LocalAiToolError({ cause: metadataResult.error }),
      }),
    };
  }

  const { metadata } = metadataResult;
  if (!metadata) {
    return {
      kind: 'result',
      result: metadataMissingResult(metadataResult.configDir, {
        kind: 'intercept',
        reason: 'addon-missing',
      }),
    };
  }

  const visibleTool = metadata.tools.find((tool) => tool.name === toolName);
  if (!visibleTool) {
    return {
      kind: 'result',
      result: {
        exitCode: 1,
        output: formatUnknownMetadataTool(toolName, metadata.tools, metadataResult.configDir),
        outcome: { kind: 'intercept', reason: 'unknown-command' },
      },
    };
  }

  const localTool = metadata.localTools?.[toolName];
  if (!localTool) {
    return { kind: 'runtime' };
  }

  return { kind: 'local', localTool };
}

async function runLocalAiTool(
  localTool: StorybookAiLocalTool,
  args: Record<string, unknown>
): Promise<AiToolRunResult> {
  try {
    const rawResult = await localTool.call(args);
    const parsedResult = v.safeParse(ToolCallResultSchema, rawResult);
    if (!parsedResult.success) {
      return {
        exitCode: 1,
        output: 'The Storybook local AI command returned an unexpected response shape',
        outcome: {
          kind: 'error',
          error: new LocalAiToolError({ cause: parsedResult.issues }),
        },
      };
    }
    const result = parsedResult.output;
    const output = formatToolResult(result);
    if (result.isError) {
      return {
        exitCode: 1,
        output,
        outcome: { kind: 'error', error: new McpToolResultError({ cause: output }) },
      };
    }
    return { exitCode: 0, output, outcome: { kind: 'success' } };
  } catch (error) {
    return {
      exitCode: 1,
      output: error instanceof Error ? error.message : String(error),
      outcome: { kind: 'error', error: new LocalAiToolError({ cause: error }) },
    };
  }
}

async function loadLocalMetadata(
  cwd: string | undefined,
  configDir: string | undefined,
  deps: AiToolRunDeps
): Promise<LocalMetadataResult> {
  const resolvedCwd = resolve(cwd ?? process.cwd());
  const resolvedConfigDir = resolveStorybookConfigDir({ cwd: resolvedCwd, configDir });
  const loadMetadata = deps.loadStorybookAiMetadata ?? loadStorybookAiMetadata;
  try {
    return {
      kind: 'ok',
      cwd: resolvedCwd,
      configDir: resolvedConfigDir,
      metadata: await loadMetadata({ cwd: resolvedCwd, configDir: resolvedConfigDir }),
    };
  } catch (error) {
    return { kind: 'error', cwd: resolvedCwd, configDir: resolvedConfigDir, error };
  }
}

type LocalMetadataResult =
  | { kind: 'ok'; cwd: string; configDir: string; metadata: StorybookAiMetadata | undefined }
  | { kind: 'error'; cwd: string; configDir: string; error: unknown };

function metadataLoadFailureResult(
  metadataResult: Extract<LocalMetadataResult, { kind: 'error' }>,
  outcome: AiCommandOutcome
): AiToolRunResult {
  return {
    exitCode: 1,
    output: `Storybook command metadata is unavailable for ${
      metadataResult.configDir
    }: ${formatErrorMessage(metadataResult.error)}`,
    outcome,
  };
}

function metadataMissingResult(configDir: string, outcome: AiCommandOutcome): AiToolRunResult {
  return {
    exitCode: 1,
    output: `Storybook command metadata is unavailable for ${configDir}. Install or upgrade \`@storybook/addon-mcp\`.`,
    outcome,
  };
}

function formatMetadataMissingHelp(configDir: string): string {
  return `the Storybook config at ${configDir} does not expose AI command metadata — install or upgrade \`@storybook/addon-mcp\``;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatServerUnreachable(record: StorybookInstanceRecord, error: unknown): string {
  return `Failed to reach the Storybook server at ${record.mcp.endpoint ?? '(no endpoint)'}: ${
    error instanceof Error ? error.message : String(error)
  }`;
}

type InstanceResolution =
  | { kind: 'ok'; record: StorybookInstanceRecord; matches: StorybookInstanceRecord[] }
  | {
      kind: 'error';
      output: string;
      reason: InterceptReason;
    };

/**
 * Resolve the running Storybook instance for `cwdInput` via the registry. No version or
 * installed checks: the CLI is invoked as `npx storybook`, so the fact that it is executing
 * already proves the project has a compatible Storybook.
 */
async function resolveReadyInstance(
  cwdInput: string | undefined,
  port: number | undefined,
  deps: AiToolRunDeps
): Promise<InstanceResolution> {
  const cwd = resolve(cwdInput ?? process.cwd());

  const records = await readRegistry(deps.registryDir);
  const resolution = resolveInstance(records, cwd, port);

  if (resolution.kind === 'intercept') {
    return {
      kind: 'error',
      output: getInterceptMarkdown(resolution.reason, { records: resolution.records, port }),
      reason: resolution.reason,
    };
  }

  return { kind: 'ok', record: resolution.record, matches: resolution.matches };
}

/**
 * Build the "unknown tool" error listing the available tools, or null when the tool does exist
 * (the JSON-RPC error had another cause) or the tool list cannot be fetched.
 */
async function describeUnknownTool(
  record: StorybookInstanceRecord,
  toolName: string,
  fetchImpl?: typeof fetch
): Promise<string | null> {
  let tools: McpToolDescriptor[];
  try {
    tools = await listMcpTools(record, fetchImpl);
  } catch {
    return null;
  }
  if (tools.some((tool) => tool.name === toolName)) {
    return null;
  }
  return formatUnknownTool(toolName, tools, `The Storybook running at ${record.url}`);
}

function formatUnknownTool(toolName: string, tools: McpToolDescriptor[], source: string): string {
  return `Unknown command \`${toolName}\`. ${source} provides:

${tools.map((tool) => `- \`${tool.name}\``).join('\n')}

Run \`storybook ai --help\` for all commands, or \`storybook ai <command> --help\` for a command's arguments.`;
}

function formatUnknownMetadataTool(
  toolName: string,
  tools: McpToolDescriptor[],
  configDir: string
): string {
  return formatUnknownTool(toolName, tools, `The Storybook configuration at ${configDir}`);
}

/** Render a tools/call result as markdown: text content verbatim, other content as JSON blocks. */
function formatToolResult(result: ToolCallResult): string {
  const content = result.content ?? [];
  if (content.length === 0) {
    return '(the command returned no content)';
  }
  return content
    .map((item) =>
      item.type === 'text' && typeof item.text === 'string'
        ? item.text
        : `\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\``
    )
    .join('\n\n');
}

function getLocalToolNames(metadata: StorybookAiMetadata): Set<string> {
  return new Set(Object.keys(metadata.localTools ?? {}));
}

function formatToolHelp(tool: McpToolDescriptor, { local }: { local: boolean }): string {
  const lines = [`Usage: storybook ai ${tool.name} [--key value ...]`];
  if (tool.description) {
    lines.push('', tool.description.trim());
  }
  lines.push(
    '',
    local
      ? 'Execution: local (no running Storybook required).'
      : 'Execution: requires a running Storybook.'
  );
  const properties = Object.entries(tool.inputSchema?.properties ?? {});
  if (properties.length > 0) {
    const required = new Set(tool.inputSchema?.required ?? []);
    lines.push(
      '',
      'Arguments:',
      ...properties.map(([name, schema]) => {
        const meta = [schema.type, required.has(name) ? 'required' : undefined]
          .filter(Boolean)
          .join(', ');
        const description = schema.description ? `: ${schema.description}` : '';
        return `- \`--${name}\`${meta ? ` (${meta})` : ''}${description}`;
      })
    );
  }
  return lines.join('\n');
}

function formatMultiInstanceWarning(
  chosen: StorybookInstanceRecord,
  siblings: StorybookInstanceRecord[]
): string {
  const all = [chosen, ...siblings];
  const lines = all.map((r) => {
    const marker = r === chosen ? ' (used)' : '';
    return `> - pid \`${r.pid}\` at ${r.url} (status: \`${r.mcp.status}\`)${marker}`;
  });
  return `> Warning: Multiple Storybook instances are running at this cwd. This call was sent to pid \`${chosen.pid}\`.
>
> Instances at \`${chosen.cwd}\`:
${lines.join('\n')}
>
> If results look unexpected, ask the user whether they want to stop the other instance(s).`;
}
