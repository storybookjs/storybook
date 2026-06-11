import { versions } from 'storybook/internal/common';

import * as v from 'valibot';

import {
  type McpToolDescriptor,
  McpToolDescriptorSchema,
  type StorybookInstanceRecord,
  type ToolCallResult,
  ToolCallResultSchema,
} from './types.ts';

/**
 * Marks the request as coming from a trusted local Storybook client. `@storybook/addon-mcp` uses
 * this header to skip auth flows meant for remote (composed) Storybooks.
 */
const STORYBOOK_MCP_PROXY_HEADER = 'X-Storybook-MCP-Proxy';
const STORYBOOK_MCP_PROXY_HEADER_VALUE = 'true';

/**
 * Upper bound on a single request so a hung server cannot stall the CLI forever. Generous because
 * `run-story-tests` on a full suite legitimately runs for minutes.
 */
const REQUEST_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Identifies the CLI on the MCP connection, so `@storybook/addon-mcp`'s server-side `tool:*`
 * telemetry can segment CLI-originated calls from agents connected over MCP directly
 * (storybookjs/storybook#35131).
 */
export const MCP_CLIENT_INFO = { name: 'storybook-cli', version: versions.storybook };

/** Protocol version sent on `initialize`; tmcp (the addon-mcp server library) supports it. */
const MCP_PROTOCOL_VERSION = '2025-06-18';

/**
 * The handshake is telemetry garnish: it must never delay or fail the actual command, so it gets
 * a short timeout instead of {@link REQUEST_TIMEOUT_MS}.
 */
const INITIALIZE_TIMEOUT_MS = 10 * 1000;

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
    super(`Storybook server error ${code}: ${message}`);
    this.name = 'McpJsonRpcError';
  }
}

const JsonRpcEnvelopeSchema = v.looseObject({
  result: v.optional(v.unknown()),
  error: v.optional(v.looseObject({ code: v.number(), message: v.string() })),
});

const ToolListResultSchema = v.looseObject({
  tools: v.optional(v.array(McpToolDescriptorSchema)),
});

/** Forward an MCP `tools/call` JSON-RPC request to a local Storybook MCP server. */
export async function callMcpTool(
  record: StorybookInstanceRecord,
  params: ToolCallParams,
  fetchImpl: typeof fetch = fetch
): Promise<ToolCallResult> {
  return sendJsonRpcRequest(record, 'tools/call', params, ToolCallResultSchema, fetchImpl);
}

/** List the tools exposed by a local Storybook MCP server via `tools/list`. */
export async function listMcpTools(
  record: StorybookInstanceRecord,
  fetchImpl: typeof fetch = fetch
): Promise<McpToolDescriptor[]> {
  const result = await sendJsonRpcRequest(
    record,
    'tools/list',
    {},
    ToolListResultSchema,
    fetchImpl
  );
  return result.tools ?? [];
}

const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json, text/event-stream',
  [STORYBOOK_MCP_PROXY_HEADER]: STORYBOOK_MCP_PROXY_HEADER_VALUE,
};

/**
 * Send a minimal MCP `initialize` request carrying {@link MCP_CLIENT_INFO} and return the session
 * id the transport assigned, or null when the handshake fails in any way.
 *
 * Its only purpose is telemetry segmentation: tmcp's HttpTransport stores the clientInfo keyed by
 * session id, and attaches it to later requests carrying that id in the `Mcp-Session-Id` header.
 * The handshake is strictly best-effort — when it fails, the actual command request proceeds
 * without a session and keeps working, so error reporting stays anchored on the real call.
 *
 * Sessions are deliberately one-shot: each JSON-RPC request gets its own handshake and the session
 * is never reused or closed. A CLI invocation makes one request on the happy path (two on error
 * paths that fetch the tool list), so against a localhost server the extra round-trip is
 * negligible — not worth threading session state through the call sites.
 *
 * The response body is drained before returning because the transport produces it only after the
 * server has processed the initialize message (and stored the clientInfo); returning on headers
 * alone would race the follow-up request against that processing.
 */
async function initializeMcpSession(
  target: string,
  fetchImpl: typeof fetch
): Promise<string | null> {
  try {
    const response = await fetchImpl(target, {
      method: 'POST',
      headers: REQUEST_HEADERS,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: crypto.randomUUID(),
        method: 'initialize',
        params: {
          protocolVersion: MCP_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: MCP_CLIENT_INFO,
        },
      }),
      signal: AbortSignal.timeout(INITIALIZE_TIMEOUT_MS),
    });
    const sessionId = response.headers.get('mcp-session-id');
    if (!response.ok || !sessionId) {
      return null;
    }
    await response.text();
    return sessionId;
  } catch {
    return null;
  }
}

/**
 * Send a single JSON-RPC request to the instance's MCP endpoint over HTTP.
 *
 * This is deliberately NOT a full MCP client: the `initialize` request exists solely to convey
 * `clientInfo` for telemetry (see {@link initializeMcpSession}) — there is no protocol-version
 * negotiation, capability handling, or session lifecycle beyond this one follow-up request. The
 * downstream is always `@storybook/addon-mcp`, whose tmcp HttpTransport serves `tools/*`
 * per-request — the same local shortcut `@storybook/mcp-proxy` takes in its proxy-client. If the
 * CLI ever needs to talk to arbitrary MCP servers, replace this with a real client instead of
 * extending it.
 *
 * tmcp hardcodes `text/event-stream` for any request with an id, so we accept both content-types
 * and parse the SSE envelope when needed.
 */
async function sendJsonRpcRequest<TResult>(
  record: StorybookInstanceRecord,
  method: 'tools/call' | 'tools/list',
  params: unknown,
  resultSchema: v.GenericSchema<unknown, TResult>,
  fetchImpl: typeof fetch
): Promise<TResult> {
  const endpoint = record.mcp.endpoint;
  if (!endpoint) {
    throw new Error(`The Storybook instance at ${record.cwd} has no server endpoint registered`);
  }

  const target = new URL(endpoint, record.url).href;

  const sessionId = await initializeMcpSession(target, fetchImpl);

  const response = await fetchImpl(target, {
    method: 'POST',
    headers: {
      ...REQUEST_HEADERS,
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `The Storybook server at ${target} responded with ${response.status} ${response.statusText}`
    );
  }

  const payload = await readJsonRpcResponse(response, target);

  const envelope = v.safeParse(JsonRpcEnvelopeSchema, payload);
  if (!envelope.success) {
    throw unexpectedShapeError(target);
  }
  if (envelope.output.error) {
    throw new McpJsonRpcError(envelope.output.error.code, envelope.output.error.message);
  }
  if (envelope.output.result === undefined) {
    throw new Error('The Storybook server returned no result');
  }

  const result = v.safeParse(resultSchema, envelope.output.result);
  if (!result.success) {
    throw unexpectedShapeError(target);
  }
  return result.output;
}

function unexpectedShapeError(target: string): Error {
  return new Error(`The Storybook server at ${target} returned an unexpected response shape`);
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
    `The Storybook server at ${endpoint} returned unsupported content-type "${contentType}". Expected application/json or text/event-stream.`
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
    throw new Error(
      `The Storybook server at ${endpoint} returned an SSE response with no data event`
    );
  }
  try {
    return JSON.parse(dataLines.join('\n'));
  } catch (error) {
    throw new Error(
      `The Storybook server at ${endpoint} returned an SSE event whose data could not be parsed as JSON: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
