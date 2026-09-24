#!/usr/bin/env node
/**
 * Stand-in MCP server for the Claude desktop app's Browser pane (its
 * `Claude Browser` MCP server), used in agent evals. Tool names, descriptions,
 * schemas, result shapes and error texts are copied from Claude.app 2.7032.0.
 * Only the browser flow exists here: `preview_start` takes a `url` and never a
 * dev-server `name`, like the app's surfaces without dev servers.
 *
 * Registered as `Browser` (tools `mcp__Browser__*`), not under the app's own
 * name: Claude Code 2.1.280 reserves `Claude Browser` and every spelling that
 * sanitizes to `Claude_Browser`, and refuses to load such a server from
 * `.mcp.json`.
 *
 * Pages are fetched over plain HTTP, there is no Chromium: `read_page`,
 * `get_page_text` and `find` work from the served HTML, so a client-rendered
 * app shows only its shell.
 */
import { createInterface } from 'node:readline';

const SERVER_INFO = { name: 'Browser', version: '2.7032.0' };
const SERVER_ID = 'browser-pane';
const VIEWPORT = { width: 1280, height: 720 };
const DEFAULT_MAX_CHARS = 50_000;
const MAX_FIND_MATCHES = 20;
const FETCH_TIMEOUT_MS = 30_000;

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
      'Open the Browser pane at a URL (a fresh browser tab; no dev server on this surface). Returns a `tabId` — pass it to read_page / computer / navigate / etc. to target that tab; omitting tabId acts on the fronted tab.',
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
      'Read the current page in the Browser pane as a YAML-style accessibility tree. Each interactive element is tagged `[ref_N]` for use with `computer`/`form_input`/`find`. Prefer this over screenshot for verifying text and structure. Output is limited to 50000 characters by default; if it exceeds the limit it is truncated with a note — pass a larger max_chars, or use ref_id/depth to focus.',
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
      'Search the current page in the Browser pane for elements whose accessibility-tree line (role / name / text) contains `query`, case-insensitively. Returns up to 20 `ref_N` matches usable with `computer`/`form_input`.',
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

function text(value) {
  return { content: [{ type: 'text', text: value }] };
}

function errorText(value) {
  return { content: [{ type: 'text', text: value }], isError: true };
}

function normalizeUrl(value) {
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).href;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '(target)';
  }
}

function createTab(url) {
  tabSequence += 1;
  const tab = { id: `tab_${tabSequence}`, url, history: [url], historyIndex: 0, page: null };
  pane.tabs.set(tab.id, tab);
  return tab;
}

function resolveTab(tabId) {
  return tabId === undefined ? pane.tabs.get(pane.activeTabId) : pane.tabs.get(tabId);
}

async function loadPage(tab) {
  if (tab.url === 'about:blank') {
    tab.page = { html: '' };
    return;
  }
  try {
    const response = await fetch(tab.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    tab.page = { html: await response.text() };
  } catch (error) {
    tab.page = { error: error instanceof Error ? error.message : String(error) };
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
  await loadPage(tab);

  const result = {
    serverId: SERVER_ID,
    tabId: tab.id,
    reused: existing !== undefined,
    type: 'browser',
    navOk: tab.page.error === undefined,
  };
  return text(
    `${JSON.stringify(result, null, 2)}\nBrowser pane opened. Use serverId "${SERVER_ID}" with read_page / computer / navigate.`
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
    const step = direction === 'back' ? -1 : 1;
    const nextIndex = tab.historyIndex + step;
    if (nextIndex >= 0 && nextIndex < tab.history.length) {
      tab.historyIndex = nextIndex;
      tab.url = tab.history[nextIndex];
      await loadPage(tab);
    }
    return text(`navigated ${direction}`);
  }

  try {
    tab.url = normalizeUrl(url);
  } catch {
    return errorText(`navigation to ${url} was denied or failed`);
  }
  tab.history = [...tab.history.slice(0, tab.historyIndex + 1), tab.url];
  tab.historyIndex = tab.history.length - 1;
  await loadPage(tab);
  return text(`navigated to ${originOf(tab.url)}`);
}

function handleTabsContext() {
  if (pane === null) {
    return text(
      `${JSON.stringify({ browserOpen: false, tabs: [] }, null, 2)}\n${NO_PANE_TABS_TEXT}`
    );
  }
  const tabs = [...pane.tabs.values()].map((tab) => ({
    tabId: tab.id,
    origin: originOf(tab.url),
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

function handleTabsClose(args) {
  if (pane === null) {
    return errorText(PANE_NOT_OPEN_TEXT);
  }
  if (typeof args.tabId !== 'string') {
    return errorText('`tabs_close` requires a string `tabId`.');
  }
  if (!pane.tabs.delete(args.tabId)) {
    return errorText(`Tab ${args.tabId} not found.`);
  }
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

async function withLoadedTab(toolName, args, render) {
  if (pane === null) {
    return errorText(PANE_NOT_OPEN_TEXT);
  }
  const tab = resolveTab(args.tabId);
  if (tab === undefined) {
    return errorText(`Tab ${args.tabId} not found.`);
  }
  if (tab.page === null) {
    await loadPage(tab);
  }
  if (tab.page.error !== undefined) {
    return errorText(`${toolName} failed: ${tab.page.error}`);
  }
  return render(tab, tab.page.html);
}

function maxChars(value) {
  return Number.isFinite(value) ? Number(value) : DEFAULT_MAX_CHARS;
}

const HANDLERS = {
  preview_start: handlePreviewStart,
  navigate: handleNavigate,
  tabs_create: handleTabsCreate,
  tabs_context: handleTabsContext,
  tabs_select: handleTabsSelect,
  tabs_close: handleTabsClose,
  read_page: (args) =>
    withLoadedTab('read_page', args, (tab, html) => {
      const lines = accessibilityTree(html).filter(
        (line) => args.filter !== 'interactive' || line.includes('[ref_')
      );
      const limit = maxChars(args.max_chars);
      let tree = lines.join('\n');
      if (tree.length > limit) {
        tree = `${tree.slice(0, limit)}\n[output truncated at ${limit} chars]`;
      }
      return text(`${tree || '(empty page)'}\n\nViewport: ${VIEWPORT.width}x${VIEWPORT.height}`);
    }),
  get_page_text: (args) =>
    withLoadedTab('get_page_text', args, (tab, html) => {
      const limit = maxChars(args.max_chars);
      const content = visibleText(html);
      const truncated = content.length > limit;
      return text(
        `Title: ${pageTitle(html)}\nURL: ${tab.url}\nSource element: <body>\n---\n${content.slice(0, limit)}${
          truncated ? `\n\n[truncated to ${limit} chars]` : ''
        }`
      );
    }),
  find: (args) =>
    withLoadedTab('find', args, (tab, html) => {
      const query = typeof args.query === 'string' ? args.query : '';
      const matches = accessibilityTree(html)
        .filter(
          (line) => line.includes('[ref_') && line.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, MAX_FIND_MATCHES);
      return text(
        matches.length === 0
          ? `No matches for "${query}".`
          : `Found ${matches.length} match(es) for "${query}":\n${matches.map((line) => `- ${line}`).join('\n')}`
      );
    }),
};

const ROLE_BY_TAG = {
  a: 'link',
  button: 'button',
  input: 'textbox',
  textarea: 'textbox',
  select: 'combobox',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  p: 'paragraph',
  li: 'listitem',
  label: 'label',
  img: 'img',
};
const INTERACTIVE_ROLES = new Set(['link', 'button', 'textbox', 'combobox']);
const ELEMENT_PATTERN =
  /<(a|button|textarea|select|h[1-6]|p|li|label)\b([^>]*)>([\s\S]*?)<\/\1>|<(input|img)\b([^>]*)\/?>/gi;

function stripInvisible(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
}

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function textOf(fragment) {
  return decodeEntities(fragment.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function attribute(attributes, name) {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  );
  return match === null ? undefined : decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
}

function pageTitle(html) {
  const match = stripInvisible(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return match === null ? '' : textOf(match[1]);
}

function accessibilityTree(html) {
  const lines = [];
  const title = pageTitle(html);
  if (title.length > 0) {
    lines.push(`document "${title}"`);
  }

  let refSequence = 0;
  for (const match of stripInvisible(html).matchAll(ELEMENT_PATTERN)) {
    const tag = (match[1] ?? match[4]).toLowerCase();
    const attributes = match[2] ?? match[5] ?? '';
    const role = ROLE_BY_TAG[tag];
    const name =
      attribute(attributes, 'aria-label') ??
      (tag === 'img' ? attribute(attributes, 'alt') : undefined) ??
      (tag === 'input'
        ? (attribute(attributes, 'placeholder') ?? attribute(attributes, 'name'))
        : textOf(match[3] ?? ''));
    if (name === undefined || name.length === 0) {
      continue;
    }
    if (INTERACTIVE_ROLES.has(role)) {
      refSequence += 1;
      lines.push(`${role} "${name}" [ref_${refSequence}]`);
    } else {
      lines.push(`${role} "${name}"`);
    }
  }
  return lines;
}

function visibleText(html) {
  const body = stripInvisible(html).match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
  return decodeEntities(
    body
      .replace(/<(br|hr)\b[^>]*\/?>/gi, '\n')
      .replace(
        /<\/(p|div|h[1-6]|li|tr|section|article|header|footer|nav|main|blockquote|pre)>/gi,
        '\n'
      )
      .replace(/<[^>]+>/g, '')
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

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

  // Notifications (no id) need no response; unknown requests get method-not-found.
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
      // Ignore malformed lines; MCP clients resend on protocol errors.
      return undefined;
    }
  });
  requestQueue = requestQueue.catch(() => {});
});
rl.on('close', () => {
  process.exit(0);
});
