import { resolve } from 'node:path';

import { McpJsonRpcError, callMcpTool, listMcpTools } from './client.ts';
import { getInterceptMarkdown } from './intercepts.ts';
import { readRegistry } from './registry.ts';
import { resolveInstance } from './resolve-instance.ts';
import { parseToolArgs } from './tool-args.ts';
import type { McpToolDescriptor, StorybookInstanceRecord, ToolCallResult } from './types.ts';
import { checkStorybookVersion } from './version-check.ts';

export type AiToolRunResult = { exitCode: 0 | 1; output: string };

/** Injectable dependencies for tests. */
export type AiToolRunDeps = {
  registryDir?: string;
  fetchImpl?: typeof fetch;
};

export type AiToolOptions = {
  /** Project directory of the target Storybook; defaults to `process.cwd()`. */
  cwd?: string;
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
  const parsed = parseToolArgs(toolArgTokens, { cwd: options.cwd, json: options.json });
  if (!parsed.ok) {
    return { exitCode: 1, output: parsed.error };
  }

  const resolution = await resolveReadyInstance(parsed.cwd, deps);
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
    return {
      exitCode: 1,
      output: `Failed to reach Storybook MCP at ${record.mcp.endpoint ?? '(no endpoint)'}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/** List the MCP tools exposed by the Storybook running at the target cwd. */
export async function runAiListTools(
  options: AiToolOptions = {},
  deps: AiToolRunDeps = {}
): Promise<AiToolRunResult> {
  const resolution = await resolveReadyInstance(options.cwd, deps);
  if (resolution.kind === 'error') {
    return { exitCode: 1, output: resolution.output };
  }
  const { record } = resolution;

  try {
    const tools = await listMcpTools(record, deps.fetchImpl);
    return { exitCode: 0, output: formatToolList(tools, record) };
  } catch (error) {
    return {
      exitCode: 1,
      output: `Failed to reach Storybook MCP at ${record.mcp.endpoint ?? '(no endpoint)'}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

type InstanceResolution =
  | { kind: 'ok'; record: StorybookInstanceRecord; matches: StorybookInstanceRecord[] }
  | { kind: 'error'; output: string };

/**
 * Resolve the running Storybook instance for `cwdInput`, mirroring the mcp-proxy dispatch order:
 * version check first (fail fast on too-old), then registry lookup and cwd matching.
 */
async function resolveReadyInstance(
  cwdInput: string | undefined,
  deps: AiToolRunDeps
): Promise<InstanceResolution> {
  const cwd = resolve(cwdInput ?? process.cwd());

  const versionStatus = checkStorybookVersion(cwd);
  if (versionStatus.status === 'too-old') {
    return {
      kind: 'error',
      output: getInterceptMarkdown('storybook-too-old', { version: versionStatus.version }),
    };
  }

  const records = await readRegistry(deps.registryDir);
  const resolution = resolveInstance(records, cwd);

  if (resolution.kind === 'intercept') {
    if (
      resolution.reason === 'no-instance' &&
      versionStatus.status === 'not-installed' &&
      (resolution.records?.length ?? 0) === 0
    ) {
      return { kind: 'error', output: getInterceptMarkdown('storybook-not-installed') };
    }
    return {
      kind: 'error',
      output: getInterceptMarkdown(resolution.reason, { records: resolution.records }),
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
  return `Unknown tool \`${toolName}\`. The Storybook at ${record.url} exposes:

${tools.map((tool) => `- \`${tool.name}\``).join('\n')}

Run \`storybook ai list-tools\` for descriptions and arguments.`;
}

/** Render a tools/call result as markdown: text content verbatim, other content as JSON blocks. */
function formatToolResult(result: ToolCallResult): string {
  return (result.content ?? [])
    .map((item) =>
      item.type === 'text' && typeof item.text === 'string'
        ? item.text
        : `\`\`\`json\n${JSON.stringify(item, null, 2)}\n\`\`\``
    )
    .join('\n\n');
}

function formatToolList(tools: McpToolDescriptor[], record: StorybookInstanceRecord): string {
  if (tools.length === 0) {
    return `The Storybook at ${record.url} exposes no MCP tools.`;
  }

  const sections = tools.map((tool) => {
    const lines = [`## ${tool.name}`];
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
  });

  return [`# MCP tools exposed by the Storybook at ${record.url}`, ...sections].join('\n\n');
}

function formatMultiInstanceWarning(
  chosen: StorybookInstanceRecord,
  siblings: StorybookInstanceRecord[]
): string {
  const all = [chosen, ...siblings].sort((a, b) => a.pid - b.pid);
  const lines = all.map((r) => {
    const marker = r === chosen ? ' (used)' : '';
    return `> - pid \`${r.pid}\` at ${r.url} (mcp: \`${r.mcp.status}\`)${marker}`;
  });
  return `> Warning: Multiple Storybook instances are running at this cwd. This call was sent to pid \`${chosen.pid}\`.
>
> Instances at \`${chosen.cwd}\`:
${lines.join('\n')}
>
> If results look unexpected, ask the user whether they want to stop the other instance(s).`;
}
