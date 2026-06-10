import { resolve } from 'node:path';

import { McpJsonRpcError, callMcpTool, listMcpTools } from './client.ts';
import { getInterceptMarkdown } from './intercepts.ts';
import { readRegistry } from './registry.ts';
import { resolveInstance } from './resolve-instance.ts';
import { parseToolArgs } from './tool-args.ts';
import type {
  InterceptReason,
  McpToolDescriptor,
  StorybookInstanceRecord,
  ToolCallResult,
} from './types.ts';
import {
  STORYBOOK_MIN_VERSION,
  checkStorybookVersion,
  classifyStorybookVersion,
} from './version-check.ts';

export type AiToolRunResult = { exitCode: 0 | 1; output: string };

/** Injectable dependencies for tests. */
export type AiToolRunDeps = {
  registryDir?: string;
  fetchImpl?: typeof fetch;
};

export type AiToolOptions = {
  /** Project directory of the target Storybook; defaults to `process.cwd()`. */
  cwd?: string;
  /** Port of the target Storybook, to address one specific instance when several share the cwd. */
  port?: string;
  /** Raw JSON object with tool arguments (escape hatch for complex values). */
  json?: string;
};

/**
 * Run a single MCP tool against the Storybook running at the target cwd and return its result as
 * markdown. Intercept conditions (no running instance, addon missing, version too old, ...) return
 * the same repair-instruction markdown as `@storybook/mcp-proxy`, with exit code 1.
 */
export async function runAiTool(
  toolName: string,
  toolArgTokens: string[],
  options: AiToolOptions = {},
  deps: AiToolRunDeps = {}
): Promise<AiToolRunResult> {
  const parsed = parseToolArgs(toolArgTokens, {
    cwd: options.cwd,
    port: options.port,
    json: options.json,
  });
  if (!parsed.ok) {
    return { exitCode: 1, output: parsed.error };
  }
  if (parsed.help) {
    return toolHelp(toolName, parsed.cwd, parsed.port, deps);
  }

  const resolution = await resolveReadyInstance(parsed.cwd, parsed.port, deps);
  if (resolution.kind === 'error') {
    return { exitCode: 1, output: resolution.output };
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
        return { exitCode: 1, output: unknownTool };
      }
    }
    const siblings = matches.filter((r) => r !== record);
    const sections = [
      ...(siblings.length > 0 ? [formatMultiInstanceWarning(record, siblings)] : []),
      formatToolResult(result),
    ];
    return { exitCode: result.isError ? 1 : 0, output: sections.join('\n\n') };
  } catch (error) {
    if (error instanceof McpJsonRpcError) {
      const unknownTool = await describeUnknownTool(record, toolName, deps.fetchImpl);
      return { exitCode: 1, output: unknownTool ?? error.message };
    }
    return { exitCode: 1, output: formatServerUnreachable(record, error) };
  }
}

/**
 * Build the "Storybook commands" help section listing the commands provided by the running
 * Storybook, appended to `storybook ai --help`. Help must never fail, so any error degrades to a
 * short note explaining why no commands are listed.
 */
export async function buildStorybookCommandsHelp(
  options: AiToolOptions = {},
  deps: AiToolRunDeps = {}
): Promise<string> {
  const unavailable = (note: string) => `Storybook commands: (unavailable — ${note})`;

  const parsed = parseToolArgs([], { cwd: options.cwd, port: options.port });
  if (!parsed.ok) {
    return unavailable(parsed.error);
  }

  const resolution = await resolveReadyInstance(parsed.cwd, parsed.port, deps);
  if (resolution.kind === 'error') {
    return unavailable(helpUnavailableNote(resolution, parsed.port));
  }
  const { record, matches } = resolution;

  let tools: McpToolDescriptor[];
  try {
    tools = await listMcpTools(record, deps.fetchImpl);
  } catch {
    return unavailable(`the Storybook at ${record.url} could not be reached`);
  }
  if (tools.length === 0) {
    return unavailable(`the Storybook at ${record.url} provides no commands`);
  }

  const siblingPorts = matches.filter((r) => r !== record).map((r) => r.port);
  const siblingNote =
    siblingPorts.length > 0
      ? [
          `(${matches.length} instances are running at this cwd — using the most recently started, port ${record.port}; other ports: ${siblingPorts.join(', ')}. Pass \`--port\` to target a specific one.)`,
        ]
      : [];

  const width = Math.max(...tools.map((tool) => tool.name.length)) + 2;
  const lines = tools.map((tool) => {
    const summary = tool.description?.trim().split('\n')[0] ?? '';
    return `  ${tool.name.padEnd(width)}${summary}`;
  });
  return [
    `Storybook commands (from the Storybook running at ${record.url}):`,
    ...siblingNote,
    ...lines,
    '',
    `Run 'storybook ai <command> --help' for a command's description and arguments.`,
  ].join('\n');
}

/** One-line reason why the help section cannot list commands, accurate per intercept. */
function helpUnavailableNote(
  error: Extract<InstanceResolution, { kind: 'error' }>,
  port: number | undefined
): string {
  switch (error.reason) {
    case 'no-instance':
    case 'storybook-not-installed':
      return 'no running Storybook detected at this cwd; start `storybook dev` to list its commands';
    case 'port-mismatch':
      return `no instance on port \`${port}\` at this cwd — running ports: ${error.records
        .map((r) => r.port)
        .join(', ')}`;
    case 'mcp-starting':
      return 'the Storybook at this cwd is still starting up; retry in a moment';
    case 'addon-missing':
      return 'the running Storybook does not provide commands — install `@storybook/addon-mcp`';
    case 'mcp-error':
      return "the running Storybook's command server reported an error";
    case 'storybook-too-old':
      return `the installed Storybook is too old for these commands (requires ${STORYBOOK_MIN_VERSION} or newer)`;
    default: {
      const unhandled: never = error.reason;
      throw new Error(`Unhandled intercept reason: ${unhandled as string}`);
    }
  }
}

/** Show the description and arguments of a single command (`storybook ai <command> --help`). */
export async function runAiToolHelp(
  toolName: string,
  options: AiToolOptions = {},
  deps: AiToolRunDeps = {}
): Promise<AiToolRunResult> {
  const parsed = parseToolArgs([], { cwd: options.cwd, port: options.port });
  if (!parsed.ok) {
    return { exitCode: 1, output: parsed.error };
  }
  return toolHelp(toolName, parsed.cwd, parsed.port, deps);
}

async function toolHelp(
  toolName: string,
  cwd: string | undefined,
  port: number | undefined,
  deps: AiToolRunDeps
): Promise<AiToolRunResult> {
  const resolution = await resolveReadyInstance(cwd, port, deps);
  if (resolution.kind === 'error') {
    return { exitCode: 1, output: resolution.output };
  }
  const { record } = resolution;

  let tools: McpToolDescriptor[];
  try {
    tools = await listMcpTools(record, deps.fetchImpl);
  } catch (error) {
    return { exitCode: 1, output: formatServerUnreachable(record, error) };
  }

  const tool = tools.find((candidate) => candidate.name === toolName);
  if (!tool) {
    return { exitCode: 1, output: formatUnknownTool(toolName, tools, record) };
  }
  return { exitCode: 0, output: formatToolHelp(tool) };
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
      records: StorybookInstanceRecord[];
    };

/**
 * Resolve the running Storybook instance for `cwdInput`, mirroring the mcp-proxy dispatch order:
 * registry lookup and cwd/port matching first, then the version check — preferring the version the
 * running instance reported in its registry record over resolving the installed version from disk.
 */
async function resolveReadyInstance(
  cwdInput: string | undefined,
  port: number | undefined,
  deps: AiToolRunDeps
): Promise<InstanceResolution> {
  const cwd = resolve(cwdInput ?? process.cwd());

  const records = await readRegistry(deps.registryDir);
  const resolution = resolveInstance(records, cwd, port);

  const matchedRecord = resolution.kind === 'instance' ? resolution.record : resolution.matches[0];
  const versionStatus =
    matchedRecord?.storybookVersion !== undefined
      ? classifyStorybookVersion(matchedRecord.storybookVersion)
      : checkStorybookVersion(cwd);

  if (versionStatus.status === 'too-old') {
    return {
      kind: 'error',
      output: getInterceptMarkdown('storybook-too-old', { version: versionStatus.version }),
      reason: 'storybook-too-old',
      records: [],
    };
  }

  if (resolution.kind === 'intercept') {
    if (
      resolution.reason === 'no-instance' &&
      versionStatus.status === 'not-installed' &&
      (resolution.records?.length ?? 0) === 0
    ) {
      return {
        kind: 'error',
        output: getInterceptMarkdown('storybook-not-installed'),
        reason: 'storybook-not-installed',
        records: [],
      };
    }
    return {
      kind: 'error',
      output: getInterceptMarkdown(resolution.reason, { records: resolution.records, port }),
      reason: resolution.reason,
      records: resolution.records ?? [],
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
  return formatUnknownTool(toolName, tools, record);
}

function formatUnknownTool(
  toolName: string,
  tools: McpToolDescriptor[],
  record: StorybookInstanceRecord
): string {
  return `Unknown command \`${toolName}\`. The Storybook running at ${record.url} provides:

${tools.map((tool) => `- \`${tool.name}\``).join('\n')}

Run \`storybook ai --help\` for all commands, or \`storybook ai <command> --help\` for a command's arguments.`;
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

function formatToolHelp(tool: McpToolDescriptor): string {
  const lines = [`Usage: storybook ai ${tool.name} [--key value ...]`];
  if (tool.description) {
    lines.push('', tool.description.trim());
  }
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
