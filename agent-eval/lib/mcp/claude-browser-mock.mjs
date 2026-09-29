#!/usr/bin/env node
// Stand-in for the Claude desktop app's Browser pane in agent evals. Tool texts,
// schemas and result shapes follow Claude.app 2.7032.0, minus references to its
// `computer` and `form_input` tools, which this mock does not have. It is
// registered as `Browser` because Claude Code refuses to load a server from
// `.mcp.json` whose name sanitizes to the reserved `Claude_Browser`. Pages load
// in headless Chromium from the workspace `playwright` install.
import { createInterface } from 'node:readline';

const SERVER_INFO = { name: 'Browser', version: '2.7032.0' };
const SERVER_ID = 'browser-pane';
const VIEWPORT = { width: 1280, height: 720 };
const DEFAULT_MAX_CHARS = 50_000;
const MAX_FIND_MATCHES = 20;
const NAVIGATION_TIMEOUT_MS = 30_000;

const NO_PANE_TABS_TEXT =
  'The Browser pane isn\'t open yet, so there are no tabs. Call preview_start or navigate with {"url": "https://…"} to open it.';
const PANE_NOT_OPEN_TEXT =
  'No preview is open. Use `preview_start` or `navigate` with {"url": "https://…"} to open a browser tab at a URL';
const DEV_SERVERS_UNAVAILABLE_TEXT =
  "Dev servers aren't available in this session. To browse, call preview_start with a `url`, or use `navigate`.";

const TAB_ID_PROPERTY = {
  tabId: {
    type: 'string',
    description:
      'Tab to act on within the preview context. Omit for the fronted tab; get ids from tabs_context.',
  },
};

const TOOLS = [
  {
    name: 'preview_start',
    description:
      'Open the Browser pane at a URL (a fresh browser tab; no dev server on this surface). Returns a `tabId` — pass it to read_page / navigate / etc. to target that tab; omitting tabId acts on the fronted tab.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open in the Browser pane.' },
      },
      required: ['url'],
    },
  },
  {
    name: 'navigate',
    description:
      'Navigate the Browser pane to a URL, or go "back"/"forward" in history. If the Browser pane isn\'t open yet, this opens it at the URL (no dev server needed).',
    inputSchema: {
      type: 'object',
      properties: {
        ...TAB_ID_PROPERTY,
        url: {
          type: 'string',
          description:
            'The URL to navigate to. Can be provided with or without protocol (defaults to https://). Use "forward" to go forward in history or "back" to go back in history.',
        },
        force: {
          type: 'boolean',
          description:
            'If the page shows a "Leave site?" dialog because of unsaved changes, discard those changes and navigate anyway. Defaults to false.',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'tabs_create',
    description:
      'Open a fresh blank Browser pane tab; returns the new tabId. Opens in the background by default — set `foreground: true` when the user wants to watch. Prefer `preview_start` with a `url` when you know the destination; use `navigate` to load a URL into a blank tab.',
    inputSchema: {
      type: 'object',
      properties: {
        foreground: {
          type: 'boolean',
          description:
            "Front the new tab (user asked to see it or is following along). Default false: open behind the user's current tab.",
        },
      },
    },
  },
  {
    name: 'tabs_context',
    description:
      "List every Browser pane tab (origin only — titles are page-authored). Returns {browserOpen, tabs: [{tabId, origin, isActive}]} plus a line saying whether the pane is currently displayed or hidden (a hidden pane still works; prefer `read_page` / `get_page_text` over screenshots while it is hidden). browserOpen is false (and tabs empty) until `preview_start` or `navigate` opens the pane, so you don't need to call this before opening it.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'tabs_select',
    description:
      'Front the given Browser pane tab. Background tabs keep running while you drive them, so front one only when the user should look — or for a page that pauses itself while hidden (e.g. a video player).',
    inputSchema: {
      type: 'object',
      properties: { tabId: { type: 'string', description: 'Tab to front.' } },
      required: ['tabId'],
    },
  },
  {
    name: 'tabs_close',
    description:
      'Close one Browser pane tab. Closing the last tab closes the Browser pane itself (reopen it with `preview_start`).',
    inputSchema: {
      type: 'object',
      properties: { tabId: { type: 'string', description: 'Tab to close.' } },
      required: ['tabId'],
    },
  },
  {
    name: 'read_page',
    description:
      'Read the current page in the Browser pane as a YAML-style accessibility tree. Prefer this over screenshot for verifying text and structure. Output is limited to 50000 characters by default; if it exceeds the limit it is truncated with a note — pass a larger max_chars, or use ref_id/depth to focus.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TAB_ID_PROPERTY,
        filter: {
          type: 'string',
          enum: ['interactive', 'all'],
          description:
            "'interactive' returns only clickable/typable elements; 'all' (default) returns the full tree.",
        },
        depth: { type: 'number', description: 'Maximum tree depth to traverse (default: 15).' },
        ref_id: {
          type: 'string',
          description:
            'Restrict the tree to descendants of this `ref_N` (from a previous read_page).',
        },
        max_chars: {
          type: 'number',
          description: 'Maximum characters of output (default: 50000).',
        },
      },
    },
  },
  {
    name: 'get_page_text',
    description:
      "Extract the visible text of the Browser pane's page (article/main content first, falls back to body innerText).",
    inputSchema: {
      type: 'object',
      properties: {
        ...TAB_ID_PROPERTY,
        max_chars: {
          type: 'number',
          description: 'Maximum characters of output (default: 50000).',
        },
      },
    },
  },
  {
    name: 'find',
    description:
      'Search the current page in the Browser pane for elements whose accessibility-tree line (role / name / text) contains `query`, case-insensitively. Returns up to 20 matches.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TAB_ID_PROPERTY,
        query: {
          type: 'string',
          description:
            'Text to look for in an element\'s role, name or text (case-insensitive substring, e.g. "Sign in", "search", "Add to cart").',
        },
      },
      required: ['query'],
    },
  },
];

// The open pane: `{ tabs: Map<tabId, tab>, activeTabId }`, or null while closed.
let pane = null;
let tabSequence = 0;
let browserPromise;

function text(value) {
  return { content: [{ type: 'text', text: value }] };
}

function errorText(value) {
  return { content: [{ type: 'text', text: value }], isError: true };
}

function normalizeUrl(value) {
  const withProtocol = /^([a-z][a-z0-9+.-]*:\/\/|about:)/i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).href;
}

function getBrowser() {
  browserPromise ??= import('playwright')
    .then(({ chromium }) => chromium.launch({ headless: true }))
    .catch((error) => {
      browserPromise = undefined;
      throw new Error(`Failed to launch the browser: ${error?.message ?? error}`);
    });
  return browserPromise;
}

async function pageOf(tab) {
  tab.page ??= await (await getBrowser()).newPage({ viewport: VIEWPORT });
  return tab.page;
}

function createTab(url) {
  tabSequence += 1;
  const tab = { id: `tab_${tabSequence}`, url, page: null };
  pane.tabs.set(tab.id, tab);
  return tab;
}

function resolveTab(tabId) {
  return pane.tabs.get(tabId ?? pane.activeTabId);
}

// Throws when Chromium cannot start; a page that fails to load returns false.
async function loadUrl(tab, url) {
  tab.url = url;
  const page = await pageOf(tab);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  } finally {
    tab.url = page.url();
  }
}

async function openBrowserTab(rawUrl) {
  let url;
  try {
    url = normalizeUrl(rawUrl);
  } catch {
    return errorText(`navigation to ${rawUrl} was denied or failed`);
  }

  pane ??= { tabs: new Map(), activeTabId: null };
  const existing = [...pane.tabs.values()].find((tab) => tab.url === url);
  const tab = existing ?? createTab(url);
  pane.activeTabId = tab.id;
  const navOk = await loadUrl(tab, url);

  const result = {
    serverId: SERVER_ID,
    tabId: tab.id,
    reused: existing !== undefined,
    type: 'browser',
    navOk,
  };
  return text(
    `${JSON.stringify(result, null, 2)}\nBrowser pane opened. Use serverId "${SERVER_ID}" with read_page / navigate.`
  );
}

async function handlePreviewStart(args) {
  const url = typeof args.url === 'string' ? args.url.trim() : '';
  if (url.length === 0 || args.name !== undefined) {
    return errorText(DEV_SERVERS_UNAVAILABLE_TEXT);
  }
  return openBrowserTab(url);
}

async function handleNavigate(args) {
  const url = typeof args.url === 'string' ? args.url.trim() : '';
  if (url.length === 0) {
    return errorText('`navigate` requires a string `url`.');
  }
  const direction = /^(back|forward)$/i.test(url) ? url.toLowerCase() : null;

  if (pane === null) {
    return direction === null ? openBrowserTab(url) : errorText(PANE_NOT_OPEN_TEXT);
  }

  const tab = resolveTab(args.tabId);
  if (tab === undefined) {
    return errorText(`Tab ${args.tabId} not found.`);
  }

  if (direction !== null) {
    if (tab.page !== null) {
      await (direction === 'back' ? tab.page.goBack() : tab.page.goForward());
      tab.url = tab.page.url();
    }
    return text(`navigated ${direction}`);
  }

  let target;
  try {
    target = normalizeUrl(url);
  } catch {
    return errorText(`navigation to ${url} was denied or failed`);
  }
  if (!(await loadUrl(tab, target))) {
    return errorText(`navigation to ${url} was denied or failed`);
  }
  return text(`navigated to ${new URL(target).origin}`);
}

function handleTabsContext() {
  if (pane === null) {
    return text(
      `${JSON.stringify({ browserOpen: false, tabs: [] }, null, 2)}\n${NO_PANE_TABS_TEXT}`
    );
  }
  const tabs = [...pane.tabs.values()].map((tab) => ({
    tabId: tab.id,
    origin: new URL(tab.url).origin,
    isActive: tab.id === pane.activeTabId,
  }));
  return text(
    `${JSON.stringify({ browserOpen: true, tabs }, null, 2)}\nThe Browser pane is currently displayed.`
  );
}

function handleTabsCreate(args) {
  if (pane === null) {
    return text(`No tab was created. ${NO_PANE_TABS_TEXT}`);
  }
  const foreground = args.foreground === true;
  const tab = createTab('about:blank');
  if (foreground) {
    pane.activeTabId = tab.id;
  }
  const result = { serverId: SERVER_ID, tabId: tab.id, reused: false, type: 'browser' };
  const note = foreground
    ? `Opened tab ${tab.id} in the foreground. Use \`navigate\` with tabId "${tab.id}" to load a URL.`
    : `Opened tab ${tab.id} in the background — the user's current tab stays in front. Use \`navigate\` with tabId "${tab.id}" to load a URL; front it with \`tabs_select\` when the user should look.`;
  return text(`${JSON.stringify(result, null, 2)}\n${note}`);
}

function handleTabsSelect(args) {
  if (pane === null) {
    return errorText(PANE_NOT_OPEN_TEXT);
  }
  if (typeof args.tabId !== 'string') {
    return errorText('`tabs_select` requires a string `tabId`.');
  }
  if (!pane.tabs.has(args.tabId)) {
    return errorText(`Tab ${args.tabId} not found.`);
  }
  pane.activeTabId = args.tabId;
  return text(`Fronted tab ${args.tabId}.`);
}

async function handleTabsClose(args) {
  if (pane === null) {
    return errorText(PANE_NOT_OPEN_TEXT);
  }
  if (typeof args.tabId !== 'string') {
    return errorText('`tabs_close` requires a string `tabId`.');
  }
  const tab = pane.tabs.get(args.tabId);
  if (tab === undefined) {
    return errorText(`Tab ${args.tabId} not found.`);
  }
  pane.tabs.delete(args.tabId);
  await tab.page?.close();
  if (pane.tabs.size === 0) {
    pane = null;
    return text(
      `Closed tab ${args.tabId}. That was the last tab, so the Browser pane is now closed — use \`preview_start\` to open it again.`
    );
  }
  if (pane.activeTabId === args.tabId) {
    pane.activeTabId = [...pane.tabs.keys()].at(-1);
  }
  return text(`Closed tab ${args.tabId}.`);
}

async function withPage(toolName, args, render) {
  if (pane === null) {
    return errorText(PANE_NOT_OPEN_TEXT);
  }
  const tab = resolveTab(args.tabId);
  if (tab === undefined) {
    return errorText(`Tab ${args.tabId} not found.`);
  }
  try {
    return await render(await pageOf(tab), tab);
  } catch (error) {
    return errorText(`${toolName} failed: ${error?.message ?? error}`);
  }
}

function truncate(value, limit) {
  return value.length > limit
    ? `${value.slice(0, limit)}\n[output truncated at ${limit} chars]`
    : value;
}

function maxChars(value) {
  return Number.isFinite(value) ? value : DEFAULT_MAX_CHARS;
}

const HANDLERS = {
  preview_start: handlePreviewStart,
  navigate: handleNavigate,
  tabs_create: handleTabsCreate,
  tabs_context: handleTabsContext,
  tabs_select: handleTabsSelect,
  tabs_close: handleTabsClose,
  read_page: (args) =>
    withPage('read_page', args, async (page) => {
      const tree = await page.locator('body').ariaSnapshot();
      return text(
        `${truncate(tree, maxChars(args.max_chars)) || '(empty page)'}\n\nViewport: ${VIEWPORT.width}x${VIEWPORT.height}`
      );
    }),
  get_page_text: (args) =>
    withPage('get_page_text', args, async (page, tab) => {
      const content = await page.locator('body').innerText();
      return text(
        `Title: ${await page.title()}\nURL: ${tab.url}\nSource element: <body>\n---\n${truncate(content, maxChars(args.max_chars))}`
      );
    }),
  find: (args) =>
    withPage('find', args, async (page) => {
      const query = typeof args.query === 'string' ? args.query : '';
      const matches = (await page.locator('body').ariaSnapshot())
        .split('\n')
        .map((line) => line.trim().replace(/^- /, ''))
        .filter((line) => line.toLowerCase().includes(query.toLowerCase()))
        .slice(0, MAX_FIND_MATCHES);
      return text(
        matches.length === 0
          ? `No matches for "${query}".`
          : `Found ${matches.length} match(es) for "${query}":\n${matches.map((line) => `- ${line}`).join('\n')}`
      );
    }),
};

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

async function handle(request) {
  const { id, method, params } = request;

  if (method === 'initialize') {
    reply(id, {
      protocolVersion: params?.protocolVersion ?? '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
    return;
  }

  if (method === 'ping') {
    reply(id, {});
    return;
  }

  if (method === 'tools/list') {
    reply(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    const name = params?.name;
    const handler = HANDLERS[name];
    if (!handler) {
      fail(id, -32601, `Unknown tool: ${name}`);
      return;
    }
    try {
      reply(id, await handler(params?.arguments ?? {}));
    } catch (error) {
      reply(id, errorText(`${name} failed: ${error?.message ?? error}`));
    }
    return;
  }

  if (id !== undefined && id !== null) {
    fail(id, -32601, `Unknown method: ${method}`);
  }
}

const rl = createInterface({ input: process.stdin });
// Serialize request handling: the handlers share the pane state.
let requestQueue = Promise.resolve();
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  requestQueue = requestQueue.then(() => {
    try {
      return handle(JSON.parse(trimmed));
    } catch {
      return undefined;
    }
  });
  requestQueue = requestQueue.catch(() => {});
});
rl.on('close', async () => {
  await requestQueue;
  await browserPromise?.then((browser) => browser.close()).catch(() => {});
  process.exit(0);
});
