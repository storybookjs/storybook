import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
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
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  _meta?: { errorClass?: string };
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
	<head><title>Fixture App</title></head>
	<body>
		<h1>Fixture App</h1>
		<p>Welcome &amp; enjoy</p>
		<a href="/?path=/review/">Open the review</a>
		<button id="counter" onclick="this.textContent = 'clicked ' + ++window.clicks">click me</button>
		<label for="name">Name</label>
		<input id="name" />
		<script>
			window.clicks = 0;
			document.body.insertAdjacentHTML('beforeend', '<p>Rendered by script</p>');
			console.log('fixture ready');
			console.error('fixture failure');
			fetch('/api/data');
		</script>
	</body>
</html>`;

async function isChromiumInstalled(): Promise<boolean> {
  try {
    const { chromium } = await import('playwright');
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}

const PANE_NOT_OPEN_TEXT =
  'No preview is open. Use `preview_start` or `navigate` with {"url": "https://…"} to open a browser tab at a URL.';
const NO_PANE_TABS_TEXT =
  'The Browser pane isn\'t open yet, so there are no tabs. Call preview_start or navigate with {"url": "https://…"} to open it.';

let fixtureServer: Server;
let fixtureUrl: string;
let fixtureOrigin: string;
let client: McpClient;

function tabContext(tabId: string, url: string): string {
  return `\n\n\nTab Context:\n- Executed on tabId: ${tabId}\n- Available tabs:\n  • tabId ${tabId}: "Fixture App" ("${url}")`;
}

function withoutTabContext(text: string): string {
  return text.replace(/\n\n\nTab Context:[\s\S]*$/, '');
}

function refOf(tree: string, line: string): string {
  const match = tree.split('\n').find((entry) => entry.includes(line));
  const ref = match?.match(/\[(ref_\d+)\]/)?.[1];
  if (ref === undefined) {
    throw new Error(`No ref for "${line}" in:\n${tree}`);
  }
  return ref;
}

beforeAll(async () => {
  fixtureServer = createServer((request, response) => {
    if (request.url === '/api/data') {
      response.setHeader('content-type', 'application/json');
      response.end('{"items":[1,2]}');
      return;
    }
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
  fixtureOrigin = `http://127.0.0.1:${address.port}`;
  fixtureUrl = `${fixtureOrigin}/`;
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
    expect(init.result?.serverInfo).toEqual({ name: 'Browser', version: '2.16120.0' });

    const list = await client.request('tools/list');
    const names = (list.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(names).toEqual([
      'preview_start',
      'read_page',
      'computer',
      'form_input',
      'navigate',
      'find',
      'get_page_text',
      'javascript_tool',
      'read_console_messages',
      'read_network_requests',
      'resize_window',
      'tabs_context',
      'tabs_create',
      'tabs_select',
      'tabs_close',
      'browser_batch',
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

  test('preview_start and navigate refuse local files and malformed URLs', async () => {
    const localFile = await client.callTool('preview_start', { url: '/tmp/index.html' });
    expect(expectError(localFile)).toBe('opening local files is not available in this session.');
    expect(localFile._meta).toEqual({ errorClass: 'file_open_unavailable' });

    expect(expectError(await client.callTool('navigate', { url: 'storybook' }))).toBe(
      'storybook is not a valid file path or URL — use an absolute path, a path starting with ~/ or ./, or a file:// URL for a local file, or a full URL like https://example.com for a website'
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
    expect(expectError(await client.callTool('javascript_tool', { text: '1' }))).toBe(
      PANE_NOT_OPEN_TEXT
    );
    expect(expectError(await client.callTool('computer', { action: 'screenshot' }))).toBe(
      `There is no page to screenshot, zoom into or click — this tool only acts on a page in the Browser pane (not on files, the desktop or other apps). ${PANE_NOT_OPEN_TEXT}`
    );
  });

  test('browser_batch validates its actions', async () => {
    expect(expectError(await client.callTool('browser_batch', { actions: [] }))).toBe(
      'actions must be a non-empty array'
    );
    expect(
      expectError(
        await client.callTool('browser_batch', {
          actions: [{ name: 'preview_start', input: { url: 'https://example.com' } }],
        })
      )
    ).toBe('actions[0]: "preview_start" cannot run in a batch');
    expect(
      expectError(
        await client.callTool('browser_batch', {
          actions: [{ name: 'mcp__Browser__read_page', input: {} }],
        })
      )
    ).toBe(`actions[0] (read_page) failed: ${PANE_NOT_OPEN_TEXT} (0 completed, 0 remaining)`);
  });
});

describe.skipIf(!(await isChromiumInstalled()))(
  'Claude Browser pane mock with a real browser',
  { timeout: 30_000 },
  () => {
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
        tabs: [{ tabId: 'tab_1', origin: fixtureOrigin, isActive: true }],
      });
      expect(context).toContain('The Browser pane is currently displayed.');
    });

    test('get_page_text returns the title, URL and rendered text with the tab context', async () => {
      const result = expectOk(await client.callTool('get_page_text'));
      expect(result).toBe(
        [
          'Title: Fixture App',
          `URL: ${fixtureUrl}`,
          'Source element: <body>',
          '---',
          'Fixture App',
          '',
          'Welcome & enjoy',
          '',
          'Open the review click me Name ',
          '',
          'Rendered by script',
        ].join('\n') + tabContext('tab_1', fixtureUrl)
      );
    });

    test('read_page returns the ref-tagged tree of the rendered page', async () => {
      const result = expectOk(await client.callTool('read_page'));
      expect(result).toMatch(/^heading "Fixture App" \[ref_\d+\]$/m);
      expect(result).toMatch(/^link "Open the review" \[ref_\d+\] href="\/\?path=\/review\/"$/m);
      expect(result).toMatch(/^button "click me" \[ref_\d+\]$/m);
      expect(result).toMatch(/^textbox "Name" \[ref_\d+\]$/m);
      expect(withoutTabContext(result)).toMatch(/\n\nViewport: 1280x720$/);
    });

    test('find matches ref-tagged tree lines case-insensitively', async () => {
      expect(
        withoutTabContext(expectOk(await client.callTool('find', { query: 'CLICK' })))
      ).toMatch(/^Found 1 match\(es\) for "CLICK":\n- button "click me" \[ref_\d+\]$/);
      expect(withoutTabContext(expectOk(await client.callTool('find', { query: 'missing' })))).toBe(
        'No matches for "missing".'
      );
    });

    test('computer screenshot returns a JPEG in the 800px coordinate frame', async () => {
      const result = await client.callTool('computer', { action: 'screenshot' });
      expectOk(result);
      const [image, size] = result.content;
      expect(image).toMatchObject({ type: 'image', mimeType: 'image/jpeg' });
      expect(Buffer.from(image?.data ?? '', 'base64').subarray(0, 2)).toEqual(
        Buffer.from([0xff, 0xd8])
      );
      expect(size).toEqual({ type: 'text', text: 'Screenshot size: 800x450' });

      const half = await client.callTool('computer', { action: 'screenshot', scale: 0.5 });
      expect(half.content[1]?.text).toBe(
        'Screenshot size: 400x225 0.5-scale view; coordinate frame: 800x450.'
      );
    });

    test('computer clicks by ref and by screenshot coordinate change the page', async () => {
      const tree = expectOk(await client.callTool('read_page', { filter: 'interactive' }));
      const button = refOf(tree, 'button "click me"');

      const click = expectOk(
        await client.callTool('computer', { action: 'left_click', ref: button })
      );
      expect(withoutTabContext(click)).toMatch(
        new RegExp(`^left_click at \\(\\d+, \\d+\\) \\[${button}\\]$`)
      );
      expect(
        withoutTabContext(expectOk(await client.callTool('find', { query: 'clicked 1' })))
      ).toContain(`button "clicked 1" [${button}]`);

      const [, x = '', y = ''] = click.match(/at \((\d+), (\d+)\)/) ?? [];
      const scaled = [Math.round((Number(x) * 800) / 1280), Math.round((Number(y) * 450) / 720)];
      expect(
        withoutTabContext(
          expectOk(await client.callTool('computer', { action: 'left_click', coordinate: scaled }))
        )
      ).toBe(`left_click at (${scaled[0]}, ${scaled[1]})`);
      expect(
        withoutTabContext(
          expectOk(
            await client.callTool('javascript_tool', {
              action: 'javascript_exec',
              text: 'window.clicks',
            })
          )
        )
      ).toBe('2');

      expect(
        expectError(
          await client.callTool('computer', { action: 'left_click', coordinate: [900, 10] })
        )
      ).toBe(
        'left_click: coordinate (900, 10) is outside the coordinate frame (800x450). Coordinates are pixels in the full-resolution frame — if the page changed, take a new screenshot first.'
      );
    });

    test('form_input and typing set input values', async () => {
      const tree = expectOk(await client.callTool('read_page'));
      const input = refOf(tree, 'textbox "Name"');

      expect(
        withoutTabContext(
          expectOk(await client.callTool('form_input', { ref: input, value: 'Ada' }))
        )
      ).toBe(`filled ${input} with value`);
      expect(
        withoutTabContext(
          expectOk(
            await client.callTool('javascript_tool', {
              action: 'javascript_exec',
              text: 'document.querySelector("#name").value',
            })
          )
        )
      ).toBe('"Ada"');

      expectOk(await client.callTool('computer', { action: 'triple_click', ref: input }));
      expect(
        withoutTabContext(
          expectOk(await client.callTool('computer', { action: 'type', text: 'Grace' }))
        )
      ).toBe('typed 5 chars');
      expect(
        withoutTabContext(
          expectOk(await client.callTool('computer', { action: 'key', text: 'End exclam !' }))
        )
      ).toBe('pressed End exclam ! x1');

      expect(expectError(await client.callTool('form_input', { ref: 'ref_999', value: 'x' }))).toBe(
        'form_input failed: ref not found or stale: ref_999'
      );
    });

    test('javascript_tool returns the last expression, or a returned value', async () => {
      expect(
        withoutTabContext(
          expectOk(
            await client.callTool('javascript_tool', {
              action: 'javascript_exec',
              text: 'const name = document.querySelector("#name"); ({ value: name.value, title: document.title })',
            })
          )
        )
      ).toBe(JSON.stringify({ value: 'Grace!', title: 'Fixture App' }, null, 2));
      expect(
        withoutTabContext(
          expectOk(
            await client.callTool('javascript_tool', {
              action: 'javascript_exec',
              text: 'return 1 + 1',
            })
          )
        )
      ).toBe('2');
      expect(
        expectError(
          await client.callTool('javascript_tool', {
            action: 'javascript_exec',
            text: 'missingValue',
          })
        )
      ).toMatch(/^javascript_tool failed: ReferenceError: missingValue is not defined/);
    });

    test('read_console_messages returns the page console output', async () => {
      expect(withoutTabContext(expectOk(await client.callTool('read_console_messages')))).toBe(
        '[log] fixture ready\n[error] fixture failure'
      );
      expect(
        withoutTabContext(
          expectOk(await client.callTool('read_console_messages', { onlyErrors: true }))
        )
      ).toBe('[error] fixture failure');
    });

    test('read_network_requests lists requests and returns response bodies', async () => {
      const listing = withoutTabContext(
        expectOk(await client.callTool('read_network_requests', { urlPattern: '/api/' }))
      );
      expect(listing).toMatch(new RegExp(`^\\[(.+)\\] GET ${fixtureOrigin}/api/data → 200 OK$`));
      const requestId = listing.match(/^\[(.+?)\]/)?.[1];
      expect(
        withoutTabContext(expectOk(await client.callTool('read_network_requests', { requestId })))
      ).toBe('{"items":[1,2]}');
    });

    test('resize_window emulates a viewport until reset', async () => {
      expect(
        withoutTabContext(expectOk(await client.callTool('resize_window', { preset: 'mobile' })))
      ).toBe(
        'Viewport set to 375x812 (mobile) on this tab (scaled down to fit if larger than the pane). Reset it with preset "desktop" as soon as you finish testing.'
      );
      const width = expectOk(
        await client.callTool('javascript_tool', { action: 'javascript_exec', text: 'innerWidth' })
      );
      expect(width).toMatch(/^375\n/);
      expect(width).toContain(
        '- Viewport: emulating 375x812 (you set this; reset it with preset "desktop" when you finish testing)'
      );

      expect(
        withoutTabContext(expectOk(await client.callTool('resize_window', { preset: 'desktop' })))
      ).toBe(
        "Viewport emulation cleared; the tab is back to the pane's responsive size (desktop)."
      );
    });

    test('browser_batch runs actions in order and interleaves images', async () => {
      const result = await client.callTool('browser_batch', {
        actions: [
          { name: 'find', input: { query: 'Fixture' } },
          { name: 'computer', input: { action: 'screenshot', scale: 0.2 } },
        ],
      });
      expectOk(result);
      expect(result.content.map((item) => item.type)).toEqual(['text', 'text', 'image']);
      expect(result.content[0]?.text).toMatch(/^\[find\] Found 1 match\(es\) for "Fixture":/);
      expect(result.content[1]?.text).toMatch(/^\[computer:screenshot\] Screenshot size: 160x90 /);
    });

    test('navigate on an open pane moves the fronted tab', async () => {
      const target = `${fixtureUrl}?path=/review/`;
      const result = expectOk(await client.callTool('navigate', { url: target }));
      expect(result).toBe(`navigated to ${target}${tabContext('tab_1', target)}`);

      expect(withoutTabContext(expectOk(await client.callTool('navigate', { url: 'back' })))).toBe(
        'navigated back'
      );
      expect(expectOk(await client.callTool('get_page_text'))).toContain(`URL: ${fixtureUrl}\n`);
      expect(
        withoutTabContext(expectOk(await client.callTool('navigate', { url: 'forward' })))
      ).toBe('navigated forward');
      expect(expectError(await client.callTool('navigate', { url: 'forward' }))).toBe(
        'no forward history'
      );
    });

    test('page tools report a failed load right after it', async () => {
      expect(expectError(await client.callTool('navigate', { url: 'http://127.0.0.1:1/' }))).toBe(
        'navigation to http://127.0.0.1:1 was denied or failed'
      );
      expect(expectError(await client.callTool('read_page'))).toBe(
        'The last page load in this tab failed, so there is no page to act on. Use `navigate` (pass this tabId) to retry or go elsewhere.'
      );
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
      expect(expectError(await client.callTool('read_page', { tabId: 'tab_2' }))).toBe(
        'This tab is blank — no page is loaded in it. Load one with `navigate` (pass this tabId), or address the tab that already has your page (`tabs_context` lists them).'
      );

      expectOk(await client.callTool('navigate', { tabId: 'tab_2', url: fixtureUrl }));
      expect(expectError(await client.callTool('navigate', { tabId: 'tab_2', url: 'back' }))).toBe(
        'no back history'
      );

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
  }
);
