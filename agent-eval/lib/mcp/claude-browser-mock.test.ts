import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import * as path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

const MOCK_SCRIPT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'claude-browser-mock.mjs'
);

type JsonRpcResponse = {
  id: number;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

type ToolResult = {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
};

class McpClient {
  private child: ChildProcessWithoutNullStreams;
  private pending = new Map<number, (response: JsonRpcResponse) => void>();
  private nextId = 1;

  constructor() {
    this.child = spawn(process.execPath, [MOCK_SCRIPT]);
    createInterface({ input: this.child.stdout }).on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const response = JSON.parse(trimmed) as JsonRpcResponse;
      const resolve = this.pending.get(response.id);
      if (resolve) {
        this.pending.delete(response.id);
        resolve(response);
      }
    });
  }

  request(method: string, params: Record<string, unknown> = {}): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const promise = new Promise<JsonRpcResponse>((resolve) => {
      this.pending.set(id, resolve);
    });
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    return promise;
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
    const response = await this.request('tools/call', { name, arguments: args });
    if (response.error) {
      throw new Error(`tools/call ${name} failed: ${response.error.message}`);
    }
    return response.result as ToolResult;
  }

  close(): Promise<void> {
    const exited = new Promise<void>((resolve) => {
      this.child.once('exit', () => resolve());
    });
    this.child.stdin.end();
    const killTimer = setTimeout(() => this.child.kill(), 2000);
    return exited.then(() => clearTimeout(killTimer));
  }
}

function toolText(result: ToolResult): string {
  return result.content
    .filter((item) => item.type === 'text')
    .map((item) => item.text)
    .join('\n');
}

function expectOk(result: ToolResult): string {
  expect(result.isError, `expected success, got: ${toolText(result)}`).not.toBe(true);
  return toolText(result);
}

function expectError(result: ToolResult): string {
  expect(result.isError, `expected an error, got: ${toolText(result)}`).toBe(true);
  return toolText(result);
}

function parseLeadingJson(text: string): Record<string, unknown> {
  const end = text.indexOf('\n}');
  return JSON.parse(text.slice(0, end + 2)) as Record<string, unknown>;
}

const FIXTURE_HTML = `<!doctype html>
<html>
	<head><title>Fixture App</title><script>window.__x = 1;</script></head>
	<body>
		<h1>Fixture App</h1>
		<p>Welcome &amp; enjoy</p>
		<a href="/?path=/review/">Open the review</a>
		<button id="counter">click me</button>
		<input id="name" aria-label="Name" />
	</body>
</html>`;

const PANE_NOT_OPEN_TEXT =
  'No preview is open. Use `preview_start` or `navigate` with {"url": "https://…"} to open a browser tab at a URL';
const NO_PANE_TABS_TEXT =
  'The Browser pane isn\'t open yet, so there are no tabs. Call preview_start or navigate with {"url": "https://…"} to open it.';

let fixtureServer: Server;
let fixtureUrl: string;
let client: McpClient;

beforeAll(async () => {
  fixtureServer = createServer((request, response) => {
    response.setHeader('content-type', 'text/html');
    response.end(FIXTURE_HTML);
  });
  await new Promise<void>((resolve) => {
    fixtureServer.listen(0, '127.0.0.1', resolve);
  });
  const address = fixtureServer.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Failed to start fixture server');
  }
  fixtureUrl = `http://127.0.0.1:${address.port}/`;
  client = new McpClient();
});

afterAll(async () => {
  await client.close();
  await new Promise<void>((resolve) => {
    fixtureServer.close(() => resolve());
  });
});

describe('Claude Browser pane mock', () => {
  test('handshake exposes exactly the browser-flow tools', async () => {
    const init = await client.request('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '0' },
    });
    expect(init.result?.serverInfo).toMatchObject({ name: 'Browser' });

    const list = await client.request('tools/list');
    const names = (list.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(names).toEqual([
      'preview_start',
      'navigate',
      'tabs_create',
      'tabs_context',
      'tabs_select',
      'tabs_close',
      'read_page',
      'get_page_text',
      'find',
    ]);
  });

  test('preview_start refuses the dev-server form', async () => {
    const refusal =
      "Dev servers aren't available in this session. To browse, call preview_start with a `url`, or use `navigate`.";
    expect(expectError(await client.callTool('preview_start'))).toBe(refusal);
    expect(expectError(await client.callTool('preview_start', { name: 'storybook' }))).toBe(
      refusal
    );
  });

  test('tab tools report a closed pane', async () => {
    const context = expectOk(await client.callTool('tabs_context'));
    expect(parseLeadingJson(context)).toEqual({ browserOpen: false, tabs: [] });
    expect(context).toContain(NO_PANE_TABS_TEXT);

    expect(expectOk(await client.callTool('tabs_create'))).toBe(
      `No tab was created. ${NO_PANE_TABS_TEXT}`
    );
  });

  test('page tools error on a closed pane', async () => {
    expect(expectError(await client.callTool('read_page'))).toBe(PANE_NOT_OPEN_TEXT);
    expect(expectError(await client.callTool('get_page_text'))).toBe(PANE_NOT_OPEN_TEXT);
    expect(expectError(await client.callTool('find', { query: 'x' }))).toBe(PANE_NOT_OPEN_TEXT);
  });

  test('navigate on a closed pane opens it like preview_start', async () => {
    const result = expectOk(await client.callTool('navigate', { url: fixtureUrl }));

    expect(parseLeadingJson(result)).toEqual({
      serverId: 'browser-pane',
      tabId: 'tab_1',
      reused: false,
      type: 'browser',
      navOk: true,
    });
    expect(result).toContain(
      'Browser pane opened. Use serverId "browser-pane" with read_page / computer / navigate.'
    );
  });

  test('tabs_context lists the open tab', async () => {
    const context = expectOk(await client.callTool('tabs_context'));
    expect(parseLeadingJson(context)).toEqual({
      browserOpen: true,
      tabs: [{ tabId: 'tab_1', origin: fixtureUrl.replace(/\/$/, ''), isActive: true }],
    });
    expect(context).toContain('The Browser pane is currently displayed.');
  });

  test('get_page_text returns the title, URL and visible text', async () => {
    const result = expectOk(await client.callTool('get_page_text'));
    expect(result).toBe(
      [
        'Title: Fixture App',
        `URL: ${fixtureUrl}`,
        'Source element: <body>',
        '---',
        'Fixture App',
        'Welcome & enjoy',
        'Open the review',
        'click me',
      ].join('\n')
    );
  });

  test('read_page returns a tree with refs on interactive elements', async () => {
    const result = expectOk(await client.callTool('read_page'));
    expect(result).toBe(
      [
        'document "Fixture App"',
        'heading "Fixture App"',
        'paragraph "Welcome & enjoy"',
        'link "Open the review" [ref_1]',
        'button "click me" [ref_2]',
        'textbox "Name" [ref_3]',
        '',
        'Viewport: 1280x720',
      ].join('\n')
    );

    const interactive = expectOk(await client.callTool('read_page', { filter: 'interactive' }));
    expect(interactive).not.toContain('heading');
    expect(interactive).toContain('button "click me" [ref_2]');
  });

  test('find matches interactive elements case-insensitively', async () => {
    expect(expectOk(await client.callTool('find', { query: 'CLICK' }))).toBe(
      'Found 1 match(es) for "CLICK":\n- button "click me" [ref_2]'
    );
    expect(expectOk(await client.callTool('find', { query: 'missing' }))).toBe(
      'No matches for "missing".'
    );
  });

  test('navigate on an open pane moves the fronted tab', async () => {
    const result = expectOk(
      await client.callTool('navigate', { url: `${fixtureUrl}?path=/review/` })
    );
    expect(result).toBe(`navigated to ${fixtureUrl.replace(/\/$/, '')}`);
    expect(expectOk(await client.callTool('get_page_text'))).toContain(
      `URL: ${fixtureUrl}?path=/review/`
    );

    expect(expectOk(await client.callTool('navigate', { url: 'back' }))).toBe('navigated back');
    expect(expectOk(await client.callTool('get_page_text'))).toContain(`URL: ${fixtureUrl}\n`);
  });

  test('tabs_create, tabs_select and tabs_close manage tabs until the pane closes', async () => {
    const created = expectOk(await client.callTool('tabs_create'));
    expect(parseLeadingJson(created)).toEqual({
      serverId: 'browser-pane',
      tabId: 'tab_2',
      reused: false,
      type: 'browser',
    });
    expect(created).toContain('Opened tab tab_2 in the background');

    expect(expectOk(await client.callTool('tabs_select', { tabId: 'tab_2' }))).toBe(
      'Fronted tab tab_2.'
    );
    expect(expectError(await client.callTool('tabs_select', { tabId: 'tab_9' }))).toBe(
      'Tab tab_9 not found.'
    );

    expect(expectOk(await client.callTool('tabs_close', { tabId: 'tab_2' }))).toBe(
      'Closed tab tab_2.'
    );
    expect(expectOk(await client.callTool('tabs_close', { tabId: 'tab_1' }))).toBe(
      'Closed tab tab_1. That was the last tab, so the Browser pane is now closed — use `preview_start` to open it again.'
    );
    expect(parseLeadingJson(expectOk(await client.callTool('tabs_context')))).toEqual({
      browserOpen: false,
      tabs: [],
    });
  });

  test('preview_start with a url reopens the pane', async () => {
    const result = expectOk(await client.callTool('preview_start', { url: fixtureUrl }));
    expect(parseLeadingJson(result)).toMatchObject({ tabId: 'tab_3', navOk: true });
  });
});
