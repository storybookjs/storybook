import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerCoreToolsetsForTest } from './test-support/register-core-toolsets.ts';
import {
  incomingMessageToWebRequest,
  webResponseToServerResponse,
  abortWhenClientLeaves,
  getToolsets,
} from './mcp-handler.ts';
import type { IncomingMessage } from 'node:http';
import type { Options } from 'storybook/internal/types';
import { logger } from 'storybook/internal/node-logger';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { CompositionAuth } from './auth/index.ts';

// Test helpers to reduce boilerplate
function createMockIncomingMessage(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string | object;
}): IncomingMessage {
  const { method = 'GET', url = '/mcp', headers = {}, body } = options;

  const passThrough = new PassThrough();

  // Write body if provided
  if (body) {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    passThrough.end(Buffer.from(bodyString));
  } else {
    passThrough.end();
  }

  return Object.assign(passThrough, {
    method,
    url,
    headers: {
      host: 'localhost:6006',
      ...headers,
    },
    socket: {},
  }) as unknown as IncomingMessage;
}

/** A response that records what was written and can report backpressure, like Node does. */
class MockClientResponse extends EventEmitter {
  statusCode = 0;
  /** Whether `write` accepts the next chunk; false stands for a full send queue. */
  private acceptsChunks = true;
  private readonly headers = new Map<string, string>();
  private readonly chunks: Uint8Array[] = [];
  end = vi.fn();

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
  }

  write(chunk: Uint8Array) {
    this.chunks.push(chunk);
    // Node takes the chunk and returns false once its queue passes the high-water mark: the
    // writer has to wait for `drain` before sending more.
    return this.acceptsChunks;
  }

  stall() {
    this.acceptsChunks = false;
  }

  resume() {
    this.acceptsChunks = true;
    this.emit('drain');
  }

  getResponseData() {
    return {
      status: this.statusCode,
      headers: this.headers,
      body: Buffer.concat(this.chunks).toString(),
    };
  }
}

function createMockServerResponse() {
  const response = new MockClientResponse();
  return {
    response,
    stall: () => response.stall(),
    resume: () => response.resume(),
    getResponseData: () => response.getResponseData(),
  };
}

// For the cases that only exercise the happy path: a client that never goes away.
const stayingClient = new AbortController().signal;

describe('mcp-handler conversion utilities', () => {
  describe('incomingMessageToWebRequest', () => {
    it('should convert GET request to Web Request', async () => {
      const mockReq = createMockIncomingMessage({
        method: 'GET',
        headers: { 'content-type': 'application/json' },
      });

      const webRequest = await incomingMessageToWebRequest(mockReq);

      expect(webRequest.method).toBe('GET');
      expect(webRequest.url).toBe('http://localhost:6006/mcp');
      expect(webRequest.headers.get('content-type')).toBe('application/json');
    });

    it('should convert POST request with body to Web Request', async () => {
      const body = { message: 'test' };
      const mockReq = createMockIncomingMessage({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      });

      const webRequest = await incomingMessageToWebRequest(mockReq);

      expect(webRequest.method).toBe('POST');
      const receivedBody = await webRequest.text();
      expect(JSON.parse(receivedBody)).toEqual(body);
    });

    it('should handle request with query parameters', async () => {
      const mockReq = createMockIncomingMessage({
        url: '/mcp?session=123',
      });

      const webRequest = await incomingMessageToWebRequest(mockReq);

      expect(webRequest.url).toBe('http://localhost:6006/mcp?session=123');
    });

    it('should handle empty body', async () => {
      const mockReq = createMockIncomingMessage({
        method: 'POST',
      });

      const webRequest = await incomingMessageToWebRequest(mockReq);

      expect(webRequest.method).toBe('POST');
      expect(webRequest.body).toBe(null);
    });

    it('should preserve custom headers', async () => {
      const mockReq = createMockIncomingMessage({
        method: 'POST',
        headers: {
          'x-custom-header': 'custom-value',
          authorization: 'Bearer token123',
        },
      });

      const webRequest = await incomingMessageToWebRequest(mockReq);

      expect(webRequest.headers.get('x-custom-header')).toBe('custom-value');
      expect(webRequest.headers.get('authorization')).toBe('Bearer token123');
    });
  });

  describe('webResponseToServerResponse', () => {
    it('should convert Web Response to Node.js ServerResponse', async () => {
      const webResponse = new Response('Hello World', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });

      const { response, getResponseData } = createMockServerResponse();

      await webResponseToServerResponse(webResponse, response, stayingClient);

      const { status, headers, body } = getResponseData();
      expect(status).toBe(200);
      expect(headers.get('content-type')).toBe('text/plain');
      expect(body).toBe('Hello World');
      expect(response.end).toHaveBeenCalled();
    });

    it('should handle JSON responses', async () => {
      const responseBody = { message: 'success', data: [1, 2, 3] };
      const webResponse = new Response(JSON.stringify(responseBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });

      const { response, getResponseData } = createMockServerResponse();

      await webResponseToServerResponse(webResponse, response, stayingClient);

      const { body } = getResponseData();
      expect(JSON.parse(body)).toEqual(responseBody);
    });

    it('should handle error status codes', async () => {
      const webResponse = new Response('Not Found', {
        status: 404,
        headers: { 'content-type': 'text/plain' },
      });

      const { response, getResponseData } = createMockServerResponse();

      await webResponseToServerResponse(webResponse, response, stayingClient);

      const { status } = getResponseData();
      expect(status).toBe(404);
    });

    it('should handle server error status codes', async () => {
      const webResponse = new Response('Internal Server Error', {
        status: 500,
      });

      const { response, getResponseData } = createMockServerResponse();

      await webResponseToServerResponse(webResponse, response, stayingClient);

      const { status } = getResponseData();
      expect(status).toBe(500);
    });

    it('releases a stream that is still open when the client disconnects', async () => {
      const onCancel = vi.fn();
      // Like the GET notification channel: it produces nothing until the client leaves.
      const body = new ReadableStream({
        pull: () => new Promise(() => undefined),
        cancel: onCancel,
      });

      const { response } = createMockServerResponse();
      const clientGone = abortWhenClientLeaves(response);
      const written = webResponseToServerResponse(new Response(body), response, clientGone.signal);

      response.emit('close');

      // Cancelling resolves the parked read, so the handler settles instead of hanging.
      await written;
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(response.end).toHaveBeenCalled();
    });

    it('releases the stream when the client had already left before the response was written', async () => {
      const onCancel = vi.fn();
      const body = new ReadableStream({
        pull: () => new Promise(() => undefined),
        cancel: onCancel,
      });

      const { response } = createMockServerResponse();
      const clientGone = new AbortController();
      clientGone.abort();

      await webResponseToServerResponse(new Response(body), response, clientGone.signal);

      // An aborted signal never fires its listener, so this is the branch that releases the session.
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(response.end).toHaveBeenCalled();
    });

    it('waits for drain before writing the next chunk to a client that cannot keep up', async () => {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('first'));
          controller.enqueue(encoder.encode('second'));
          controller.close();
        },
      });

      const { response, stall, resume, getResponseData } = createMockServerResponse();
      stall();

      const written = webResponseToServerResponse(new Response(body), response, stayingClient);

      await vi.waitFor(() => expect(getResponseData().body).toBe('first'));
      expect(getResponseData().body).not.toContain('second');

      resume();
      await written;
      expect(getResponseData().body).toBe('firstsecond');
    });

    it('settles when the client leaves while a write is backed up', async () => {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('first'));
          controller.enqueue(encoder.encode('second'));
        },
      });

      const { response, stall, getResponseData } = createMockServerResponse();
      const clientGone = new AbortController();
      stall();

      const written = webResponseToServerResponse(new Response(body), response, clientGone.signal);

      await vi.waitFor(() => expect(getResponseData().body).toBe('first'));

      // A destroyed response never emits `drain`, so only the disconnect can end the wait.
      clientGone.abort();

      await written;
      expect(getResponseData().body).not.toContain('second');
      expect(response.end).toHaveBeenCalled();
    });

    it('ends the response and logs when the transport stream errors mid-channel', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {});
      let frames = 0;
      // Like a notification channel that dies after a first frame: `error()` on a stream drops
      // anything still queued, so the delivered chunk has to come from an earlier pull.
      const body = new ReadableStream({
        pull(controller) {
          if (frames++ === 0) {
            controller.enqueue(new TextEncoder().encode('first'));
            return;
          }
          controller.error(new Error('transport died mid-stream'));
        },
      });

      const { response, getResponseData } = createMockServerResponse();

      // The middleware chain has no rejection handler, so a rejection here would reach Node's
      // default `--unhandled-rejections=throw` and take the dev server down with it.
      await expect(
        webResponseToServerResponse(new Response(body), response, stayingClient)
      ).resolves.toBeUndefined();

      expect(getResponseData().body).toBe('first');
      expect(response.end).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('transport died mid-stream'));
    });
  });
});

describe('mcpServerHandler', () => {
  let mcpServerHandler: any;

  beforeEach(async () => {
    // Reset modules and get fresh handler for each test to avoid state pollution
    vi.resetModules();
    // The `services` preset hook does this in a real Storybook, before the MCP server boots.
    registerCoreToolsetsForTest();
    const handler = await import('./mcp-handler.ts');
    mcpServerHandler = handler.mcpServerHandler;
  });

  function createMockOptions(overrides = {}) {
    const apply: Options['presets']['apply'] = vi.fn().mockResolvedValue({
      disableTelemetry: false,
    });
    return {
      port: 6006,
      presets: { apply },
      ...overrides,
    } as Options;
  }

  function createMCPInitializeRequest() {
    return {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' },
      },
    };
  }

  // Initializes the server then asks for `tools/list`, returning the registered tool names.
  async function getRegisteredToolNames(
    mockOptions: any,
    port: number,
    handlerOptions: { sources?: any[]; headers?: Record<string, string> } = {}
  ): Promise<string[]> {
    const host = `localhost:${port}`;
    const addonOptions = { toolsets: { dev: true, docs: true } };
    const { headers: extraHeaders = {}, ...restHandlerOptions } = handlerOptions;

    const initReq = createMockIncomingMessage({
      method: 'POST',
      headers: { 'content-type': 'application/json', host, ...extraHeaders },
      body: createMCPInitializeRequest(),
    });
    const { response: initResponse } = createMockServerResponse();
    await mcpServerHandler({
      req: initReq,
      res: initResponse,
      options: mockOptions,
      addonOptions,
      compositionAuth: new CompositionAuth(),
      ...restHandlerOptions,
    });

    const listReq = createMockIncomingMessage({
      method: 'POST',
      headers: { 'content-type': 'application/json', host, ...extraHeaders },
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
    });
    const { response: listResponse, getResponseData } = createMockServerResponse();
    await mcpServerHandler({
      req: listReq,
      res: listResponse,
      options: mockOptions,
      addonOptions,
      compositionAuth: new CompositionAuth(),
      ...restHandlerOptions,
    });

    const { body } = getResponseData();
    const dataLine = body.split('\n').find((line) => line.startsWith('data: '));
    const parsed = JSON.parse(dataLine!.replace(/^data: /, '').trim());
    return parsed.result.tools.map((t: any) => t.name);
  }

  it('should initialize MCP server and handle requests', async () => {
    const mockOptions = createMockOptions();
    const mockReq = createMockIncomingMessage({
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: createMCPInitializeRequest(),
    });
    const { response, getResponseData } = createMockServerResponse();

    await mcpServerHandler({
      req: mockReq,
      res: response,
      options: mockOptions,
      addonOptions: {
        toolsets: {
          dev: true,
          docs: true,
        },
      },
      compositionAuth: new CompositionAuth(),
    });

    const { body } = getResponseData();
    expect(response.end).toHaveBeenCalled();

    const dataLine = body.split('\n').find((line) => line.startsWith('data: '));
    const responseText = dataLine!.replace(/^data: /, '').trim();
    const parsedResponse = JSON.parse(responseText);

    expect(parsedResponse).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        protocolVersion: '2025-06-18',
        adapter: {},
        capabilities: {
          tools: { listChanged: true },
        },
        serverInfo: {
          name: '@storybook/addon-mcp',
          description: 'Help agents automatically write and test stories for your UI components',
        },
      },
    });
    expect(parsedResponse.result.serverInfo.version).toBeDefined();
    expect(parsedResponse.result.instructions).toBeDefined();
    expect(parsedResponse.result.instructions).toContain(
      'Follow these workflows when working with UI and/or Storybook.'
    );
    expect(parsedResponse.result.instructions).toContain(
      '## UI Building and Story Writing Workflow'
    );
    expect(parsedResponse.result.instructions).toContain('## Validation Workflow');
    expect(parsedResponse.result.instructions).not.toContain('## Documentation Workflow');
  });

  it('should include docs-style instructions when docs toolset is selected and manifest is available', async () => {
    const applyMock = vi.fn(async (key: string, defaultValue?: any) => {
      if (key === 'core') {
        return { disableTelemetry: false };
      }
      if (key === 'features') {
        return { experimentalComponentsManifest: true };
      }
      if (key === 'experimental_manifests') {
        return { components: { v: 1, components: {} } };
      }
      return defaultValue;
    });

    const mockOptions = createMockOptions({
      port: 6011,
      presets: { apply: applyMock },
    });
    const mockReq = createMockIncomingMessage({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        host: 'localhost:6011',
        'X-MCP-Toolsets': 'docs',
      },
      body: createMCPInitializeRequest(),
    });
    const { response, getResponseData } = createMockServerResponse();

    await mcpServerHandler({
      req: mockReq,
      res: response,
      options: mockOptions,
      addonOptions: {
        toolsets: {
          dev: true,
          docs: true,
          test: true,
        },
      },
      compositionAuth: new CompositionAuth(),
    });

    const { body } = getResponseData();
    const dataLine = body.split('\n').find((line) => line.startsWith('data: '));
    const responseText = dataLine!.replace(/^data: /, '').trim();
    const parsedResponse = JSON.parse(responseText);

    expect(parsedResponse.result.instructions).toContain(
      'Follow these workflows when working with UI and/or Storybook.'
    );
    expect(parsedResponse.result.instructions).toContain('## Documentation Workflow');
    expect(parsedResponse.result.instructions).toContain(
      '**CRITICAL: Never hallucinate component properties!**'
    );
    expect(parsedResponse.result.instructions).toContain('## Multi-Source Requests');
    expect(parsedResponse.result.instructions).not.toContain(
      '## UI Building and Story Writing Workflow'
    );
    expect(parsedResponse.result.instructions).not.toContain('## Validation Workflow');
  });

  it('should respect disableTelemetry setting', async () => {
    const { telemetry } = await import('storybook/internal/telemetry');
    vi.mocked(telemetry).mockClear();

    const mockOptions = createMockOptions({
      port: 6007,
      presets: {
        apply: vi.fn(async (key: string) => {
          if (key === 'core') {
            return { disableTelemetry: true };
          }
          return {};
        }),
      },
    });
    const mockReq = createMockIncomingMessage({
      method: 'POST',
      url: '/mcp',
      headers: { 'content-type': 'application/json', host: 'localhost:6007' },
      body: createMCPInitializeRequest(),
    });
    const { response } = createMockServerResponse();

    await mcpServerHandler({
      req: mockReq,
      res: response,
      options: mockOptions,
      addonOptions: {
        toolsets: {
          dev: true,
          docs: true,
        },
      },
      compositionAuth: new CompositionAuth(),
    });

    // Verify handler completes successfully when telemetry is disabled
    expect(response.end).toHaveBeenCalled();

    // Verify telemetry was NOT called when disabled
    expect(telemetry).not.toHaveBeenCalled();
  });

  it('should register the docs tools when feature flag and generator are enabled', async () => {
    const applyMock = vi.fn(async (key: string, defaultValue?: any) => {
      if (key === 'core') {
        return { disableTelemetry: false };
      }
      if (key === 'features') {
        return { componentsManifest: true };
      }
      if (key === 'experimental_manifests') {
        return { components: { v: 1, components: {} } };
      }
      return defaultValue;
    });

    const mockOptions = createMockOptions({
      port: 6008,
      presets: { apply: applyMock },
    });

    // First, initialize the MCP server
    const initReq = createMockIncomingMessage({
      method: 'POST',
      headers: { 'content-type': 'application/json', host: 'localhost:6008' },
      body: createMCPInitializeRequest(),
    });
    const { response: initResponse } = createMockServerResponse();

    await mcpServerHandler({
      req: initReq,
      res: initResponse,
      options: mockOptions,
      addonOptions: {
        toolsets: { dev: true, docs: true },
      },
      compositionAuth: new CompositionAuth(),
    });

    // Then, list tools to verify component manifest tools are registered
    const listToolsReq = createMockIncomingMessage({
      method: 'POST',
      headers: { 'content-type': 'application/json', host: 'localhost:6008' },
      body: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      },
    });
    const { response: listResponse, getResponseData } = createMockServerResponse();

    await mcpServerHandler({
      req: listToolsReq,
      res: listResponse,
      options: mockOptions,
      addonOptions: {
        toolsets: { dev: true, docs: true },
      },
      compositionAuth: new CompositionAuth(),
    });

    // Parse the SSE response
    const { body } = getResponseData();
    const dataLine = body.split('\n').find((line) => line.startsWith('data: '));
    const responseText = dataLine!.replace(/^data: /, '').trim();
    const parsedResponse = JSON.parse(responseText);

    // Verify component manifest tools are included
    const toolNames = parsedResponse.result.tools.map((t: any) => t.name);
    expect(toolNames).toContain('docs-list');
    expect(toolNames).toContain('docs-show');
    expect(toolNames).toContain('docs-show-story');
  });

  it('registers docs tools for composed sources when local manifests are unavailable', async () => {
    const mockOptions = createMockOptions({
      port: 6012,
      presets: {
        apply: vi.fn(async (key: string, defaultValue?: any) => {
          if (key === 'core') return { disableTelemetry: false };
          if (key === 'features') return { componentsManifest: true };
          return defaultValue;
        }),
      },
    });

    const toolNames = await getRegisteredToolNames(mockOptions, 6012, {
      sources: [
        { id: 'local', title: 'Local' },
        { id: 'remote', title: 'Remote', url: 'https://example.com/storybook' },
      ],
    });

    expect(toolNames).toContain('docs-list');
    expect(toolNames).toContain('docs-show');
    expect(toolNames).toContain('docs-show-story');
  });

  it('registers stories-changed when the changeDetection feature flag is on', async () => {
    const mockOptions = createMockOptions({
      port: 6009,
      presets: {
        apply: vi.fn(async (key: string, defaultValue?: any) => {
          if (key === 'core') return { disableTelemetry: false };
          if (key === 'features') return { changeDetection: true };
          return defaultValue;
        }),
      },
    });

    const toolNames = await getRegisteredToolNames(mockOptions, 6009);
    expect(toolNames).toContain('stories-changed');
  });

  it('registers review-create when the experimentalReview and changeDetection feature flags are on', async () => {
    const mockOptions = createMockOptions({
      port: 6010,
      presets: {
        apply: vi.fn(async (key: string, defaultValue?: any) => {
          if (key === 'core') return { disableTelemetry: false };
          if (key === 'features') return { changeDetection: true, experimentalReview: true };
          return defaultValue;
        }),
      },
    });

    const toolNames = await getRegisteredToolNames(mockOptions, 6010);
    expect(toolNames).toContain('review-create');
  });

  it('does not list review-create for direct MCP clients when only the changeDetection feature flag is on', async () => {
    const mockOptions = createMockOptions({
      port: 6013,
      presets: {
        apply: vi.fn(async (key: string, defaultValue?: any) => {
          if (key === 'core') return { disableTelemetry: false };
          if (key === 'features') return { changeDetection: true };
          return defaultValue;
        }),
      },
    });

    const toolNames = await getRegisteredToolNames(mockOptions, 6013);
    expect(toolNames).toContain('stories-changed');
    expect(toolNames).not.toContain('review-create');
  });

  it('lists review-create for storybook ai CLI requests when only the changeDetection feature flag is on', async () => {
    const mockOptions = createMockOptions({
      port: 6014,
      presets: {
        apply: vi.fn(async (key: string, defaultValue?: any) => {
          if (key === 'core') return { disableTelemetry: false };
          if (key === 'features') return { changeDetection: true };
          return defaultValue;
        }),
      },
    });

    const toolNames = await getRegisteredToolNames(mockOptions, 6014, {
      headers: { 'x-storybook-mcp-proxy': 'true' },
    });
    expect(toolNames).toContain('review-create');
  });

  it('does not list review-create for CLI requests when experimentalReview is explicitly false', async () => {
    const mockOptions = createMockOptions({
      port: 6015,
      presets: {
        apply: vi.fn(async (key: string, defaultValue?: any) => {
          if (key === 'core') return { disableTelemetry: false };
          if (key === 'features') return { changeDetection: true, experimentalReview: false };
          return defaultValue;
        }),
      },
    });

    const toolNames = await getRegisteredToolNames(mockOptions, 6015, {
      headers: { 'x-storybook-mcp-proxy': 'true' },
    });
    expect(toolNames).not.toContain('review-create');
  });

  // Opens the GET notification channel and hands back the request, so a test can decide when the
  // client leaves. A GET only settles then, which is why the returned promise is not awaited here.
  function openNotificationChannel(port: number, extraHeaders: Record<string, string> = {}) {
    const { response, getResponseData } = createMockServerResponse();
    const handler = mcpServerHandler({
      req: createMockIncomingMessage({
        method: 'GET',
        headers: { accept: 'text/event-stream', host: `localhost:${port}`, ...extraHeaders },
      }),
      res: response,
      options: createMockOptions({ port }),
      addonOptions: { toolsets: { dev: true, docs: true } },
      compositionAuth: new CompositionAuth(),
    });
    return { response, getResponseData, handler };
  }

  it('streams the GET notification channel instead of waiting for its body to end', async () => {
    const { response, getResponseData, handler } = openNotificationChannel(6016);

    await vi.waitFor(() => expect(getResponseData().body).toContain(': connected'));
    expect(getResponseData().status).toBe(200);
    expect(getResponseData().headers.get('content-type')).toBe('text/event-stream');

    response.emit('close');
    await handler;
    expect(response.listenerCount('close')).toBe(0);
  });

  it('frees the session id for a client that reconnects to the notification channel', async () => {
    const session = { 'mcp-session-id': 'session-1' };
    const first = openNotificationChannel(6018, session);
    await vi.waitFor(() => expect(first.getResponseData().body).toContain(': connected'));

    first.response.emit('close');
    await first.handler;

    const second = openNotificationChannel(6018, session);
    // While the abandoned channel stayed registered, the transport answered this second GET with
    // 409 and "Conflict: Only one SSE stream is allowed per session".
    await vi.waitFor(() => expect(second.getResponseData().body).toContain(': connected'));
    expect(second.getResponseData().status).toBe(200);

    second.response.emit('close');
    await second.handler;
  });

  it('settles when the client leaves while the server is still starting', async () => {
    const { response, getResponseData, handler } = openNotificationChannel(6019);

    // The listener has to be on the response before the awaited setup step, or this close goes
    // unheard and the channel gets built for a client that is already gone.
    response.emit('close');

    await handler;
    expect(getResponseData().body).toBe('');
  });

  it('replaces a POST response with 401 when a tool hit an auth error', async () => {
    const { response, getResponseData } = createMockServerResponse();
    const compositionAuth = new CompositionAuth();
    vi.spyOn(compositionAuth, 'hadAuthError').mockReturnValue(true);
    vi.spyOn(compositionAuth, 'buildWwwAuthenticate').mockReturnValue(
      'Bearer error="unauthorized"'
    );

    await mcpServerHandler({
      req: createMockIncomingMessage({
        method: 'POST',
        headers: { 'content-type': 'application/json', host: 'localhost:6017' },
        body: createMCPInitializeRequest(),
      }),
      res: response,
      options: createMockOptions({ port: 6017 }),
      addonOptions: { toolsets: { dev: true, docs: true } },
      compositionAuth,
    });

    expect(getResponseData().status).toBe(401);
    expect(getResponseData().body).toBe('401 - Unauthorized');
  });
});

describe('getToolsets', () => {
  it('should return addon options when no header is present', () => {
    const request = new Request('http://localhost:6006/mcp');
    const addonOptions = {
      toolsets: {
        dev: true,
        docs: false,
        test: true,
      },
    };

    const result = getToolsets(request, addonOptions);

    expect(result).toEqual({
      dev: true,
      docs: false,
      test: true,
    });
  });

  it('should enable only toolsets specified in header', () => {
    const request = new Request('http://localhost:6006/mcp', {
      headers: { 'X-MCP-Toolsets': 'dev' },
    });
    const addonOptions = {
      toolsets: {
        dev: true,
        docs: true,
        test: true,
      },
    };

    const result = getToolsets(request, addonOptions);

    expect(result).toEqual({
      dev: true,
      docs: false,
      test: false,
    });
  });

  it('should enable multiple toolsets from comma-separated header', () => {
    const request = new Request('http://localhost:6006/mcp', {
      headers: {
        'X-MCP-Toolsets': 'dev,docs',
      },
    });
    const addonOptions = {
      toolsets: {
        dev: false,
        docs: false,
        test: false,
      },
    };

    const result = getToolsets(request, addonOptions);

    expect(result).toEqual({
      dev: true,
      docs: true,
      test: false,
    });
  });

  it('should handle whitespace in header values', () => {
    const request = new Request('http://localhost:6006/mcp', {
      headers: {
        'X-MCP-Toolsets': ' dev , docs ',
      },
    });
    const addonOptions = {
      toolsets: {
        dev: false,
        docs: false,
        test: false,
      },
    };

    const result = getToolsets(request, addonOptions);

    expect(result).toEqual({
      dev: true,
      docs: true,
      test: false,
    });
  });

  it('should ignore invalid toolset names in header', () => {
    const request = new Request('http://localhost:6006/mcp', {
      headers: {
        'X-MCP-Toolsets': 'dev,invalidToolset,docs',
      },
    });
    const addonOptions = {
      toolsets: {
        dev: false,
        docs: false,
        test: false,
      },
    };

    const result = getToolsets(request, addonOptions);

    expect(result).toEqual({
      dev: true,
      docs: true,
      test: false,
    });
  });

  it('should return addon options when header is present with empty value', () => {
    const request = new Request('http://localhost:6006/mcp', {
      headers: { 'X-MCP-Toolsets': '' },
    });
    const addonOptions = {
      toolsets: {
        dev: true,
        docs: true,
        test: true,
      },
    };

    const result = getToolsets(request, addonOptions);

    expect(result).toEqual({
      dev: true,
      docs: true,
      test: true,
    });
  });
});
