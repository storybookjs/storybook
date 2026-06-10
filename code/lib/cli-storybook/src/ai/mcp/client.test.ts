import { describe, expect, it, vi } from 'vitest';

import { McpJsonRpcError, callMcpTool, listMcpTools } from './client.ts';
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

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sseResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/event-stream' },
  });

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

    const call = vi.mocked(fetchImpl).mock.calls[0];
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

    expect(vi.mocked(fetchImpl).mock.calls[0][0]).toBe('http://127.0.0.1:6007/mcp');
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

    const body = JSON.parse(vi.mocked(fetchImpl).mock.calls[0][1]?.body as string);
    expect(body).toMatchObject({ method: 'tools/list', params: {} });
  });

  it('returns [] when the result has no tools array', async () => {
    const fetchImpl = (async () =>
      jsonResponse({ jsonrpc: '2.0', id: 'x', result: {} })) as typeof fetch;
    await expect(listMcpTools(record, fetchImpl)).resolves.toEqual([]);
  });
});
