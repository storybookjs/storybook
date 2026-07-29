import { versions } from 'storybook/internal/common';

import { describe, expect, it, vi } from 'vitest';

import { MCP_CLIENT_INFO, McpJsonRpcError, callMcpTool, listMcpTools } from './client.ts';
import type { StorybookInstanceRecord } from './types.ts';

const record: StorybookInstanceRecord = {
  schemaVersion: 1,
  instanceId: 'i-1',
  pid: 1,
  cwd: '/projects/foo',
  url: 'http://localhost:6006',
  port: 6006,
  mcp: { status: 'ready', endpoint: '/mcp' },
};

const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const sseResponse = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream', ...headers },
  });

/**
 * Every JSON-RPC request is preceded by a best-effort `initialize` handshake POST, so the actual
 * request under test is always the last fetch call.
 */
const lastCall = (fetchImpl: typeof fetch) => vi.mocked(fetchImpl).mock.calls.at(-1)!;

describe('callMcpTool', () => {
  it('POSTs a JSON-RPC tools/call request to the endpoint (application/json)', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        jsonrpc: '2.0',
        id: 'whatever',
        result: { content: [{ type: 'text', text: 'hello' }] },
      })
    ) as unknown as typeof fetch;

    const result = await callMcpTool(
      record,
      { name: 'list-all-documentation', arguments: { withStoryIds: true } },
      fetchImpl
    );

    expect(result.content).toEqual([{ type: 'text', text: 'hello' }]);

    const call = lastCall(fetchImpl);
    expect(call[0]).toBe('http://localhost:6006/mcp');
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/json, text/event-stream');
    expect(headers['X-Storybook-MCP-Proxy']).toBe('true');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'list-all-documentation',
        arguments: { withStoryIds: true },
      },
    });
    expect(typeof body.id).toBe('string');
  });

  it('resolves the endpoint path against the instance url without mangling the scheme', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ jsonrpc: '2.0', id: 'whatever', result: { content: [] } })
    ) as unknown as typeof fetch;

    await callMcpTool(
      { ...record, url: 'http://127.0.0.1:6007', mcp: { status: 'ready', endpoint: '/mcp' } },
      { name: 'list-all-documentation' },
      fetchImpl
    );

    expect(lastCall(fetchImpl)[0]).toBe('http://127.0.0.1:6007/mcp');
  });

  it('parses a single-event SSE response (text/event-stream)', async () => {
    const sseBody =
      'event: message\n' +
      'data: {"jsonrpc":"2.0","id":1,"result":{"content":[{"type":"text","text":"hi"}]}}\n' +
      '\n';
    const fetchImpl = (async () => sseResponse(sseBody)) as typeof fetch;

    const result = await callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl);
    expect(result.content).toEqual([{ type: 'text', text: 'hi' }]);
  });

  it('joins multi-line SSE data correctly', async () => {
    const envelope = {
      jsonrpc: '2.0',
      id: 1,
      result: { content: [{ type: 'text', text: 'line\nwith newline' }] },
    };
    const dataLines = JSON.stringify(envelope, null, 2)
      .split('\n')
      .map((l) => `data: ${l}`)
      .join('\n');
    const sseBody = `event: message\n${dataLines}\n\n`;
    const fetchImpl = (async () => sseResponse(sseBody)) as typeof fetch;

    const result = await callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl);
    expect(result.content?.[0]).toEqual({ type: 'text', text: 'line\nwith newline' });
  });

  it('throws on SSE responses that contain no data event', async () => {
    const fetchImpl = (async () => sseResponse('event: ping\n\n')) as typeof fetch;
    await expect(
      callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl)
    ).rejects.toThrow(/SSE response with no data event/);
  });

  it('throws when the record has no mcp.endpoint', async () => {
    const noEndpoint: StorybookInstanceRecord = { ...record, mcp: { status: 'ready' } };
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    await expect(
      callMcpTool(noEndpoint, { name: 'list-all-documentation' }, fetchImpl)
    ).rejects.toThrow(/has no server endpoint registered/);
  });

  it('throws when the response is not ok', async () => {
    const fetchImpl = (async () =>
      new Response('boom', { status: 500, statusText: 'Server Error' })) as typeof fetch;
    await expect(
      callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl)
    ).rejects.toThrow(/responded with 500/);
  });

  it('throws when the response content-type is neither JSON nor SSE', async () => {
    const fetchImpl = (async () =>
      new Response('<html></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })) as typeof fetch;
    await expect(
      callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl)
    ).rejects.toThrow(/unsupported content-type "text\/html"/);
  });

  it('throws an McpJsonRpcError when the JSON-RPC payload carries an error', async () => {
    const fetchImpl = (async () =>
      jsonResponse({
        jsonrpc: '2.0',
        id: 'whatever',
        error: { code: -32601, message: 'unknown tool' },
      })) as typeof fetch;
    const promise = callMcpTool(record, { name: 'nope' }, fetchImpl);
    await expect(promise).rejects.toThrow(/Storybook server error -32601: unknown tool/);
    await expect(promise).rejects.toBeInstanceOf(McpJsonRpcError);
  });

  it.each([
    ['a primitive result', { jsonrpc: '2.0', id: 1, result: 'hello' }],
    ['a null result', { jsonrpc: '2.0', id: 1, result: null }],
    [
      'a content item without a type',
      { jsonrpc: '2.0', id: 1, result: { content: [{ text: 'x' }] } },
    ],
    ['a malformed error object', { jsonrpc: '2.0', id: 1, error: { code: 'x' } }],
  ])('rejects %s as an unexpected response shape', async (_label, body) => {
    const fetchImpl = (async () => jsonResponse(body)) as typeof fetch;
    await expect(
      callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl)
    ).rejects.toThrow(/unexpected response shape/);
  });

  it('passes through extra content fields and result keys (loose validation)', async () => {
    const fetchImpl = (async () =>
      jsonResponse({
        jsonrpc: '2.0',
        id: 1,
        result: {
          content: [{ type: 'resource_link', uri: 'http://x' }],
          _meta: { 'storybook.dev/foo': 1 },
        },
      })) as typeof fetch;
    const result = await callMcpTool(record, { name: 'x' }, fetchImpl);
    expect(result.content?.[0]).toMatchObject({ type: 'resource_link', uri: 'http://x' });
  });
});

describe('listMcpTools', () => {
  it('POSTs a JSON-RPC tools/list request and returns the tool descriptors', async () => {
    const tools = [
      { name: 'get-documentation', description: 'Docs', inputSchema: { properties: {} } },
      { name: 'list-all-documentation' },
    ];
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ jsonrpc: '2.0', id: 'x', result: { tools } })
    ) as unknown as typeof fetch;

    await expect(listMcpTools(record, fetchImpl)).resolves.toEqual(tools);

    const body = JSON.parse(lastCall(fetchImpl)[1]?.body as string);
    expect(body).toMatchObject({ method: 'tools/list', params: {} });
  });

  it('returns [] when the result has no tools array', async () => {
    const fetchImpl = (async () =>
      jsonResponse({ jsonrpc: '2.0', id: 'x', result: {} })) as typeof fetch;
    await expect(listMcpTools(record, fetchImpl)).resolves.toEqual([]);
  });

  it('rejects tool descriptors without a name as an unexpected response shape', async () => {
    const fetchImpl = (async () =>
      jsonResponse({
        jsonrpc: '2.0',
        id: 'x',
        result: { tools: [{ description: 'nameless' }] },
      })) as typeof fetch;
    await expect(listMcpTools(record, fetchImpl)).rejects.toThrow(/unexpected response shape/);
  });
});

describe('initialize handshake (clientInfo for telemetry segmentation)', () => {
  const initializeResponse = (sessionId?: string) =>
    jsonResponse(
      {
        jsonrpc: '2.0',
        id: 'init',
        result: {
          protocolVersion: '2025-06-18',
          serverInfo: {},
        },
      },
      200,
      sessionId ? { 'mcp-session-id': sessionId } : {}
    );

  const toolResult = () =>
    jsonResponse({
      jsonrpc: '2.0',
      id: 'call',
      result: { content: [{ type: 'text', text: 'hi' }] },
    });

  const toolListResult = (tools: unknown[] = []) =>
    jsonResponse({
      jsonrpc: '2.0',
      id: 'list',
      result: { tools },
    });

  it('sends initialize with the storybook-cli clientInfo before the actual request', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(initializeResponse('session-1'))
      .mockResolvedValueOnce(toolResult()) as unknown as typeof fetch;

    await callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [initTarget, initInit] = vi.mocked(fetchImpl).mock.calls[0];
    expect(initTarget).toBe('http://localhost:6006/mcp');
    const initBody = JSON.parse((initInit as RequestInit).body as string);
    expect(initBody).toMatchObject({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        capabilities: {},
        clientInfo: { name: 'storybook-cli', version: versions.storybook },
      },
    });
    expect(MCP_CLIENT_INFO).toEqual({ name: 'storybook-cli', version: versions.storybook });
  });

  it('threads the session id from the handshake into the actual request', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(initializeResponse('session-42'))
      .mockResolvedValueOnce(toolResult()) as unknown as typeof fetch;

    await callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl);

    const headers = (lastCall(fetchImpl)[1] as RequestInit).headers as Record<string, string>;
    expect(headers['Mcp-Session-Id']).toBe('session-42');
  });

  it('proceeds without a session header when the handshake response has no session id', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(initializeResponse(undefined))
      .mockResolvedValueOnce(toolResult()) as unknown as typeof fetch;

    const result = await callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl);

    expect(result.content).toEqual([{ type: 'text', text: 'hi' }]);
    const headers = (lastCall(fetchImpl)[1] as RequestInit).headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Mcp-Session-Id');
  });

  it('proceeds without a session header when the handshake request rejects', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('connection refused'))
      .mockResolvedValueOnce(toolResult()) as unknown as typeof fetch;

    const result = await callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl);

    expect(result.content).toEqual([{ type: 'text', text: 'hi' }]);
    const headers = (lastCall(fetchImpl)[1] as RequestInit).headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Mcp-Session-Id');
  });

  it('ignores the session id of a non-ok handshake response', async () => {
    let canceled = false;
    const initBody = new ReadableStream<Uint8Array>({
      cancel() {
        canceled = true;
      },
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(initBody, { status: 500, headers: { 'mcp-session-id': 'session-broken' } })
      )
      .mockResolvedValueOnce(toolResult()) as unknown as typeof fetch;

    await callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl);

    const headers = (lastCall(fetchImpl)[1] as RequestInit).headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Mcp-Session-Id');
    expect(canceled).toBe(true);
  });

  it('drains the handshake response body before sending the actual request', async () => {
    // The server stores the clientInfo while producing the handshake response body, so the
    // follow-up request may only be sent after that body has been consumed.
    let drained = false;
    const initBody = new ReadableStream<Uint8Array>({
      pull(controller) {
        drained = true;
        controller.enqueue(new TextEncoder().encode('{}'));
        controller.close();
      },
    });
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(initBody, {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'mcp-session-id': 'session-1' },
        })
      )
      .mockImplementationOnce(async () => {
        expect(drained).toBe(true);
        return toolResult();
      }) as unknown as typeof fetch;

    await callMcpTool(record, { name: 'list-all-documentation' }, fetchImpl);
    expect(drained).toBe(true);
  });

  it('also performs the handshake for tools/list requests', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(initializeResponse('session-7'))
      .mockResolvedValueOnce(
        jsonResponse({ jsonrpc: '2.0', id: 'x', result: { tools: [] } })
      ) as unknown as typeof fetch;

    await listMcpTools(record, fetchImpl);

    const initBody = JSON.parse(
      (vi.mocked(fetchImpl).mock.calls[0][1] as RequestInit).body as string
    );
    expect(initBody.method).toBe('initialize');
    const headers = (vi.mocked(fetchImpl).mock.calls[1][1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers['Mcp-Session-Id']).toBe('session-7');
  });

  it.each([
    [
      'malformed JSON',
      () =>
        new Response('not json', {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'mcp-session-id': 'session-1' },
        }),
    ],
    [
      'a JSON-RPC error',
      () => jsonResponse({ jsonrpc: '2.0', id: 'init', error: { code: -32000, message: 'bad' } }),
    ],
    ['no result', () => jsonResponse({ jsonrpc: '2.0', id: 'init' })],
  ])('keeps tools/list working when initialize returns %s', async (_label, initResponse) => {
    const tools = [{ name: 'get-documentation', description: 'Get docs' }];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(initResponse())
      .mockResolvedValueOnce(toolListResult(tools)) as unknown as typeof fetch;

    await expect(listMcpTools(record, fetchImpl)).resolves.toEqual(tools);
  });

  it('keeps listMcpTools returning only the tool descriptors', async () => {
    const tools = [{ name: 'get-documentation', description: 'Get docs' }];
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(initializeResponse('session-1'))
      .mockResolvedValueOnce(
        jsonResponse({ jsonrpc: '2.0', id: 'x', result: { tools } })
      ) as unknown as typeof fetch;

    await expect(listMcpTools(record, fetchImpl)).resolves.toEqual(tools);
  });
});
