import type { McpToolDescriptor, StorybookInstanceRecord, ToolCallResult } from './types.ts';

/**
 * Marks the request as coming from a trusted local Storybook client. `@storybook/addon-mcp` uses
 * this header to skip auth flows meant for remote (composed) Storybooks.
 */
const STORYBOOK_MCP_PROXY_HEADER = 'X-Storybook-MCP-Proxy';
const STORYBOOK_MCP_PROXY_HEADER_VALUE = 'true';

export type ToolCallParams = {
  name: string;
  arguments?: Record<string, unknown>;
};

/** A JSON-RPC level error returned by the Storybook MCP server (e.g. unknown tool). */
export class McpJsonRpcError extends Error {
  constructor(
    public readonly code: number,
    message: string
  ) {
    super(`Storybook MCP error ${code}: ${message}`);
    this.name = 'McpJsonRpcError';
  }
}

/** Forward an MCP `tools/call` JSON-RPC request to a local Storybook MCP server. */
export async function callMcpTool(
  record: StorybookInstanceRecord,
  params: ToolCallParams,
  fetchImpl: typeof fetch = fetch
): Promise<ToolCallResult> {
  return (await sendJsonRpcRequest(record, 'tools/call', params, fetchImpl)) as ToolCallResult;
}

/** List the tools exposed by a local Storybook MCP server via `tools/list`. */
export async function listMcpTools(
  record: StorybookInstanceRecord,
  fetchImpl: typeof fetch = fetch
): Promise<McpToolDescriptor[]> {
  const result = (await sendJsonRpcRequest(record, 'tools/list', {}, fetchImpl)) as {
    tools?: McpToolDescriptor[];
  };
  return result.tools ?? [];
}

/**
 * Send a single JSON-RPC request to the instance's MCP endpoint over HTTP.
 *
 * The downstream is `@storybook/addon-mcp` at `record.mcp.endpoint`. tmcp's HttpTransport
 * hardcodes `text/event-stream` for any request with an id, so we accept both content-types and
 * parse the SSE envelope when needed. Every call is independent; no session bookkeeping needed.
 */
async function sendJsonRpcRequest(
  record: StorybookInstanceRecord,
  method: 'tools/call' | 'tools/list',
  params: unknown,
  fetchImpl: typeof fetch
): Promise<unknown> {
  const endpoint = record.mcp.endpoint;
  if (!endpoint) {
    throw new Error(`Storybook MCP record for ${record.cwd} is missing mcp.endpoint`);
  }

  const target = new URL(endpoint, record.url).href;

  const response = await fetchImpl(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      [STORYBOOK_MCP_PROXY_HEADER]: STORYBOOK_MCP_PROXY_HEADER_VALUE,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Storybook MCP at ${target} responded with ${response.status} ${response.statusText}`
    );
  }

  const payload = (await readJsonRpcResponse(response, target)) as {
    result?: unknown;
    error?: { code: number; message: string };
  };

  if (payload.error) {
    throw new McpJsonRpcError(payload.error.code, payload.error.message);
  }
  if (!payload.result) {
    throw new Error('Storybook MCP returned no result');
  }
  return payload.result;
}

async function readJsonRpcResponse(response: Response, endpoint: string): Promise<unknown> {
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();

  if (contentType.includes('application/json')) {
    return await response.json();
  }

  if (contentType.includes('text/event-stream')) {
    return parseSseEnvelope(await response.text(), endpoint);
  }

  throw new Error(
    `Storybook MCP at ${endpoint} returned unsupported content-type "${contentType}". Expected application/json or text/event-stream.`
  );
}

/**
 * Parse an MCP Streamable HTTP SSE response containing a single JSON-RPC envelope. Format per the
 * SSE spec: lines starting with `data:` hold payload bytes; multiple `data:` lines in one event
 * are joined with `\n`; the event terminates at the first blank line. We only care about the first
 * event because a tools/call or tools/list response is always a single message.
 */
function parseSseEnvelope(body: string, endpoint: string): unknown {
  const dataLines: string[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith('data:')) {
      const value = line.slice(5);
      dataLines.push(value.startsWith(' ') ? value.slice(1) : value);
      continue;
    }
    if (line === '' && dataLines.length > 0) {
      break;
    }
  }
  if (dataLines.length === 0) {
    throw new Error(`Storybook MCP at ${endpoint} returned an SSE response with no data event`);
  }
  try {
    return JSON.parse(dataLines.join('\n'));
  } catch (error) {
    throw new Error(
      `Storybook MCP at ${endpoint} returned an SSE event whose data could not be parsed as JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
