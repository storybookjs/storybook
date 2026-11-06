#!/usr/bin/env node
// Stand-in for Claude Code's Browser pane in the Claude desktop app (Claude.app
// 2.16120.0), with tool names, descriptions, schemas and result texts copied from
// the app, minus the `.claude/launch.json` dev-server flow, so `preview_start` uses
// the app's no-dev-server variant. Claude Code reserves the server name
// `Claude Browser`, so this registers as `Browser` (tools `mcp__Browser__*`) and
// renders pages in headless Chromium from the workspace `playwright` install.
import { isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';

const SERVER_INFO = { name: 'Browser', version: '2.16120.0' };
const SERVER_ID = 'browser-pane';
const TOOL_PREFIX = 'mcp__Browser__';
const VIEWPORT = { width: 1280, height: 720 };
const VIEWPORT_PRESETS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
};
const MAX_VIEWPORT_DIMENSION = 9999;
const MOBILE_MAX_WIDTH = 768;
const MOBILE_TOUCH_POINTS = 5;
const SCREENSHOT_MAX_WIDTH = 800;
const SCREENSHOT_JPEG_QUALITY = 75;
const MIN_SCREENSHOT_SCALE = 0.1;
const COORDINATE_TOLERANCE = 2;
const SCROLL_TICK_PIXELS = 100;
const DEFAULT_SCROLL_TICKS = 3;
const MAX_WAIT_SECONDS = 10;
const MAX_KEY_TOKENS = 100;
const MAX_KEY_REPEAT = 100;
const DEFAULT_TREE_DEPTH = 15;
const DEFAULT_MAX_CHARS = 50_000;
const FIND_MAX_CHARS = 5_000_000;
const MAX_FIND_MATCHES = 20;
const DEFAULT_ENTRY_LIMIT = 50;
const MAX_CONSOLE_LIMIT = 200;
const MAX_CAPTURED_ENTRIES = 500;
const MAX_LOG_TEXT_CHARS = 8000;
const MAX_RESPONSE_BODY_CHARS = 10_000;
const MAX_BATCH_ACTIONS = 25;
const BATCH_BUDGET_MS = 180_000;
const TOOL_TIMEOUT_MS = 30_000;
const JAVASCRIPT_TIMEOUT_MS = 45_000;
const EVALUATE_TIMEOUT_MS = 30_000;
const NAVIGATION_TIMEOUT_MS = 30_000;

const NO_PANE_TABS_TEXT =
  'The Browser pane isn\'t open yet, so there are no tabs. Call preview_start or navigate with {"url": "https://…"} to open it.';
const PANE_NOT_OPEN_TEXT =
  'No preview is open. Use `preview_start` or `navigate` with {"url": "https://…"} to open a browser tab at a URL.';
const NO_PAGE_FOR_COMPUTER_TEXT =
  'There is no page to screenshot, zoom into or click — this tool only acts on a page in the Browser pane (not on files, the desktop or other apps). ';
const OPEN_PANE_OUTSIDE_BATCH_TEXT =
  "The Browser pane isn't open. Open it with `navigate` and this url — on its own, or as the FIRST `browser_batch` action — then batch the rest.";
const DEV_SERVERS_UNAVAILABLE_TEXT =
  "Dev servers aren't available in this session. To browse, call preview_start with a `url`, or use `navigate`.";
const LOCAL_FILES_UNAVAILABLE_TEXT = 'opening local files is not available in this session.';
const NO_PAGE_TEXTS = {
  blank:
    'This tab is blank — no page is loaded in it. Load one with `navigate` (pass this tabId), or address the tab that already has your page (`tabs_context` lists them).',
  'load-failed':
    'The last page load in this tab failed, so there is no page to act on. Use `navigate` (pass this tabId) to retry or go elsewhere.',
  file: "This tab shows a local file, not a web page; page tools can't act on it here. Open web pages in a new tab (`tabs_create`, then `navigate`).",
  other:
    "This tab shows generated content, not a web page; page tools can't act on it. Use `navigate` in this or a new tab to open a page.",
};
const SCRIPT_CUT_OFF_BY_NAVIGATION_TEXT =
  'The page navigated while this script was running, so the script was cut off and any return value was lost. If the script itself navigated (clicked a link, submitted a form, changed location), do not re-run it — continue from the page the tab is on now. If it did not, something else navigated the page (a reload, a redirect, or the user); check the page and redo whatever is still missing.';
const DIALOG_OUTCOMES = {
  confirm: 'confirm() returned false to the page',
  prompt: 'prompt() returned null to the page',
};

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
      properties: { url: { type: 'string', description: 'URL to open in the Browser pane.' } },
      required: ['url'],
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
    name: 'computer',
    description:
      'Mouse/keyboard automation in the Browser pane. Clicks accept either `coordinate` (pixels in the coordinate frame of the most recent `computer{action:"screenshot"}` — reported with every scaled screenshot; equal to the image\'s pixels for unscaled ones) or `ref` (a `ref_N` from read_page/find). Whenever you intend to click on an element like an icon, you should consult a screenshot to determine the coordinates of the element first; after the tab loads a different site, take a new screenshot before clicking by `coordinate`.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TAB_ID_PROPERTY,
        action: {
          type: 'string',
          enum: [
            'left_click',
            'right_click',
            'type',
            'screenshot',
            'wait',
            'scroll',
            'key',
            'left_click_drag',
            'double_click',
            'triple_click',
            'zoom',
            'scroll_to',
            'hover',
          ],
          description:
            'The action to perform:\n* `left_click`: Click the left mouse button at the specified coordinates.\n* `right_click`: Click the right mouse button at the specified coordinates to open context menus.\n* `double_click`: Double-click the left mouse button at the specified coordinates.\n* `triple_click`: Triple-click the left mouse button at the specified coordinates.\n* `type`: Type a string of text.\n* `screenshot`: Take a screenshot of the screen.\n* `wait`: Wait for a specified number of seconds.\n* `scroll`: Scroll up, down, left, or right at the specified coordinates.\n* `key`: Press a specific keyboard key.\n* `left_click_drag`: Drag from start_coordinate to coordinate.\n* `zoom`: Take a screenshot of a specific region for closer inspection.\n* `scroll_to`: Scroll an element into view using its element reference ID from read_page or find tools.\n* `hover`: Move the mouse cursor to the specified coordinates or element without clicking. Useful for revealing tooltips, dropdown menus, or triggering hover states.',
        },
        coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description:
            '(x, y): The x (pixels from the left edge) and y (pixels from the top edge) coordinates. Required for `left_click`, `right_click`, `double_click`, `triple_click`, and `scroll`. For `left_click_drag`, this is the end position.',
        },
        text: {
          type: 'string',
          description:
            'The text to type (for `type` action) or the key(s) to press (for `key` action). For `key` action: Provide space-separated keys (e.g., "Backspace Backspace Delete"). Supports keyboard shortcuts using the platform\'s modifier key (use "cmd" on Mac, "ctrl" on Windows/Linux, e.g., "cmd+a" or "ctrl+a" for select all). Page zoom shortcuts (e.g. "cmd+=", "ctrl+-", "cmd+0") are not supported - use the `zoom` action to magnify a region of the page instead.',
        },
        duration: {
          type: 'number',
          minimum: 0,
          maximum: 10,
          description: 'The number of seconds to wait. Required for `wait`. Maximum 10 seconds.',
        },
        scroll_direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          description: 'The direction to scroll. Required for `scroll`.',
        },
        scroll_amount: {
          type: 'number',
          minimum: 1,
          maximum: 10,
          description: 'The number of scroll wheel ticks. Optional for `scroll`, defaults to 3.',
        },
        start_coordinate: {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 2,
          description: '(x, y): The starting coordinates for `left_click_drag`.',
        },
        region: {
          type: 'array',
          items: { type: 'number' },
          minItems: 4,
          maxItems: 4,
          description:
            '(x0, y0, x1, y1): The rectangular region to capture for `zoom`. Coordinates define a rectangle from top-left (x0, y0) to bottom-right (x1, y1) in pixels from the viewport origin. Required for `zoom` action. Useful for inspecting small UI elements like icons, buttons, or text.',
        },
        scale: {
          type: 'number',
          minimum: 0.1,
          maximum: 1,
          description:
            "For `screenshot` and `zoom` only. Scale factor in [0.1, 1] for the returned image; 1 (default) uses the full image token budget, 0.5 returns an image at half the width and height (~quarter of the tokens). Coordinates are ALWAYS in the full-resolution coordinate frame (reported with every scaled screenshot), never in the scaled image's own pixels.",
        },
        repeat: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          description:
            'Number of times to repeat the key sequence. Only applicable for `key` action. Must be a positive integer between 1 and 100. Default is 1. Useful for navigation tasks like pressing arrow keys multiple times.',
        },
        ref: {
          type: 'string',
          description:
            'Element reference ID from read_page or find tools (e.g., "ref_1", "ref_2"). Required for `scroll_to` action. Can be used as alternative to `coordinate` for click actions.',
        },
        modifiers: {
          type: 'string',
          description:
            'Modifier keys for click actions. Supports: "ctrl", "shift", "alt", "cmd" (or "meta"), "win" (or "windows"). Can be combined with "+" (e.g., "ctrl+shift", "cmd+alt"). Optional.',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'form_input',
    description:
      'Set the value of a form element identified by `ref` (from read_page/find). Handles input/textarea/select/checkbox/contenteditable.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TAB_ID_PROPERTY,
        ref: {
          type: 'string',
          description: 'Element reference ID from the read_page tool (e.g., "ref_1", "ref_2")',
        },
        value: {
          type: ['string', 'boolean', 'number'],
          description:
            'The value to set. For checkboxes use boolean, for selects use option value or text, for other inputs use appropriate string/number',
        },
      },
      required: ['ref', 'value'],
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
    name: 'javascript_tool',
    description:
      "Execute JavaScript in the Browser pane's page for DEBUGGING and INSPECTION only. Do NOT use this to implement UI changes — edit source code instead.",
    inputSchema: {
      type: 'object',
      properties: {
        ...TAB_ID_PROPERTY,
        action: {
          type: 'string',
          enum: ['javascript_exec'],
          description: 'Action to perform (only `javascript_exec` is supported).',
        },
        text: {
          type: 'string',
          description:
            'The JavaScript code to execute. Evaluated in the page context with REPL semantics: top-level `await` works, and the result of the last expression is returned automatically — write the expression you want (e.g. `window.myData.value`, or `await fetch(url).then(r=>r.json())`) rather than `return ...`. Return values are serialized as JSON.',
        },
      },
      required: ['action', 'text'],
    },
  },
  {
    name: 'read_console_messages',
    description: 'Get console output (log, info, warn, error, debug) from the Browser pane.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TAB_ID_PROPERTY,
        onlyErrors: { type: 'boolean', description: 'Return only error-level entries.' },
        pattern: { type: 'string', description: 'Substring filter on message text.' },
        limit: { type: 'number', description: 'Max entries to return (default: 50, max: 200).' },
      },
    },
  },
  {
    name: 'read_network_requests',
    description: 'List network requests, or fetch a specific response body by `requestId`.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TAB_ID_PROPERTY,
        urlPattern: {
          type: 'string',
          description:
            'Substring filter on the request URL as listed (auth values show as REDACTED).',
        },
        requestId: {
          type: 'string',
          description:
            'If provided, returns the response body for this request instead of listing.',
        },
        limit: { type: 'number', description: 'Max entries to return when listing (default: 50).' },
      },
    },
  },
  {
    name: 'resize_window',
    description:
      'Emulate a viewport size in the Browser pane tab. Presets: mobile (375x812), tablet (768x1024), or desktop, which clears the size emulation and returns the tab to the pane\'s own responsive size. Custom sizes need both width and height. An emulated size applies to that tab across reloads and navigation (scaled down to fit when it is larger than the pane): reset it with preset "desktop" as soon as you finish testing. The desktop app may also clear a size you set when your turn ends, so set it again in a later turn if you still need it. A size the user picked from the pane\'s own Viewport menu is theirs and stays until they or you change it; leave it unless they ask. colorScheme (light/dark) emulates prefers-color-scheme on that tab; it survives reloads and preset "desktop" does not touch it, but the pane re-syncs the tab to the app\'s light/dark theme when that theme changes or the pane reopens; local documents and static HTML previews always render light. The mobile preset (and any width < 768) also emulates a mobile device: Android Chrome user agent and 5 touch points, so pages detect a touch phone; your clicks still arrive as mouse clicks. Reload the page after switching so load-time device gates re-run.',
    inputSchema: {
      type: 'object',
      properties: {
        ...TAB_ID_PROPERTY,
        preset: { type: 'string', enum: ['mobile', 'tablet', 'desktop'] },
        width: { type: 'number' },
        height: { type: 'number' },
        colorScheme: { type: 'string', enum: ['light', 'dark'] },
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
    name: 'browser_batch',
    description:
      "Execute a sequence of Browser pane tool calls in ONE round trip. Each item is {name, input} where input is exactly what you'd pass to that tool standalone. Actions execute SEQUENTIALLY (not in parallel) and stop on the first error. Use this tool extensively to quickly execute work whenever you can predict two or more steps ahead — e.g. navigate, click a field, type, press Return, screenshot. Each tool's own permission check runs per item — a step on a site the user hasn't allowed either asks the user inline (and continues if they allow) or is refused, which stops the batch; if a step is refused for a missing permission, call that tool on its own (that call can ask the user), then batch the rest. Screenshots and other images are returned interleaved with outputs; coordinates you write in THIS batch refer to the screenshot taken BEFORE this call. browser_batch cannot be nested, and preview_start is not batchable — but if the Browser pane isn't open yet, a batch whose FIRST action is navigate with a url opens it (other actions still need an open page).",
    inputSchema: {
      type: 'object',
      properties: {
        actions: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description:
                  "Tool name (e.g. computer, navigate, find, form_input, read_page). browser_batch cannot be nested. A tabs_create's new tabId is only returned when the batch ends — load that tab in a later call.",
              },
              input: {
                type: 'object',
                description: "That tool's input — same shape you'd pass when calling it directly.",
              },
            },
            required: ['name', 'input'],
          },
          description:
            'List of tool calls to execute sequentially. Example: [{"name":"computer","input":{"action":"left_click","ref":"ref_12"}},{"name":"computer","input":{"action":"type","text":"hello"}},{"name":"computer","input":{"action":"screenshot"}}]',
        },
      },
      required: ['actions'],
    },
  },
];

const TOOL_NAMES = new Set(TOOLS.map((tool) => tool.name));
const BATCHABLE_TOOLS = new Set(
  [...TOOL_NAMES].filter((name) => name !== 'preview_start' && name !== 'browser_batch')
);
const TIMED_TOOLS = new Set([
  'read_page',
  'computer',
  'form_input',
  'find',
  'get_page_text',
  'javascript_tool',
  'read_network_requests',
  'resize_window',
]);

// The open pane: `{ tabs: Map<tabId, tab>, activeTabId }`, or null while closed.
let pane = null;
let tabSequence = 0;
let evaluateSequence = 0;
let browserPromise;

function text(value) {
  return { content: [{ type: 'text', text: value }] };
}

function errorText(value, errorClass) {
  return {
    content: [{ type: 'text', text: value }],
    isError: true,
    ...(errorClass !== undefined && { _meta: { errorClass } }),
  };
}

function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

function originOf(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : null;
  } catch {
    return null;
  }
}

function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function isLoopbackHost(host) {
  return (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]'
  );
}

function invalidUrlText(value) {
  return `${value} is not a valid file path or URL — use an absolute path, a path starting with ~/ or ./, or a file:// URL for a local file, or a full URL like https://example.com for a website`;
}

function isLocalFileTarget(value) {
  if (value.startsWith('//')) return false;
  return (
    /^file:/i.test(value) ||
    value.startsWith('\\\\') ||
    isAbsolute(value) ||
    value === '~' ||
    /^~[/\\]/.test(value) ||
    /^\.\.?[/\\]/.test(value)
  );
}

const SCHEME_LIKE_HOSTS = new Set(['file', 'http', 'https']);
const FILE_EXTENSION_LABELS = new Set(
  'pdf.png.jpg.jpeg.gif.webp.avif.mp4.webm.m4v.mov.ogv.html.htm.svg.txt.md.markdown.json.jsonl.log.csv.tsv.yaml.yml.toml.xml.ini.conf'.split(
    '.'
  )
);

// Mirrors the app's URL check: a bare host gets https://, and hosts that look like
// typos or file names are rejected instead of being searched for.
function parseWebUrl(value) {
  const bare = !/^https?:\/\//i.test(value);
  const candidate = bare ? `https://${value}` : value;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/\.+$/, '').toLowerCase();
  if (SCHEME_LIKE_HOSTS.has(host)) return null;
  if (!host.startsWith('[') && host.split('.').some((label) => label === '')) return null;
  if (bare) {
    const hasPort = url.port !== '' || /^[^/?#@\\]*:\d+(?=[/?#\\]|$)/.test(value);
    const dotless = !host.includes('.') && !host.startsWith('[');
    if (dotless && !isLoopbackHost(host) && !hasPort) return null;
    if (!(hasPort && !host.includes('.')) && FILE_EXTENSION_LABELS.has(host.split('.').at(-1))) {
      return null;
    }
  }
  return candidate;
}

function webTarget(rawUrl) {
  if (isLocalFileTarget(rawUrl)) {
    return { refusal: errorText(LOCAL_FILES_UNAVAILABLE_TEXT, 'file_open_unavailable') };
  }
  const url = parseWebUrl(rawUrl);
  return url === null ? { refusal: errorText(invalidUrlText(rawUrl), 'not_a_url') } : { url };
}

function cleanTitle(title) {
  return title
    ? title
        .replace(/[\r\n\t"\\]/g, ' ')
        .trim()
        .slice(0, 200)
    : '';
}

function getBrowser() {
  browserPromise ??= import('playwright')
    .then(({ chromium }) => chromium.launch({ headless: true }))
    .catch((error) => {
      browserPromise = undefined;
      throw new Error(`Failed to launch the browser: ${messageOf(error)}`);
    });
  return browserPromise;
}

function createCapture() {
  return { entries: [], seq: 0, readSeq: 0, droppedUnread: 0 };
}

function captureEntry(capture, entry) {
  capture.entries.push({ ...entry, seq: ++capture.seq });
  while (capture.entries.length > MAX_CAPTURED_ENTRIES) {
    if (capture.entries.shift().seq > capture.readSeq) capture.droppedUnread += 1;
  }
}

function markRead(capture) {
  const dropped = capture.droppedUnread;
  capture.droppedUnread = 0;
  capture.readSeq = capture.seq;
  return dropped;
}

function consoleLevel(type) {
  if (type === 'warning') return 'warn';
  if (type === 'assert' || type === 'error') return 'error';
  return type === 'info' || type === 'debug' ? type : 'log';
}

function describeRemoteObject(object) {
  if (object.value !== undefined || object.type === 'undefined') return String(object.value);
  if (object.subtype === 'error' && object.description !== undefined) return object.description;
  const properties = object.preview?.properties ?? [];
  if (properties.length > 0) {
    const shown = properties.map((property) => `${property.name}: ${property.value ?? '…'}`);
    return `{${shown.join(', ')}${object.preview.overflow ? ', …' : ''}}`;
  }
  return object.description ?? '';
}

function logToConsole(tab, level, message) {
  const clipped =
    message.length > MAX_LOG_TEXT_CHARS ? `${message.slice(0, MAX_LOG_TEXT_CHARS)}...` : message;
  captureEntry(tab.console, { level, text: clipped, origin: originOf(tab.page?.url() ?? '') });
}

function findRequest(tab, requestId) {
  return tab.network.entries.find((entry) => entry.requestId === requestId);
}

async function attachCapture(tab, page) {
  const cdp = await page.context().newCDPSession(page);
  cdp.on('Runtime.consoleAPICalled', ({ type, args }) => {
    logToConsole(tab, consoleLevel(type), args.map(describeRemoteObject).join(' '));
  });
  cdp.on('Runtime.exceptionThrown', ({ exceptionDetails }) => {
    const exception = exceptionDetails.exception
      ? describeRemoteObject(exceptionDetails.exception)
      : '';
    const message = [exceptionDetails.text, exception].filter(Boolean).join(' ');
    logToConsole(tab, 'error', message || 'Uncaught exception');
  });
  cdp.on('Log.entryAdded', ({ entry }) => logToConsole(tab, consoleLevel(entry.level), entry.text));
  cdp.on('Network.requestWillBeSent', ({ requestId, request }) => {
    const existing = findRequest(tab, requestId);
    if (existing !== undefined) {
      Object.assign(existing, { url: request.url, method: request.method });
      return;
    }
    captureEntry(tab.network, { requestId, url: request.url, method: request.method });
  });
  cdp.on('Network.responseReceived', ({ requestId, response }) => {
    const entry = findRequest(tab, requestId);
    if (entry !== undefined) {
      entry.status = response.status;
      entry.statusText = response.statusText ?? '';
    }
  });
  cdp.on('Network.loadingFailed', ({ requestId, errorText: reason }) => {
    const entry = findRequest(tab, requestId);
    if (entry !== undefined) {
      entry.failed = true;
      entry.errorText = reason ?? '';
    }
  });
  await Promise.all(
    ['Runtime.enable', 'Log.enable', 'Network.enable'].map((method) => cdp.send(method))
  );
  return cdp;
}

// The app disables native JavaScript dialogs and reports each one as a console warning.
function suppressDialogs(tab, page) {
  page.on('dialog', (dialog) => {
    const type = dialog.type();
    if (type === 'beforeunload') {
      dialog.accept().catch(() => {});
      return;
    }
    const outcome = DIALOG_OUTCOMES[type] ?? 'the call returned immediately';
    logToConsole(
      tab,
      'warn',
      `[Claude browser] Page dialog suppressed (${type}): ${JSON.stringify(dialog.message().slice(0, 200))} — native JavaScript dialogs are disabled in this browser; ${outcome}.`
    );
    dialog.dismiss().catch(() => {});
  });
}

async function pageOf(tab) {
  if (tab.page === null) {
    const page = await (await getBrowser()).newPage({ viewport: VIEWPORT });
    tab.page = page;
    tab.cdp = await attachCapture(tab, page);
    suppressDialogs(tab, page);
  }
  return tab.page;
}

function createTab() {
  tabSequence += 1;
  const tab = {
    id: `tab_${tabSequence}`,
    page: null,
    cdp: null,
    console: createCapture(),
    network: createCapture(),
    screenshotFrame: null,
    emulatedViewport: null,
  };
  pane.tabs.set(tab.id, tab);
  return tab;
}

function tabUrl(tab) {
  return tab.page?.url() ?? 'about:blank';
}

function resolveTab(tabId) {
  return pane.tabs.get(typeof tabId === 'string' && tabId.length > 0 ? tabId : pane.activeTabId);
}

function paneStatus(tabId) {
  return tabId !== null && tabId !== pane?.activeTabId
    ? 'The Browser pane is currently displayed, but this tab is not fronted.'
    : 'The Browser pane is currently displayed.';
}

function noPageReason(tab) {
  const url = tab.page?.url() ?? '';
  if (originOf(url) !== null) return null;
  if (url.startsWith('chrome-error:')) return 'load-failed';
  if (url === '' || url === 'about:blank' || url === 'about:srcdoc') return 'blank';
  return url.startsWith('file:') ? 'file' : 'other';
}

async function loadUrl(tab, url) {
  const page = await pageOf(tab);
  try {
    await page.goto(url, { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS });
    return true;
  } catch {
    // `goto` rejects before Chromium commits its error page; wait for that page so
    // the next call sees the failed load instead of a dying document.
    await page.waitForURL(/^chrome-error:/, { timeout: 2000 }).catch(() => {});
    await page.waitForLoadState('load').catch(() => {});
    return false;
  }
}

async function openBrowserTab(rawUrl) {
  const { url, refusal } = webTarget(rawUrl);
  if (refusal) return refusal;
  await getBrowser();

  pane ??= { tabs: new Map(), activeTabId: null };
  const href = new URL(url).href;
  const existing = [...pane.tabs.values()].find((tab) => tabUrl(tab) === href);
  const tab = existing ?? createTab();
  pane.activeTabId = tab.id;
  const navOk = await loadUrl(tab, url);

  const result = {
    serverId: SERVER_ID,
    tabId: tab.id,
    reused: existing !== undefined,
    type: 'browser',
    navOk,
  };
  const note = navOk
    ? `Browser pane opened. Use serverId "${SERVER_ID}" with read_page / computer / navigate.`
    : `Browser pane opened at about:blank; navigation to ${originOf(url) ?? '(target)'} was denied or failed. Use \`navigate\` to try a different URL.`;
  return text(`${JSON.stringify(result, null, 2)}\n${note}`);
}

function handlePreviewStart(args) {
  const url = typeof args.url === 'string' ? args.url.trim() : '';
  return url.length === 0 ? errorText(DEV_SERVERS_UNAVAILABLE_TEXT) : openBrowserTab(url);
}

function paneOpeningUrl(name, args) {
  if (name !== 'navigate' || typeof args.url !== 'string') return null;
  const url = args.url.trim();
  return url.length > 0 && !/^(back|forward)$/i.test(url) ? url : null;
}

function closedPaneResult(name, args, canOpenPane) {
  const url = paneOpeningUrl(name, args);
  if (url !== null) {
    return canOpenPane
      ? openBrowserTab(url)
      : errorText(OPEN_PANE_OUTSIDE_BATCH_TEXT, 'pane_not_open');
  }
  if (name === 'tabs_context') {
    return text(
      `${JSON.stringify({ browserOpen: false, tabs: [] }, null, 2)}\n${NO_PANE_TABS_TEXT}`
    );
  }
  if (name === 'tabs_create') {
    return text(`No tab was created. ${NO_PANE_TABS_TEXT}`);
  }
  const prefix = name === 'computer' ? NO_PAGE_FOR_COMPUTER_TEXT : '';
  return errorText(`${prefix}${PANE_NOT_OPEN_TEXT}`, 'pane_not_open');
}

function handleTabsContext() {
  const tabs = [...pane.tabs.values()].map((tab) => ({
    tabId: tab.id,
    origin: new URL(tabUrl(tab)).origin,
    isActive: tab.id === pane.activeTabId,
  }));
  return text(`${JSON.stringify({ browserOpen: true, tabs }, null, 2)}\n${paneStatus(null)}`);
}

function handleTabsCreate(args) {
  const background = args.foreground !== true;
  const tab = createTab();
  if (!background) {
    pane.activeTabId = tab.id;
  }
  const result = { serverId: SERVER_ID, tabId: tab.id, reused: false, type: 'browser' };
  const note = background
    ? `Opened tab ${tab.id} in the background — the user's current tab stays in front. Use \`navigate\` with tabId "${tab.id}" to load a URL; front it with \`tabs_select\` when the user should look.`
    : `Opened tab ${tab.id} in the foreground. Use \`navigate\` with tabId "${tab.id}" to load a URL.`;
  return text(`${JSON.stringify(result, null, 2)}\n${note}`);
}

function handleTabsSelect(args) {
  if (typeof args.tabId !== 'string') {
    return errorText('`tabs_select` requires a string `tabId`.', 'input_invalid');
  }
  if (!pane.tabs.has(args.tabId)) {
    return errorText(`Tab ${args.tabId} not found.`, 'tab_gone');
  }
  pane.activeTabId = args.tabId;
  return text(`Fronted tab ${args.tabId}.`);
}

async function handleTabsClose(args) {
  if (typeof args.tabId !== 'string') {
    return errorText('`tabs_close` requires a string `tabId`.', 'input_invalid');
  }
  const tab = pane.tabs.get(args.tabId);
  if (tab === undefined) {
    return errorText(`Tab ${args.tabId} not found.`, 'tab_gone');
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

async function handleNavigate(tab, args) {
  if (typeof args.url !== 'string') {
    return errorText('`navigate` requires a string `url`', 'input_invalid');
  }
  const url = args.url.trim();
  const direction = url.toLowerCase();
  const page = await pageOf(tab);

  if (direction === 'back' || direction === 'forward') {
    const { currentIndex, entries } = await tab.cdp.send('Page.getNavigationHistory');
    // A new tab starts on about:blank, which the pane does not count as history.
    const firstIndex = entries[0]?.url === 'about:blank' ? 1 : 0;
    const available =
      direction === 'back' ? currentIndex > firstIndex : currentIndex < entries.length - 1;
    if (!available) {
      return errorText(`no ${direction} history`, 'input_invalid');
    }
    const options = { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS };
    await (direction === 'back' ? page.goBack(options) : page.goForward(options));
    return text(`navigated ${direction}`);
  }

  const { url: target, refusal } = webTarget(url);
  if (refusal) return refusal;
  if (!(await loadUrl(tab, target))) {
    return errorText(
      `navigation to ${originOf(target) ?? '(target)'} was denied or failed`,
      'navigation_denied_or_failed'
    );
  }
  return text(`navigated to ${target}`);
}

// Runs in the page. Builds the app's YAML-style tree: one `role "name" [ref_N]` line
// per element, with refs kept stable per element so later calls can target them.
function buildAccessibilityTree({ filter, maxDepth, maxChars, refId }) {
  const refs = (window.__browserMockRefs ??= { byRef: {}, byElement: new WeakMap(), count: 0 });
  const TAG_ROLES = {
    a: 'link',
    button: 'button',
    select: 'combobox',
    textarea: 'textbox',
    img: 'image',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
    section: 'region',
    article: 'article',
    aside: 'complementary',
    form: 'form',
    table: 'table',
    ul: 'list',
    ol: 'list',
    li: 'listitem',
    label: 'label',
  };
  const INPUT_ROLES = {
    submit: 'button',
    button: 'button',
    checkbox: 'checkbox',
    radio: 'radio',
    file: 'button',
  };
  const INTERACTIVE_TAGS = ['a', 'button', 'input', 'select', 'textarea', 'details', 'summary'];
  const SEMANTIC_TAGS = /^(h[1-6]|nav|main|header|footer|section|article|aside)$/;
  const SKIPPED_TAGS = ['script', 'style', 'meta', 'link', 'title', 'noscript'];
  const SENSITIVE_AUTOCOMPLETE =
    /current-password|new-password|one-time-code|cc-number|cc-csc|cc-exp/;
  const MAX_NODES = 10000;
  const lines = [];
  let included = 0;

  const tagOf = (element) => element.tagName.toLowerCase();
  const attribute = (element, name) => (element.getAttribute(name) ?? '').trim();
  const directText = (element) =>
    [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('')
      .trim();
  const roleOf = (element) =>
    element.getAttribute('role') ||
    (tagOf(element) === 'input'
      ? (INPUT_ROLES[element.getAttribute('type')] ?? 'textbox')
      : /^h[1-6]$/.test(tagOf(element))
        ? 'heading'
        : (TAG_ROLES[tagOf(element)] ?? 'generic'));
  const isSensitive = (element) =>
    ['password', 'hidden'].includes(attribute(element, 'type').toLowerCase()) ||
    SENSITIVE_AUTOCOMPLETE.test(attribute(element, 'autocomplete').toLowerCase());
  const isInteractive = (element) =>
    INTERACTIVE_TAGS.includes(tagOf(element)) ||
    element.getAttribute('onclick') !== null ||
    element.getAttribute('tabindex') !== null ||
    ['button', 'link'].includes(element.getAttribute('role')) ||
    element.getAttribute('contenteditable') === 'true';

  function nameOf(element) {
    const tag = tagOf(element);
    if (tag === 'select') {
      if (isSensitive(element)) {
        return (
          attribute(element, 'aria-label') || attribute(element, 'title') || '[value redacted]'
        );
      }
      const selected =
        element.querySelector('option[selected]') ?? element.options[element.selectedIndex];
      if (selected?.textContent) return selected.textContent.trim();
    }
    for (const name of ['aria-label', 'placeholder', 'title', 'alt']) {
      if (attribute(element, name)) return attribute(element, name);
    }
    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label && directText(label)) return directText(label);
    }
    if (tag === 'input') {
      if (element.getAttribute('type') === 'submit' && attribute(element, 'value')) {
        return attribute(element, 'value');
      }
      if (isSensitive(element)) return element.value ? '[value redacted]' : '';
      if (element.value && element.value.length < 50 && element.value.trim()) {
        return element.value.trim();
      }
    }
    if (tag === 'textarea' && isSensitive(element)) return element.value ? '[value redacted]' : '';
    if (['button', 'a', 'summary'].includes(tag) && directText(element)) return directText(element);
    if (/^h[1-6]$/.test(tag) && element.textContent.trim()) {
      return element.textContent.trim().substring(0, 100);
    }
    if (tag === 'img') return '';
    const own = directText(element);
    if (own.length < 3) return '';
    return own.length > 100 ? `${own.substring(0, 100)}...` : own;
  }

  function isShown(element) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    if (element.offsetWidth <= 0 || element.offsetHeight <= 0) return false;
    if (refId) return true;
    const rect = element.getBoundingClientRect();
    return rect.top < innerHeight && rect.bottom > 0 && rect.left < innerWidth && rect.right > 0;
  }

  function shouldInclude(element) {
    if (SKIPPED_TAGS.includes(tagOf(element))) return false;
    if (filter !== 'all' && (element.getAttribute('aria-hidden') === 'true' || !isShown(element))) {
      return false;
    }
    if (filter === 'interactive') return isInteractive(element);
    return (
      isInteractive(element) ||
      SEMANTIC_TAGS.test(tagOf(element)) ||
      element.getAttribute('role') !== null ||
      nameOf(element).length > 0 ||
      !['generic', 'image'].includes(roleOf(element))
    );
  }

  function refFor(element) {
    const known = refs.byElement.get(element);
    if (known && refs.byRef[known]?.deref() === element) return known;
    const ref = `ref_${++refs.count}`;
    refs.byRef[ref] = new WeakRef(element);
    refs.byElement.set(element, ref);
    return ref;
  }

  const quote = (value) => `"${value.replace(/\s+/g, ' ').substring(0, 100).replace(/"/g, '\\"')}"`;

  function visit(element, depth) {
    if (included >= MAX_NODES || depth > maxDepth || !element?.tagName) return;
    const tag = tagOf(element);
    const include = shouldInclude(element) || (refId !== null && depth === 0);
    if (include) {
      included += 1;
      const name = nameOf(element);
      let line = `${' '.repeat(depth)}${roleOf(element)}${name ? ` ${quote(name)}` : ''} [${refFor(element)}]`;
      for (const name of ['href', 'type', 'placeholder']) {
        if (element.getAttribute(name)) line += ` ${name}="${element.getAttribute(name)}"`;
      }
      lines.push(line);
      if (tag === 'select' && !isSensitive(element)) {
        for (const option of element.options) {
          const optionText = (option.textContent ?? '')
            .trim()
            .replace(/\s+/g, ' ')
            .substring(0, 100);
          let optionLine = `${' '.repeat(depth + 1)}option${optionText ? ` ${quote(optionText)}` : ''}`;
          if (option.selected) optionLine += ' (selected)';
          if (option.value && option.value !== optionText) {
            optionLine += ` value="${option.value.replace(/"/g, '\\"')}"`;
          }
          lines.push(optionLine);
        }
      }
    }
    if (tag === 'select' && isSensitive(element)) return;
    if (depth < maxDepth) {
      for (const child of element.children) visit(child, include ? depth + 1 : depth);
    }
  }

  const viewport = { width: innerWidth, height: innerHeight };
  if (refId) {
    const target = refs.byRef[refId]?.deref();
    if (target === undefined) {
      const problem = refs.byRef[refId] ? 'no longer exists' : 'not found';
      return {
        error: `Element with ref_id '${refId}' ${problem}. It may have been removed from the page. Use read_page without ref_id to get the current page state.`,
      };
    }
    visit(target, 0);
  } else if (document.body) {
    visit(document.body, 0);
  }
  for (const [ref, weakRef] of Object.entries(refs.byRef)) {
    if (!weakRef.deref()) delete refs.byRef[ref];
  }

  let pageContent = lines.join('\n');
  const focusHint = refId
    ? 'use a smaller depth or focus on a more specific child element'
    : 'use ref_id or a smaller depth to focus';
  if (included >= MAX_NODES) {
    const hint = refId ? focusHint : 'use a refId or smaller depth to focus';
    pageContent += `\n[truncated at ${MAX_NODES} elements — page is very large; ${hint}]`;
  }
  if (maxChars != null && pageContent.length > maxChars) {
    const fullLength = pageContent.length;
    let cutAt = pageContent.lastIndexOf('\n', maxChars);
    if (cutAt <= 0) cutAt = Math.max(0, maxChars);
    pageContent = `${pageContent.slice(0, cutAt)}\n[output truncated at ${maxChars} of ${fullLength} characters. Pass a larger max_chars (default 50000) to see more, or ${focusHint}.]`;
  }
  return { pageContent, viewport };
}

async function accessibilityTree(tab, toolName, options) {
  let tree;
  try {
    tree = await tab.page.evaluate(buildAccessibilityTree, options);
  } catch (error) {
    return { failed: errorText(`${toolName} failed: ${messageOf(error)}`, 'action_failed') };
  }
  if (!tree || tree.error) {
    const errorClass =
      tree?.error !== undefined && options.refId !== null ? 'ref_stale' : 'action_failed';
    return {
      failed: errorText(`${toolName} failed: ${tree?.error ?? 'no result from page'}`, errorClass),
    };
  }
  return tree;
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

async function handleReadPage(tab, args) {
  const tree = await accessibilityTree(tab, 'read_page', {
    filter: args.filter ?? 'all',
    maxDepth: finiteOr(args.depth, DEFAULT_TREE_DEPTH),
    maxChars: finiteOr(args.max_chars, DEFAULT_MAX_CHARS),
    refId: args.ref_id ?? null,
  });
  if (tree.failed) return tree.failed;
  const { width, height } = tree.viewport;
  return text(`${tree.pageContent || '(empty page)'}\n\nViewport: ${width}x${height}`);
}

async function handleFind(tab, args) {
  if (typeof args.query !== 'string') {
    return errorText('`find` requires a string `query`', 'input_invalid');
  }
  const tree = await accessibilityTree(tab, 'find', {
    filter: 'all',
    maxDepth: DEFAULT_TREE_DEPTH,
    maxChars: FIND_MAX_CHARS,
    refId: null,
  });
  if (tree.failed) return tree.failed;
  const query = args.query.toLowerCase();
  const lines = tree.pageContent.split('\n');
  const matches = lines
    .filter((line) => line.toLowerCase().includes(query) && /\[ref_\d+\]/.test(line))
    .slice(0, MAX_FIND_MATCHES)
    .map((line) => line.trim());
  const partial = lines.some(
    (line) => line.startsWith('[truncated at ') || line.startsWith('[output truncated at ')
  )
    ? '\n(Page is very large; only the first part of it was searched.)'
    : '';
  return text(
    matches.length === 0
      ? `No matches for "${args.query}".${partial}`
      : `Found ${matches.length} match(es) for "${args.query}":\n${matches.map((line) => `- ${line}`).join('\n')}${partial}`
  );
}

async function handleGetPageText(tab, args) {
  const maxChars = finiteOr(args.max_chars, DEFAULT_MAX_CHARS);
  try {
    const result = await tab.page.evaluate((limit) => {
      if (!document.body) return { noBody: true };
      const candidates = ['article', 'main', '[class*="articleBody"]', '[role="main"]', '#content']
        .map((selector) => document.querySelector(selector))
        .filter((element) => element?.innerText);
      const best = candidates.reduce(
        (current, element) =>
          element.innerText.length > (current === document.body ? 0 : current.innerText.length)
            ? element
            : current,
        document.body
      );
      const content = (best.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
      return {
        title: document.title,
        url: location.href,
        tag: best.tagName.toLowerCase(),
        text: content.slice(0, limit),
        truncated: content.length > limit,
      };
    }, maxChars);
    if (result.noBody) {
      return errorText(
        'This page has no HTML body to read (for example an XML or SVG document).',
        'not_available_here'
      );
    }
    const truncated = result.truncated ? `\n\n[truncated to ${maxChars} chars]` : '';
    return text(
      `Title: ${cleanTitle(result.title)}\nURL: ${result.url}\nSource element: <${result.tag}>\n---\n${result.text}${truncated}`
    );
  } catch (error) {
    return errorText(`get_page_text failed: ${messageOf(error)}`, 'action_failed');
  }
}

function parseScale(value) {
  if (value === undefined) return undefined;
  return typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < MIN_SCREENSHOT_SCALE ||
    value > 1
    ? {
        error: `scale must be a number in [${MIN_SCREENSHOT_SCALE}, 1] — e.g. 0.5 for a half-size image`,
      }
    : value;
}

// The app sends JPEGs at most 800px wide; coordinates stay in that full-size frame
// even when `scale` shrinks the image.
async function captureScreenshot(tab, scale) {
  const viewport = await tab.page.evaluate(() => ({
    x: scrollX,
    y: scrollY,
    width: innerWidth,
    height: innerHeight,
  }));
  const frameWidth = Math.min(viewport.width, SCREENSHOT_MAX_WIDTH);
  const frameHeight = Math.max(1, Math.floor((frameWidth / viewport.width) * viewport.height));
  const width = Math.max(1, Math.round(frameWidth * (scale ?? 1)));
  const height = Math.max(1, Math.floor((width / viewport.width) * viewport.height));
  const { data } = await tab.cdp.send('Page.captureScreenshot', {
    format: 'jpeg',
    quality: SCREENSHOT_JPEG_QUALITY,
    clip: { ...viewport, scale: width / viewport.width },
  });
  tab.screenshotFrame = {
    origin: originOf(tab.page.url()),
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    screenshotWidth: frameWidth,
    screenshotHeight: frameHeight,
  };
  return { data, width, height, frameWidth, frameHeight };
}

function screenshotFrameFor(tab, action) {
  const frame = tab.screenshotFrame;
  if (frame !== null && frame.origin === originOf(tab.page.url())) return { frame };
  return {
    error:
      frame !== null
        ? `${action}: this tab has loaded a different site or document that you have not screenshotted yet; take a computer{action:"screenshot"} before using \`coordinate\`.`
        : `${action} with \`coordinate\` requires a prior computer{action:"screenshot"} (no screenshot dimensions cached)`,
    errorClass: 'needs_screenshot',
  };
}

function outsideFrame(frame, [x, y]) {
  const inside =
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= 0 &&
    y >= 0 &&
    x < frame.screenshotWidth + COORDINATE_TOLERANCE &&
    y < frame.screenshotHeight + COORDINATE_TOLERANCE;
  return inside
    ? null
    : `coordinate (${Math.round(x)}, ${Math.round(y)}) is outside the coordinate frame (${frame.screenshotWidth}x${frame.screenshotHeight}). Coordinates are pixels in the full-resolution frame — if the page changed, take a new screenshot first.`;
}

function toViewportPoint(frame, [x, y]) {
  const clamp = (value, max) => Math.max(0, Math.min(Math.round(value), max - 1));
  return [
    clamp(x * (frame.viewportWidth / frame.screenshotWidth), frame.viewportWidth),
    clamp(y * (frame.viewportHeight / frame.screenshotHeight), frame.viewportHeight),
  ];
}

async function framePoint(tab, action, coordinate) {
  const { frame, error, errorClass } = screenshotFrameFor(tab, action);
  if (error) return { error, errorClass };
  const outside = outsideFrame(frame, coordinate);
  return outside
    ? { error: `${action}: ${outside}`, errorClass: 'coordinate_out_of_bounds' }
    : { point: toViewportPoint(frame, coordinate) };
}

async function refPoint(tab, ref, forClick) {
  const found = await tab.page.evaluate((target) => {
    const byRef = window.__browserMockRefs?.byRef;
    if (!byRef) return { error: 'ref map not initialized; call read_page first' };
    if (!byRef[target]) return { error: `ref not found: ${target}` };
    const element = byRef[target].deref();
    if (!element || !element.isConnected)
      return { error: `ref is stale (element removed): ${target}` };
    element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    const rect = element.getBoundingClientRect();
    const scroller = document.scrollingElement || document.documentElement;
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      vw: Math.min(innerWidth, scroller.clientWidth || innerWidth),
      vh: Math.min(innerHeight, scroller.clientHeight || innerHeight),
    };
  }, ref);
  if (found.error) return { error: found.error, errorClass: 'ref_stale' };
  const visible =
    found.right > 0 && found.left <= found.vw - 1 && found.bottom > 0 && found.top <= found.vh - 1;
  if (forClick && !visible) {
    return {
      error: `ref ${ref} is entirely outside the viewport (center (${Math.round(found.x)}, ${Math.round(found.y)})) — likely hidden or off-canvas, so a click cannot reach it. Interact with what opens it first, or re-run read_page and pick a visible element.`,
      errorClass: 'ref_stale',
    };
  }
  return {
    x: Math.max(0, Math.min(found.x, found.vw - 1)),
    y: Math.max(0, Math.min(found.y, found.vh - 1)),
  };
}

async function pointerTarget(tab, args, action) {
  if (args.ref) {
    const found = await refPoint(tab, args.ref, true);
    if (found.error) return found;
    const point = [Math.round(found.x), Math.round(found.y)];
    return { point, echo: point };
  }
  if (args.coordinate) {
    const target = await framePoint(tab, action, args.coordinate);
    return target.error ? target : { point: target.point, echo: args.coordinate.map(Math.round) };
  }
  return {
    error: `${action} requires either \`ref\` or \`coordinate\``,
    errorClass: 'input_invalid',
  };
}

const MODIFIER_KEYS = {
  alt: 'Alt',
  ctrl: 'Control',
  control: 'Control',
  meta: 'Meta',
  cmd: 'Meta',
  win: 'Meta',
  windows: 'Meta',
  shift: 'Shift',
};
const NAMED_KEYS = {
  enter: 'Enter',
  return: 'Enter',
  kp_enter: 'Enter',
  tab: 'Tab',
  backspace: 'Backspace',
  delete: 'Delete',
  escape: 'Escape',
  esc: 'Escape',
  space: ' ',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  ...Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [`f${index + 1}`, `F${index + 1}`])
  ),
};

function parseModifiers(value) {
  if (!value) return [];
  return [
    ...new Set(
      value
        .toLowerCase()
        .split('+')
        .map((part) => MODIFIER_KEYS[part])
        .filter(Boolean)
    ),
  ];
}

// Splits an xdotool-style token such as "cmd+a", "Return" or "ctrl++" into
// Playwright modifier and key names.
function parseKeyToken(token) {
  const parts = token.split('+');
  let key = parts.pop();
  if (key === '') {
    parts.pop();
    key = '+';
  }
  if (!key) return null;
  return { modifiers: parseModifiers(parts.join('+')), key: NAMED_KEYS[key.toLowerCase()] ?? key };
}

const MODIFIER_BITS = { Alt: 1, Control: 2, Meta: 4, Shift: 8 };

// Playwright only knows DOM key names; like the app, any other name still reaches
// the page as a bare keydown and keyup.
async function pressKey(tab, { modifiers, key }) {
  try {
    await tab.page.keyboard.press([...modifiers, key].join('+'));
  } catch (error) {
    if (!/Unknown key/.test(messageOf(error))) throw error;
    const mask = modifiers.reduce((bits, modifier) => bits | MODIFIER_BITS[modifier], 0);
    for (const type of ['keyDown', 'keyUp']) {
      await tab.cdp.send('Input.dispatchKeyEvent', { type, key, modifiers: mask });
    }
  }
}

async function withModifiers(page, modifiers, run) {
  for (const modifier of modifiers) await page.keyboard.down(modifier);
  try {
    await run();
  } finally {
    for (const modifier of modifiers.toReversed()) await page.keyboard.up(modifier);
  }
}

async function nextFrame(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
}

async function runComputerAction(tab, args) {
  const { action } = args;
  const page = tab.page;
  switch (action) {
    case 'screenshot':
    case 'zoom': {
      const scale = parseScale(args.scale);
      if (scale?.error) return errorText(scale.error, 'input_invalid');
      const shot = await captureScreenshot(tab, scale);
      const scaleNote =
        scale !== undefined && scale < 1
          ? ` ${scale}-scale view; coordinate frame: ${shot.frameWidth}x${shot.frameHeight}.`
          : '';
      const note =
        action === 'zoom'
          ? `zoom: region crop not yet supported in the Browser pane; full screenshot returned${scaleNote}`
          : `Screenshot size: ${shot.width}x${shot.height}${scaleNote}`;
      return {
        content: [
          { type: 'image', data: shot.data, mimeType: 'image/jpeg' },
          { type: 'text', text: note },
        ],
      };
    }
    case 'left_click':
    case 'right_click':
    case 'double_click':
    case 'triple_click': {
      const target = await pointerTarget(tab, args, action);
      if (target.error) return errorText(target.error, target.errorClass);
      const clickCount = { double_click: 2, triple_click: 3 }[action] ?? 1;
      const button = action === 'right_click' ? 'right' : 'left';
      await withModifiers(page, parseModifiers(args.modifiers), () =>
        page.mouse.click(target.point[0], target.point[1], { button, clickCount })
      );
      const ref = args.ref ? ` [${args.ref}]` : '';
      return text(`${action} at (${target.echo[0]}, ${target.echo[1]})${ref}`);
    }
    case 'hover': {
      const target = await pointerTarget(tab, args, action);
      if (target.error) return errorText(target.error, target.errorClass);
      await page.mouse.move(target.point[0], target.point[1]);
      return text(`hover at (${target.echo[0]}, ${target.echo[1]})`);
    }
    case 'type': {
      if (typeof args.text !== 'string')
        return errorText('`type` requires `text`', 'input_invalid');
      await page.keyboard.type(args.text);
      return text(`typed ${args.text.length} chars`);
    }
    case 'key': {
      if (typeof args.text !== 'string') return errorText('`key` requires `text`', 'input_invalid');
      const repeat = Number.isFinite(args.repeat)
        ? Math.min(Math.max(Number(args.repeat), 1), MAX_KEY_REPEAT)
        : 1;
      const tokens = args.text.split(/\s+/).filter(Boolean);
      if (tokens.length > MAX_KEY_TOKENS) {
        return errorText(
          `\`key\` accepts at most ${MAX_KEY_TOKENS} tokens (got ${tokens.length})`,
          'input_invalid'
        );
      }
      const combos = tokens.map(parseKeyToken).filter((combo) => combo !== null);
      if (combos.length === 0) {
        return errorText(`\`key\` parsed no valid tokens from "${args.text}"`, 'input_invalid');
      }
      for (let round = 0; round < repeat; round++) {
        for (const combo of combos) await pressKey(tab, combo);
      }
      return text(`pressed ${args.text} x${repeat}`);
    }
    case 'scroll': {
      if (!args.coordinate) return errorText('`scroll` requires `coordinate`', 'input_invalid');
      const target = await framePoint(tab, action, args.coordinate);
      if (target.error) return errorText(target.error, target.errorClass);
      const direction = args.scroll_direction ?? 'down';
      if (!['up', 'down', 'left', 'right'].includes(direction)) {
        return errorText(
          '`scroll` requires `scroll_direction` of up/down/left/right',
          'input_invalid'
        );
      }
      const distance = finiteOr(args.scroll_amount, DEFAULT_SCROLL_TICKS) * SCROLL_TICK_PIXELS;
      const deltaX = { left: -distance, right: distance }[direction] ?? 0;
      const deltaY = { up: -distance, down: distance }[direction] ?? 0;
      await page.mouse.move(target.point[0], target.point[1]);
      await page.mouse.wheel(deltaX, deltaY);
      await nextFrame(page);
      const [x, y] = args.coordinate.map(Math.round);
      return text(`scrolled ${direction} at (${x}, ${y})`);
    }
    case 'scroll_to': {
      if (!args.ref) return errorText('`scroll_to` requires `ref`', 'input_invalid');
      const found = await refPoint(tab, args.ref, false);
      if (found.error) return errorText(found.error, found.errorClass);
      return text(`scrolled ${args.ref} into view`);
    }
    case 'left_click_drag': {
      if (!args.start_coordinate || !args.coordinate) {
        return errorText(
          '`left_click_drag` requires `start_coordinate` and `coordinate`',
          'input_invalid'
        );
      }
      const start = await framePoint(tab, action, args.start_coordinate);
      if (start.error) return errorText(start.error, start.errorClass);
      const end = await framePoint(tab, action, args.coordinate);
      if (end.error) return errorText(end.error, end.errorClass);
      await page.mouse.move(start.point[0], start.point[1]);
      await page.mouse.down();
      await page.mouse.move(end.point[0], end.point[1], { steps: 10 });
      await page.mouse.up();
      const [x0, y0] = args.start_coordinate.map(Math.round);
      const [x1, y1] = args.coordinate.map(Math.round);
      return text(`dragged (${x0},${y0}) → (${x1},${y1})`);
    }
    case 'wait': {
      const seconds = Math.min(args.duration ?? 1, MAX_WAIT_SECONDS);
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return text(`waited ${seconds}s`);
    }
    default:
      return errorText(`Unknown computer action: ${action}`, 'input_invalid');
  }
}

async function handleComputer(tab, args) {
  try {
    return await runComputerAction(tab, args);
  } catch (error) {
    const errorClass =
      args.action === 'screenshot' || args.action === 'zoom' ? 'capture_failed' : 'action_failed';
    return errorText(`${args.action} failed: ${messageOf(error)}`, errorClass);
  }
}

function isTruthyFormValue(value) {
  return [true, 1, 'true', '1', 'on', 'yes'].includes(value);
}

async function handleFormInput(tab, args) {
  const value = String(args.value);
  try {
    const result = await tab.page.evaluate(
      ({ ref, value: text, checked }) => {
        const byRef = window.__browserMockRefs?.byRef;
        if (!byRef)
          return { ok: false, ref: true, error: 'ref map not initialized; call read_page first' };
        const element = byRef[ref]?.deref();
        if (!element || !element.isConnected) {
          return { ok: false, ref: true, error: `ref not found or stale: ${ref}` };
        }
        element.focus();
        const tag = element.tagName.toLowerCase();
        const setNative = (prototype, property, next) => {
          const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
          if (descriptor?.set) descriptor.set.call(element, next);
          else element[property] = next;
        };
        if (tag === 'select') {
          const option = [...element.options].find(
            (item) => item.value === text || item.text === text
          );
          if (!option) return { ok: false, error: 'option not found' };
          setNative(HTMLSelectElement.prototype, 'value', option.value);
        } else if (element.type === 'radio') {
          setNative(HTMLInputElement.prototype, 'checked', true);
        } else if (element.type === 'checkbox') {
          setNative(HTMLInputElement.prototype, 'checked', checked);
        } else if (tag === 'input' || tag === 'textarea') {
          const prototype =
            tag === 'textarea' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          setNative(prototype, 'value', text);
        } else if (element.isContentEditable) {
          element.textContent = text;
        } else {
          return { ok: false, error: 'element is not fillable' };
        }
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
        return { ok: true };
      },
      { ref: args.ref, value, checked: isTruthyFormValue(args.value) }
    );
    if (!result?.ok) {
      const errorClass = result ? (result.ref ? 'ref_stale' : 'input_invalid') : 'action_failed';
      return errorText(`form_input failed: ${result?.error ?? 'no result from page'}`, errorClass);
    }
    return text(`filled ${args.ref} with value`);
  } catch (error) {
    return errorText(`form_input failed: ${messageOf(error)}`, 'action_failed');
  }
}

function evaluationError(response, mayBeParseTime) {
  const details = response.exceptionDetails;
  if (!details) return null;
  const error = new Error(details.exception?.description ?? details.text ?? 'Evaluation failed');
  error.parseError =
    mayBeParseTime &&
    details.exception?.className === 'SyntaxError' &&
    details.stackTrace === undefined &&
    details.scriptId !== undefined;
  return error;
}

// Evaluates like the app: REPL mode returns the last expression and allows
// top-level await; the result comes back by value.
async function evaluateInPage(tab, expression, replMode) {
  const objectGroup = replMode ? `repl-eval:${++evaluateSequence}` : undefined;
  try {
    const response = await tab.cdp.send('Runtime.evaluate', {
      expression,
      returnByValue: !replMode,
      awaitPromise: true,
      ...(replMode && { replMode: true, objectGroup }),
      timeout: EVALUATE_TIMEOUT_MS,
    });
    const failure = evaluationError(response, replMode);
    if (failure) throw failure;
    let { result } = response;
    if (result?.objectId !== undefined) {
      const byValue = await tab.cdp.send('Runtime.callFunctionOn', {
        objectId: result.objectId,
        functionDeclaration: 'function(){return this}',
        awaitPromise: true,
        returnByValue: true,
      });
      const byValueFailure = evaluationError(byValue, false);
      if (byValueFailure) throw byValueFailure;
      result = byValue.result;
    }
    return result?.value;
  } finally {
    if (objectGroup !== undefined) {
      tab.cdp.send('Runtime.releaseObjectGroup', { objectGroup }).catch(() => {});
    }
  }
}

async function handleJavascriptTool(tab, args) {
  const code = args.text ?? '';
  const format = (value) => (value === undefined ? 'undefined' : JSON.stringify(value, null, 2));
  try {
    try {
      return text(format(await evaluateInPage(tab, `{${code}\n}`, true)));
    } catch (error) {
      if (!error.parseError || !/Illegal return statement/.test(error.message)) throw error;
      return text(format(await evaluateInPage(tab, `(async()=>{\n${code}\n})()`, false)));
    }
  } catch (error) {
    const message = messageOf(error);
    if (
      /navigated or closed|context was destroyed|Cannot find context|Promise was collected/i.test(
        message
      )
    ) {
      return text(SCRIPT_CUT_OFF_BY_NAVIGATION_TEXT);
    }
    return errorText(`javascript_tool failed: ${message}`, 'js_execution_error');
  }
}

function showingNote(limit, total, noun, maxLimit = Infinity) {
  if (total <= limit) return '';
  const raise = limit < maxLimit ? "; raise 'limit' to see older ones" : '';
  return `\n\n(Showing the last ${limit} of ${total} ${noun}${raise}.)`;
}

function droppedNote(count, noun) {
  return count > 0
    ? `\n\n(${count} earlier ${noun} were dropped unread before this call — the tab only buffers the most recent ones.)`
    : '';
}

function handleReadConsoleMessages(tab, args) {
  const pageOrigin = originOf(tab.page.url());
  let entries = tab.console.entries.filter(
    (entry) =>
      (!args.onlyErrors || entry.level === 'error') &&
      (entry.origin === null || (pageOrigin !== null && entry.origin === pageOrigin))
  );
  if (args.pattern) {
    entries = entries.filter((entry) => entry.text.includes(args.pattern));
  }
  const limit = Math.min(Math.max(1, args.limit ?? DEFAULT_ENTRY_LIMIT), MAX_CONSOLE_LIMIT);
  const body =
    entries.length === 0
      ? 'No console logs.'
      : entries
          .slice(-limit)
          .map((entry) => `[${entry.level}] ${entry.text}`)
          .join('\n');
  const dropped = markRead(tab.console);
  return text(
    body +
      showingNote(limit, entries.length, 'matching console messages', MAX_CONSOLE_LIMIT) +
      droppedNote(dropped, 'console messages')
  );
}

function formatRequest(entry) {
  let line = `[${entry.requestId}] ${entry.method} ${entry.url}`;
  if (entry.status !== undefined) line += ` → ${entry.status} ${entry.statusText}`;
  if (entry.failed) line += ` [FAILED: ${entry.errorText}]`;
  return line;
}

async function handleReadNetworkRequests(tab, args) {
  const pageOrigin = originOf(tab.page.url());
  const isListed = (url) =>
    isLoopbackHost(hostnameOf(url)) || (pageOrigin !== null && originOf(url) === pageOrigin);

  if (args.requestId) {
    const unavailable = errorText(`Response body not available for request ${args.requestId}.`);
    const entry = findRequest(tab, args.requestId);
    if (entry === undefined || !isListed(entry.url)) return unavailable;
    let response;
    try {
      response = await tab.cdp.send('Network.getResponseBody', { requestId: args.requestId });
    } catch {
      return unavailable;
    }
    return text(
      response.base64Encoded
        ? `(binary, ${response.body.length} chars base64)`
        : response.body.slice(0, MAX_RESPONSE_BODY_CHARS)
    );
  }

  let entries = tab.network.entries.filter((entry) => isListed(entry.url));
  if (args.urlPattern) {
    entries = entries.filter((entry) => entry.url.includes(args.urlPattern));
  }
  const limit = Math.max(1, args.limit ?? DEFAULT_ENTRY_LIMIT);
  const listing = entries.slice(-limit).map(formatRequest).join('\n');
  const empty = args.urlPattern
    ? `No requests matching "${args.urlPattern}".`
    : 'No network requests recorded.';
  const dropped = markRead(tab.network);
  return text(
    (listing || empty) +
      showingNote(limit, entries.length, 'matching requests') +
      droppedNote(dropped, 'requests')
  );
}

function isViewportDimension(value) {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 1 &&
    value <= MAX_VIEWPORT_DIMENSION
  );
}

async function mobileUserAgent() {
  const major = (await getBrowser()).version().split('.')[0];
  return `Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Mobile Safari/537.36`;
}

async function emulateViewport(tab, size) {
  tab.emulatedViewport = size;
  await tab.page.setViewportSize(size ?? VIEWPORT);
  const mobile = size !== null && size.width < MOBILE_MAX_WIDTH;
  await tab.cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: mobile,
    ...(mobile && { maxTouchPoints: MOBILE_TOUCH_POINTS }),
  });
  await tab.cdp.send('Emulation.setUserAgentOverride', {
    userAgent: mobile ? await mobileUserAgent() : '',
  });
}

async function handleResizeWindow(tab, args) {
  const { preset, width, height, colorScheme } = args;
  try {
    if (colorScheme != null && colorScheme !== 'light' && colorScheme !== 'dark') {
      return errorText(
        `Unknown colorScheme "${String(colorScheme).slice(0, 40)}". Use light or dark.`,
        'input_invalid'
      );
    }
    const notes = [];
    if (preset === 'desktop') {
      await emulateViewport(tab, null);
      notes.push(
        "Viewport emulation cleared; the tab is back to the pane's responsive size (desktop)"
      );
    } else if (preset != null || width != null || height != null) {
      let size;
      if (preset != null) {
        if (!Object.hasOwn(VIEWPORT_PRESETS, preset)) {
          return errorText(
            `Unknown preset "${String(preset).slice(0, 40)}". Use mobile, tablet, or desktop.`,
            'input_invalid'
          );
        }
        size = VIEWPORT_PRESETS[preset];
      } else if (isViewportDimension(width) && isViewportDimension(height)) {
        size = { width: Math.round(width), height: Math.round(height) };
      } else {
        return errorText(
          `A custom viewport needs both width and height, each a number from 1 to ${MAX_VIEWPORT_DIMENSION}. Use preset "mobile" or "tablet" for a device size, or preset "desktop" to clear the emulation and return to the pane's responsive size.`,
          'input_invalid'
        );
      }
      await emulateViewport(tab, size);
      notes.push(
        `Viewport set to ${size.width}x${size.height}${preset ? ` (${preset})` : ''} on this tab (scaled down to fit if larger than the pane). Reset it with preset "desktop" as soon as you finish testing`
      );
    }
    if (colorScheme != null) {
      await tab.page.emulateMedia({ colorScheme });
      notes.push(
        `Color scheme emulation set to ${colorScheme} on this tab; it survives reloads until you set the other value or the pane re-syncs the tab to the app theme`
      );
    }
    return notes.length === 0
      ? errorText(
          'Provide a preset (mobile/tablet/desktop), width/height, or colorScheme.',
          'input_invalid'
        )
      : text(`${notes.join('. ')}.`);
  } catch (error) {
    return errorText(`Resize failed: ${messageOf(error)}`, 'action_failed');
  }
}

async function withTabContext(result, tab) {
  const title = cleanTitle(await tab.page?.title().catch(() => ''));
  let context = `\n\nTab Context:\n- Executed on tabId: ${tab.id}\n- Available tabs:\n  • tabId ${tab.id}: "${title}" ("${tab.page?.url() ?? '(no page)'}")`;
  if (tab.emulatedViewport !== null) {
    const { width, height } = tab.emulatedViewport;
    context += `\n- Viewport: emulating ${width}x${height} (you set this; reset it with preset "desktop" when you finish testing)`;
  }
  return { ...result, content: [...result.content, { type: 'text', text: context }] };
}

function stuckPageHint(toolName) {
  return toolName === 'javascript_tool'
    ? 'The script did not finish (a promise that never settles, or polling that never ends); return sooner or split the work across calls.'
    : 'The page may be stuck (modal dialog, navigation hang, or unresponsive renderer). Check `read_console_messages` for errors.';
}

async function withTimeout(toolName, tab, run) {
  if (!TIMED_TOOLS.has(toolName)) return run();
  const limit = toolName === 'javascript_tool' ? JAVASCRIPT_TIMEOUT_MS : TOOL_TIMEOUT_MS;
  let timer;
  const timedOut = new Promise((resolve) => {
    timer = setTimeout(() => {
      resolve(
        errorText(
          `${toolName} timed out after ${limit / 1000}s. ${paneStatus(tab.id)} ${stuckPageHint(toolName)}`,
          'cdp_timeout'
        )
      );
    }, limit);
  });
  try {
    return await Promise.race([run(), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

const TAB_HANDLERS = {
  tabs_context: handleTabsContext,
  tabs_create: handleTabsCreate,
  tabs_select: handleTabsSelect,
  tabs_close: handleTabsClose,
};

const PAGE_HANDLERS = {
  navigate: handleNavigate,
  read_page: handleReadPage,
  computer: handleComputer,
  form_input: handleFormInput,
  find: handleFind,
  get_page_text: handleGetPageText,
  javascript_tool: handleJavascriptTool,
  read_console_messages: handleReadConsoleMessages,
  read_network_requests: handleReadNetworkRequests,
  resize_window: handleResizeWindow,
};

// `canOpenPane` is false for batch actions after the first, which the app refuses
// to let open the pane.
async function callTool(name, args, canOpenPane = true) {
  if (name === 'browser_batch') return runBatch(args);
  if (name === 'preview_start') return handlePreviewStart(args);
  if (pane === null) return closedPaneResult(name, args, canOpenPane);
  if (Object.hasOwn(TAB_HANDLERS, name)) return TAB_HANDLERS[name](args);

  const tab = resolveTab(args.tabId);
  if (tab === undefined) {
    return errorText(`Preview tab ${args.tabId} is no longer open.`, 'tab_gone');
  }
  if (name !== 'navigate') {
    const reason = noPageReason(tab);
    if (reason !== null) return errorText(NO_PAGE_TEXTS[reason], 'no_page_in_tab');
  }
  const result = await withTimeout(name, tab, () => PAGE_HANDLERS[name](tab, args));
  return result.isError ? result : withTabContext(result, tab);
}

function parseBatch({ actions }) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return { error: 'actions must be a non-empty array' };
  }
  if (actions.length > MAX_BATCH_ACTIONS) {
    return { error: `at most ${MAX_BATCH_ACTIONS} actions per batch` };
  }
  const parsed = [];
  for (const [index, action] of actions.entries()) {
    if (typeof action?.name !== 'string')
      return { error: `actions[${index}].name must be a string` };
    const name = action.name.startsWith(TOOL_PREFIX)
      ? action.name.slice(TOOL_PREFIX.length)
      : action.name;
    if (name === 'browser_batch')
      return { error: `actions[${index}]: browser_batch cannot be nested` };
    if (!BATCHABLE_TOOLS.has(name)) {
      return { error: `actions[${index}]: "${name.slice(0, 64)}" cannot run in a batch` };
    }
    if (!action.input || typeof action.input !== 'object' || Array.isArray(action.input)) {
      return { error: `actions[${index}].input must be an object` };
    }
    parsed.push({ name, input: { ...action.input } });
  }
  return { actions: parsed };
}

async function runBatch(args) {
  const { actions, error } = parseBatch(args);
  if (error) return errorText(error, 'batch_invalid');

  const content = [];
  const completed = [];
  const startedAt = Date.now();
  for (const [index, action] of actions.entries()) {
    if (index > 0 && Date.now() - startedAt > BATCH_BUDGET_MS) {
      content.push({
        type: 'text',
        text: `Stopped after ${index} of ${actions.length} actions (time budget for one call); actions[${index}] onward did not run. Continue with the remaining actions in a new call.`,
      });
      break;
    }
    const label =
      typeof action.input.action === 'string'
        ? `${action.name}:${action.input.action}`
        : action.name;
    let result;
    try {
      result = await callTool(action.name, action.input, index === 0);
    } catch (thrown) {
      const kind = thrown instanceof Error ? thrown.constructor.name : typeof thrown;
      result = errorText(`${action.name} threw (${kind})`, 'unknown_exception');
    }
    const output =
      result.content.flatMap((item) => (item.type === 'text' ? [item.text] : [])).join('\n') ||
      'ok';
    if (result.isError === true) {
      const prior = completed.length > 0 ? `${completed.join('\n')}\n\n` : '';
      const remaining = actions.length - index - 1;
      return {
        ...errorText(
          `${prior}actions[${index}] (${label}) failed: ${output} (${index} completed, ${remaining} remaining)`
        ),
        _meta: result._meta,
      };
    }
    const media = result.content.filter((item) => item.type !== 'text');
    completed.push(
      `[${label}] ${output}${media.length > 0 ? ' [Image omitted due to error]' : ''}`
    );
    content.push({ type: 'text', text: `[${label}] ${output}` }, ...media);
  }
  return { content };
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
    if (!TOOL_NAMES.has(name)) {
      fail(id, -32601, `Unknown tool: ${name}`);
      return;
    }
    try {
      reply(id, await callTool(name, params?.arguments ?? {}));
    } catch (error) {
      reply(id, errorText(`${name} failed: ${messageOf(error)}`));
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
