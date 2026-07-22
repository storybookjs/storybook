#!/usr/bin/env node
/**
 * Stand-in MCP server for Claude's native desktop "preview" tools, used in
 * agent evals. Tool names, schemas, and descriptions mirror the real server
 * verbatim, and response wordings were captured from the real tools. Behavior
 * is real where the sandbox allows it:
 *
 * - `preview_start` validates `.claude/launch.json`, spawns the configured
 *   command, and waits for it to become ready. Port conflicts follow the
 *   documented `autoPort` semantics: `true` starts on an OS-assigned free
 *   port (passed to the server via the `PORT` env var), `false` fails, and
 *   unset asks the agent to decide by setting `autoPort`.
 * - Page tools (click/fill/eval/screenshot/snapshot/inspect/console/network/
 *   resize) drive a real headless Chromium, resolved from the workspace's
 *   `playwright` install (the eval template installs it during postinstall).
 *   Like the real tools, they fall back to the most recently started preview
 *   when the given serverId is unknown.
 */
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { createInterface } from 'node:readline';

// Name kept as `preview-browser` so scoring can recognize browser tool calls.
const SERVER_INFO = { name: 'preview-browser', version: '2.0.0' };

const LAUNCH_CONFIG_PATH = '.claude/launch.json';
const DEFAULT_PORT = 3000;
const SERVER_READY_TIMEOUT_MS = 120_000;
const ACTION_TIMEOUT_MS = 5_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const SESSION_ID = `local_${randomUUID()}`;

// Matches the format block in the real preview_start tool description.
const LAUNCH_CONFIG_FORMAT = `{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "<unique-name>",
      "runtimeExecutable": "<command>",
      "runtimeArgs": ["<args>"],
      "port": <port>
    }
  ]
}`;

/**
 * serverId -> {
 *   id, name, url, port, startedAt, viewport, colorScheme,
 *   child, logPath, pagePromise, context, consoleMessages, responses
 * }
 */
const servers = new Map();
let requestSequence = 0;
let browserPromise;

function text(value) {
  return { content: [{ type: 'text', text: value }] };
}

function errorText(value) {
  return { content: [{ type: 'text', text: value }], isError: true };
}

/**
 * Resolve a serverId like the real tools: exact match first, otherwise fall
 * back to the most recently started preview. Only errors when nothing runs.
 */
async function withServer(serverId, fn) {
  const server = servers.get(serverId) ?? [...servers.values()].at(-1);
  if (!server) {
    return errorText('No preview server is running. Call preview_start first.');
  }
  return fn(server);
}

function lineLimit(value, { defaultValue = 50, max = 200 } = {}) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) {
    return defaultValue;
  }
  return Math.min(limit, max);
}

function lastLines(lines, limit) {
  return lines.slice(-limit);
}

const TOOLS = [
  {
    name: 'preview_start',
    title: 'Start Preview Server',
    description:
      "Start a dev server by name from .claude/launch.json. If .claude/launch.json doesn't exist, create it first with this format:\n" +
      LAUNCH_CONFIG_FORMAT +
      '\nSet "runtimeExecutable" to the command (e.g. "npm"), "runtimeArgs" to the arguments (e.g. ["run", "dev"]), and "port" to the server port. Only include servers you actually need to preview. Reuses the server if already running. ALWAYS use this instead of Bash for running servers.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Server name from .claude/launch.json.' },
      },
      required: ['name'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'preview_stop',
    title: 'Stop Preview Server',
    description: 'Stop a server started with preview_start.',
    inputSchema: {
      type: 'object',
      properties: { serverId: { type: 'string', description: 'Server ID to stop' } },
      required: ['serverId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, idempotentHint: true },
  },
  {
    name: 'preview_list',
    title: 'List Preview Servers',
    description:
      'List servers started with preview_start. Returns serverIds for use with other preview_* tools.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'preview_click',
    title: 'Click Element',
    description:
      "Click an element by CSS selector (e.g., 'button.primary', '#submit', '[data-testid=\"btn\"]').",
    inputSchema: {
      type: 'object',
      properties: {
        serverId: { type: 'string', description: 'Server ID' },
        selector: { type: 'string', description: 'CSS selector for the element to click' },
        doubleClick: { type: 'boolean', description: 'Perform a double-click' },
      },
      required: ['serverId', 'selector'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: 'preview_fill',
    title: 'Fill Input',
    description:
      'Fill an input, textarea, or select element with a value. For select elements, matches by value or text.',
    inputSchema: {
      type: 'object',
      properties: {
        serverId: { type: 'string', description: 'Server ID' },
        selector: { type: 'string', description: 'CSS selector for the input element' },
        value: { type: 'string', description: 'Value to fill' },
      },
      required: ['serverId', 'selector', 'value'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  },
  {
    name: 'preview_eval',
    title: 'Evaluate JavaScript',
    description:
      'Execute JavaScript in the preview page for DEBUGGING and INSPECTION only. Use for reading page state, DOM queries, checking variables, navigation, page reload, hover/type/key events. Do NOT use this to implement UI changes the user requests — edit the source code instead. Any DOM modifications via eval are temporary and lost on reload. Wrap multi-step logic in an IIFE.',
    inputSchema: {
      type: 'object',
      properties: {
        serverId: { type: 'string', description: 'Server ID' },
        expression: {
          type: 'string',
          description:
            'JavaScript expression to evaluate in the page context. Return values are serialized as JSON.',
        },
      },
      required: ['serverId', 'expression'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'preview_screenshot',
    title: 'Screenshot',
    description:
      'Take a screenshot of the page. Good for checking layout and general appearance, but DO NOT rely on it for verifying colors, font sizes, or precise styles — use preview_inspect with specific CSS properties instead. Returns a compressed JPEG image.',
    inputSchema: {
      type: 'object',
      properties: { serverId: { type: 'string', description: 'Server ID' } },
      required: ['serverId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'preview_snapshot',
    title: 'Accessibility Snapshot',
    description:
      'Get an accessibility tree snapshot of the page. Returns exact text content, roles, and element UIDs for use with click/fill/hover. PREFERRED over screenshot for verifying text, element presence, and page structure.',
    inputSchema: {
      type: 'object',
      properties: { serverId: { type: 'string', description: 'Server ID' } },
      required: ['serverId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'preview_inspect',
    title: 'Inspect Element',
    description:
      'Inspect a DOM element by CSS selector. Returns text content, className, tagName, id, computed styles, and bounding box. BEST tool for verifying visual properties like colors, fonts, spacing, and dimensions — more accurate than screenshots.',
    inputSchema: {
      type: 'object',
      properties: {
        serverId: { type: 'string', description: 'Server ID' },
        selector: { type: 'string', description: "CSS selector (e.g., '.button', '#header')" },
        styles: {
          type: 'array',
          items: { type: 'string' },
          description:
            "CSS properties to return (e.g., ['padding', 'color']). Defaults to common properties.",
        },
      },
      required: ['serverId', 'selector'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'preview_console_logs',
    title: 'Console Logs',
    description:
      "Get browser console output (log, info, warn, error, debug). Use to check runtime behavior, debug values, or client-side errors. Use 'level' to filter to errors or warnings only.",
    inputSchema: {
      type: 'object',
      properties: {
        serverId: { type: 'string', description: 'Server ID' },
        level: {
          type: 'string',
          enum: ['all', 'error', 'warn'],
          description:
            "Filter by level: 'all' (default), 'error' (errors only), 'warn' (warnings + errors)",
        },
        lines: { type: 'number', description: 'Max lines to return (default: 50, max: 200)' },
      },
      required: ['serverId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'preview_logs',
    title: 'Server Logs',
    description:
      "Get server stdout/stderr output. Use to check for build errors, verify server behavior, or read debug output. Use 'level' to filter to errors only, or 'search' to filter for specific text. Use after preview_start.",
    inputSchema: {
      type: 'object',
      properties: {
        serverId: { type: 'string', description: 'Server ID' },
        level: {
          type: 'string',
          enum: ['all', 'error'],
          description:
            "Filter by level: 'all' (default) shows all output, 'error' shows only lines containing error/exception/failed/fatal",
        },
        lines: { type: 'number', description: 'Max lines to return (default: 50)' },
        search: {
          type: 'string',
          description: "Filter to lines containing this text (e.g., '[DEBUG]', 'POST /api')",
        },
      },
      required: ['serverId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'preview_network',
    title: 'Network Requests',
    description:
      'List network requests or inspect a specific response body. Without requestId, lists all requests with URL, method, status, and requestId. With requestId, returns the full response body for that request (useful for inspecting API payloads).',
    inputSchema: {
      type: 'object',
      properties: {
        serverId: { type: 'string', description: 'Server ID' },
        filter: {
          type: 'string',
          enum: ['all', 'failed'],
          description:
            "Filter: 'all' (default) shows all requests, 'failed' shows only 4xx/5xx and network errors. Ignored when requestId is provided.",
        },
        requestId: {
          type: 'string',
          description:
            'If provided, returns the response body for this specific request instead of listing all requests. Get requestIds from the listing output.',
        },
      },
      required: ['serverId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'preview_resize',
    title: 'Resize Viewport',
    description:
      'Resize the preview viewport to test responsive layouts. Presets: mobile (375x812), tablet (768x1024), desktop (1280x800). Also supports custom dimensions and color scheme emulation for dark mode testing.',
    inputSchema: {
      type: 'object',
      properties: {
        serverId: { type: 'string', description: 'Server ID' },
        preset: {
          type: 'string',
          enum: ['mobile', 'tablet', 'desktop'],
          description: 'Device preset. Overrides width/height if provided.',
        },
        width: { type: 'number', description: 'Viewport width in pixels' },
        height: { type: 'number', description: 'Viewport height in pixels' },
        colorScheme: {
          type: 'string',
          enum: ['light', 'dark'],
          description: 'Emulate prefers-color-scheme media feature for dark/light mode testing.',
        },
      },
      required: ['serverId'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false },
  },
];

const PRESETS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};

function readLaunchConfig() {
  if (!existsSync(LAUNCH_CONFIG_PATH)) {
    throw new Error(
      `Failed to start server: No .claude/launch.json found. Create ${path.resolve(
        LAUNCH_CONFIG_PATH
      )} with this format:\n${LAUNCH_CONFIG_FORMAT}\nSet "runtimeExecutable" to the command (e.g. "npm"), "runtimeArgs" to the arguments (e.g. ["run", "dev"]), and "port" to the server port. Only include servers you actually need to preview. Then call preview_start with the server name.\n\nCheck the command in .claude/launch.json and try again.`
    );
  }

  let config;
  try {
    config = JSON.parse(readFileSync(LAUNCH_CONFIG_PATH, 'utf-8'));
  } catch (error) {
    throw new Error(
      `Failed to start server: Could not parse ${LAUNCH_CONFIG_PATH}: ${error?.message ?? error}\n\nCheck the command in .claude/launch.json and try again.`
    );
  }

  return Array.isArray(config?.configurations) ? config.configurations : [];
}

function readLaunchEntry(name) {
  const configurations = readLaunchConfig();
  let entry = configurations.find((candidate) => candidate?.name === name);

  // The real tool starts the only configuration when the name doesn't match.
  if (!entry && configurations.length === 1) {
    entry = configurations[0];
  }

  if (!entry) {
    const available = configurations
      .map((candidate) => candidate?.name)
      .filter((candidateName) => typeof candidateName === 'string');
    throw new Error(
      `Failed to start server: No server named "${name}" found in ${LAUNCH_CONFIG_PATH}. Available servers: ${available.join(
        ', '
      )}. Pass one of these names, or add a new configuration for "${name}".\n\nCheck the command in .claude/launch.json and try again.`
    );
  }

  const port = entry.port === undefined ? DEFAULT_PORT : Number(entry.port);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(
      `Failed to start server: Configuration "${entry.name}" in ${LAUNCH_CONFIG_PATH} has an invalid "port".\n\nCheck the command in .claude/launch.json and try again.`
    );
  }

  return { entry, port };
}

async function isServing(url) {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1_500) });
    return true;
  } catch {
    return false;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => {
      probe.close(() => resolve(true));
    });
  });
}

/** OS-assigned ephemeral port, matching the real tool's autoPort behavior. */
function getEphemeralPort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') {
        probe.close(() => reject(new Error('Failed to allocate a free port')));
        return;
      }
      probe.close(() => resolve(address.port));
    });
  });
}

/** Best-effort description of what holds a port, like the real conflict errors. */
function describePortHolder(port) {
  for (const server of servers.values()) {
    if (server.port === port) {
      return { label: `preview server "${server.name}" (${server.id})`, isPreview: true };
    }
  }
  try {
    const output = execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fpc'], {
      encoding: 'utf-8',
    });
    const pid = /^p(\d+)$/m.exec(output)?.[1];
    const command = /^c(.+)$/m.exec(output)?.[1];
    if (pid && command) {
      return { label: `"${command}" (PID ${pid})`, isPreview: false };
    }
  } catch {
    // lsof unavailable or no match; fall through to the generic label.
  }
  return { label: 'another process', isPreview: false };
}

function tailLogFile(logPath, limit = 20) {
  try {
    return lastLines(readFileSync(logPath, 'utf-8').split('\n').filter(Boolean), limit).join('\n');
  } catch {
    return '';
  }
}

// Supports the documented .claude/launch.json entry fields: `cwd` is relative
// to the project root (with `${workspaceFolder}` for the root itself), `env`
// is merged into the server's environment, and either `runtimeExecutable` +
// `runtimeArgs` or `program` + `args` (a script run with node) starts the server.
function spawnLaunchEntry(name, entry, logPath, extraEnv = {}) {
  const cwd =
    typeof entry.cwd === 'string'
      ? path.resolve(process.cwd(), entry.cwd.replaceAll('${workspaceFolder}', process.cwd()))
      : process.cwd();
  const entryEnv =
    typeof entry.env === 'object' && entry.env !== null && !Array.isArray(entry.env)
      ? entry.env
      : {};
  const log = openSync(logPath, 'a');
  const options = {
    cwd,
    detached: true,
    stdio: ['ignore', log, log],
    env: { ...process.env, ...entryEnv, ...extraEnv, BROWSER: 'none', CI: '1' },
  };

  let child;
  if (typeof entry.runtimeExecutable === 'string' && entry.runtimeExecutable.length > 0) {
    const args = Array.isArray(entry.runtimeArgs) ? entry.runtimeArgs.map(String) : [];
    child = spawn(entry.runtimeExecutable, args, options);
  } else if (typeof entry.program === 'string' && entry.program.length > 0) {
    const args = Array.isArray(entry.args) ? entry.args.map(String) : [];
    child = spawn(process.execPath, [entry.program, ...args], options);
  } else {
    closeSync(log);
    throw new Error(
      `Failed to start server: Configuration "${name}" must set "runtimeExecutable" (with optional "runtimeArgs") or "program" (with optional "args").\n\nCheck the command in .claude/launch.json and try again.`
    );
  }

  child.unref();
  closeSync(log);
  return child;
}

async function waitForServer(url, child, logPath) {
  let exited = false;
  let spawnError;
  child.on('exit', () => {
    exited = true;
  });
  child.on('error', (error) => {
    spawnError = error;
    exited = true;
  });

  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isServing(url)) {
      return;
    }
    if (exited) {
      const logTail = tailLogFile(logPath);
      throw new Error(
        `Failed to start server: Server process exited before ${url} became ready.${spawnError ? ` ${spawnError.message}.` : ''}${
          logTail ? `\nServer output:\n${logTail}` : ''
        }\n\nCheck the command in .claude/launch.json and try again.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  const logTail = tailLogFile(logPath);
  throw new Error(
    `Failed to start server: Server did not become ready at ${url} within ${SERVER_READY_TIMEOUT_MS}ms.${
      logTail ? `\nServer output:\n${logTail}` : ''
    }\n\nCheck the command in .claude/launch.json and try again.`
  );
}

function startResponse(server, { reused, configuredPort }) {
  const payload = {
    serverId: server.id,
    port: server.port,
    name: server.name,
    reused,
    previewId: server.id,
    tabId: 'seed',
  };
  let sentence;
  if (reused) {
    sentence = 'Server was already running and has been reused. No new process was started.';
  } else if (configuredPort !== server.port) {
    sentence = `Server started successfully. Configured port ${configuredPort} was in use, so port ${server.port} was assigned instead (autoPort is enabled). The preview is available at http://localhost:${server.port}.`;
  } else {
    sentence = `Server started successfully on port ${server.port}.`;
  }
  return text(`${JSON.stringify(payload, null, 2)}\n${sentence}`);
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      // Resolved from the workspace install (eval templates depend on
      // playwright and install Chromium during postinstall).
      const { chromium } = await import('playwright');
      return chromium.launch({ headless: true });
    })().catch((error) => {
      browserPromise = undefined;
      throw new Error(`Failed to launch the preview browser: ${error?.message ?? error}`);
    });
  }
  return browserPromise;
}

async function getPage(server) {
  if (!server.pagePromise) {
    server.pagePromise = (async () => {
      const browser = await getBrowser();
      const context = await browser.newContext({
        viewport: { ...server.viewport },
        colorScheme: server.colorScheme,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(ACTION_TIMEOUT_MS);
      page.on('console', (message) => {
        const type = message.type();
        server.consoleMessages.push({
          level: type === 'warning' ? 'warn' : type,
          text: message.text(),
        });
      });
      page.on('pageerror', (error) => {
        server.consoleMessages.push({ level: 'error', text: String(error) });
      });
      page.on('response', (response) => {
        server.responses.push({
          requestId: `${process.pid}.${++requestSequence}`,
          method: response.request().method(),
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
          response,
        });
      });
      page.on('requestfailed', (request) => {
        server.responses.push({
          requestId: `${process.pid}.${++requestSequence}`,
          method: request.method(),
          url: request.url(),
          status: 0,
          statusText: '',
          error: request.failure()?.errorText ?? 'request failed',
        });
      });
      await page.goto(server.url, {
        waitUntil: 'domcontentloaded',
        timeout: NAVIGATION_TIMEOUT_MS,
      });
      server.context = context;
      return page;
    })().catch((error) => {
      server.pagePromise = undefined;
      throw error;
    });
  }
  return server.pagePromise;
}

/** Find `selector` in the main frame first, then in child frames (e.g. the Storybook canvas iframe). */
async function locateInFrames(page, selector) {
  for (const frame of page.frames()) {
    try {
      const locator = frame.locator(selector).first();
      if ((await locator.count()) > 0) {
        return locator;
      }
    } catch {
      // Detached or cross-origin frame; keep looking.
    }
  }
  return null;
}

/** Render the Chrome accessibility tree in the real tool's `[id] role: "name"` format. */
async function renderAccessibilityTree(page) {
  const client = await page.context().newCDPSession(page);
  try {
    const { nodes } = await client.send('Accessibility.getFullAXTree');
    const nodesById = new Map(nodes.map((node) => [node.nodeId, node]));
    const lines = [];
    const render = (nodeId, depth) => {
      const node = nodesById.get(nodeId);
      if (!node) {
        return;
      }
      if (node.ignored) {
        for (const childId of node.childIds ?? []) {
          render(childId, depth);
        }
        return;
      }
      const role = node.role?.value ?? 'unknown';
      const name = node.name?.value;
      lines.push(
        `${'  '.repeat(depth)}[${node.nodeId}] ${role}${name ? `: ${JSON.stringify(name)}` : ''}`
      );
      for (const childId of node.childIds ?? []) {
        render(childId, depth + 1);
      }
    };
    const root = nodes.find((node) => node.parentId === undefined);
    if (root) {
      render(root.nodeId, 0);
    }
    return lines.join('\n');
  } finally {
    await client.detach().catch(() => {});
  }
}

const HANDLERS = {
  async preview_start({ name }) {
    if (typeof name !== 'string' || name.length === 0) {
      return errorText(`preview_start requires a "name" from ${LAUNCH_CONFIG_PATH}.`);
    }

    let entry;
    let port;
    try {
      ({ entry, port } = readLaunchEntry(name));
    } catch (error) {
      return errorText(error.message);
    }

    for (const server of servers.values()) {
      if (server.name === entry.name) {
        return startResponse(server, { reused: true, configuredPort: port });
      }
    }

    // Port conflicts follow the real tool's autoPort semantics. Only servers
    // started by preview_start itself are ever reused (see the check above).
    let assignedPort = port;
    if (!(await isPortFree(port))) {
      const holder = describePortHolder(port);
      if (entry.autoPort === true) {
        try {
          assignedPort = await getEphemeralPort();
        } catch (error) {
          return errorText(`Failed to start server: ${error.message}`);
        }
      } else if (entry.autoPort === false) {
        return errorText(
          `Port ${port} is required by this server but is in use by ${holder.label}. Stop that process to free port ${port} and try again.`
        );
      } else {
        return errorText(
          `Port ${port} is in use by ${holder.isPreview ? holder.label : `${holder.label} (not a preview server)`}. Ask the user: does this server need port ${port} specifically (e.g. for OAuth callbacks, webhooks, or CORS)? If yes, set "autoPort": false in .claude/launch.json and free port ${port}. If no, set "autoPort": true in .claude/launch.json AND check the start command for hardcoded port flags (e.g. --port, -p) — remove them so the server uses the assigned port via the PORT environment variable. Then retry.`
        );
      }
    }

    const id = randomUUID();
    const url = `http://localhost:${assignedPort}`;
    const logPath = path.join(tmpdir(), `${SERVER_INFO.name}-${process.pid}-${id}.log`);

    let child;
    try {
      // Per the docs, a re-assigned port reaches the server via the PORT env var.
      child = spawnLaunchEntry(
        entry.name,
        entry,
        logPath,
        assignedPort === port ? {} : { PORT: String(assignedPort) }
      );
      await waitForServer(url, child, logPath);
    } catch (error) {
      if (child?.pid) {
        try {
          process.kill(-child.pid, 'SIGTERM');
        } catch {
          // Already gone.
        }
      }
      return errorText(error.message);
    }

    const server = {
      id,
      name: entry.name,
      url,
      port: assignedPort,
      startedAt: new Date().toISOString(),
      viewport: { ...PRESETS.desktop },
      colorScheme: 'light',
      child,
      logPath,
      pagePromise: undefined,
      context: undefined,
      consoleMessages: [],
      responses: [],
    };
    servers.set(id, server);
    return startResponse(server, { reused: false, configuredPort: port });
  },

  async preview_stop({ serverId }) {
    const server = servers.get(serverId);
    if (!server) {
      return errorText(`Server ${serverId} not found`);
    }
    servers.delete(serverId);
    await server.context?.close().catch(() => {});
    if (server.child?.pid) {
      try {
        process.kill(-server.child.pid, 'SIGTERM');
      } catch {
        // Already gone.
      }
    }
    return text(`Server ${serverId} stopped`);
  },

  preview_list() {
    const list = [...servers.values()].map((server) => ({
      serverId: server.id,
      name: server.name,
      port: server.port,
      status: 'running',
      startedAt: server.startedAt,
      cwd: process.cwd(),
      sessionId: SESSION_ID,
    }));
    return text(JSON.stringify(list, null, 2));
  },

  async preview_click({ serverId, selector, doubleClick }) {
    if (typeof selector !== 'string' || selector.length === 0) {
      return errorText('preview_click requires a "selector".');
    }
    return withServer(serverId, async (server) => {
      try {
        const page = await getPage(server);
        const locator = await locateInFrames(page, selector);
        if (!locator) {
          return errorText(`Failed to click element: ${selector}`);
        }
        if (doubleClick) {
          await locator.dblclick();
        } else {
          await locator.click();
        }
        return text(`Successfully clicked: ${selector}`);
      } catch {
        return errorText(`Failed to click element: ${selector}`);
      }
    });
  },

  async preview_fill({ serverId, selector, value }) {
    if (typeof selector !== 'string' || typeof value !== 'string') {
      return errorText('preview_fill requires "selector" and "value".');
    }
    return withServer(serverId, async (server) => {
      try {
        const page = await getPage(server);
        const locator = await locateInFrames(page, selector);
        if (!locator) {
          return errorText(`Failed to fill element: ${selector}`);
        }
        const tagName = await locator.evaluate((element) => element.tagName);
        if (tagName === 'SELECT') {
          try {
            await locator.selectOption({ value });
          } catch {
            await locator.selectOption({ label: value });
          }
        } else {
          await locator.fill(value);
        }
        return text(`Successfully filled: ${selector}`);
      } catch {
        return errorText(`Failed to fill element: ${selector}`);
      }
    });
  },

  async preview_eval({ serverId, expression }) {
    if (typeof expression !== 'string' || expression.length === 0) {
      return errorText('preview_eval requires an "expression".');
    }
    return withServer(serverId, async (server) => {
      const page = await getPage(server);
      try {
        const serialized = await page.evaluate((code) => {
          const value = window.eval(code);
          try {
            return JSON.stringify(value, null, 2) ?? 'undefined';
          } catch {
            return String(value);
          }
        }, expression);
        return text(serialized);
      } catch (error) {
        const message = String(error?.message ?? error).replace(/^page\.evaluate: /, '');
        if (message.includes('Execution context was destroyed')) {
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          return text('undefined');
        }
        return errorText(`Eval failed: ${message}`);
      }
    });
  },

  async preview_screenshot({ serverId }) {
    return withServer(serverId, async (server) => {
      const page = await getPage(server);
      const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
      return {
        content: [{ type: 'image', data: screenshot.toString('base64'), mimeType: 'image/jpeg' }],
      };
    });
  },

  async preview_snapshot({ serverId }) {
    return withServer(serverId, async (server) => {
      const page = await getPage(server);
      try {
        return text(await renderAccessibilityTree(page));
      } catch {
        // CDP unavailable; fall back to Playwright's aria snapshot.
        return text(await page.locator('body').ariaSnapshot({ timeout: ACTION_TIMEOUT_MS }));
      }
    });
  },

  async preview_inspect({ serverId, selector, styles }) {
    if (typeof selector !== 'string' || selector.length === 0) {
      return errorText('preview_inspect requires a "selector".');
    }
    const requested =
      Array.isArray(styles) && styles.length > 0
        ? styles.map(String)
        : [
            'color',
            'background-color',
            'font-size',
            'font-family',
            'font-weight',
            'padding',
            'margin',
            'display',
            'width',
            'height',
          ];
    return withServer(serverId, async (server) => {
      const page = await getPage(server);
      const locator = await locateInFrames(page, selector);
      if (!locator) {
        return errorText(`Failed to inspect element: ${selector}`);
      }
      const details = await locator.evaluate((element, properties) => {
        const computed = getComputedStyle(element);
        const elementStyles = {};
        for (const property of properties) {
          elementStyles[property] = computed.getPropertyValue(property);
        }
        const rect = element.getBoundingClientRect();
        return {
          tagName: element.tagName.toLowerCase(),
          text: (element.textContent ?? '').trim(),
          className: typeof element.className === 'string' ? element.className : '',
          id: element.id,
          styles: elementStyles,
          boundingBox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        };
      }, requested);
      return text(JSON.stringify(details));
    });
  },

  async preview_console_logs({ serverId, level, lines }) {
    return withServer(serverId, async (server) => {
      await getPage(server);
      const limit = lineLimit(lines);
      const levels =
        level === 'error'
          ? new Set(['error'])
          : level === 'warn'
            ? new Set(['error', 'warn'])
            : null;
      const messages = server.consoleMessages
        .filter((message) => levels === null || levels.has(message.level))
        .map((message) => `[${message.level}] ${message.text}`);
      return text(lastLines(messages, limit).join('\n') || 'No console logs.');
    });
  },

  async preview_logs({ serverId, search, level, lines }) {
    return withServer(serverId, async (server) => {
      const limit = lineLimit(lines);
      if (!existsSync(server.logPath)) {
        return text('No server output captured.');
      }
      let logLines = readFileSync(server.logPath, 'utf-8').split('\n').filter(Boolean);
      if (level === 'error') {
        logLines = logLines.filter((line) => /error|exception|failed|fatal/i.test(line));
        if (logLines.length === 0) {
          return text('No errors in server output.');
        }
      }
      if (typeof search === 'string' && search.length > 0) {
        logLines = logLines.filter((line) => line.includes(search));
        if (logLines.length === 0) {
          return text(`(no log lines matching "${search}")`);
        }
      }
      return text(lastLines(logLines, limit).join('\n') || 'No server output captured.');
    });
  },

  async preview_network({ serverId, filter, requestId }) {
    return withServer(serverId, async (server) => {
      await getPage(server);
      if (typeof requestId === 'string' && requestId.length > 0) {
        const entry = server.responses.find((candidate) => candidate.requestId === requestId);
        if (!entry) {
          return errorText(`No request with requestId "${requestId}".`);
        }
        let body;
        try {
          body = entry.response ? await entry.response.text() : (entry.error ?? '');
        } catch {
          body = '(response body no longer available)';
        }
        // The real tool pretty-prints JSON response bodies.
        try {
          body = JSON.stringify(JSON.parse(body), null, 2);
        } catch {
          // Not JSON; return the raw body.
        }
        return text(body);
      }
      const entries =
        filter === 'failed'
          ? server.responses.filter((entry) => entry.status >= 400 || entry.status === 0)
          : server.responses;
      const lines = entries.map((entry) =>
        entry.status === 0
          ? `[${entry.requestId}] ${entry.method} ${entry.url} → failed (${entry.error})`
          : `[${entry.requestId}] ${entry.method} ${entry.url} → ${entry.status}${entry.statusText ? ` ${entry.statusText}` : ''}`
      );
      return text(lines.join('\n') || 'No network requests.');
    });
  },

  async preview_resize({ serverId, preset, width, height, colorScheme }) {
    return withServer(serverId, async (server) => {
      let viewportChanged = false;
      if (preset && PRESETS[preset]) {
        server.viewport = { ...PRESETS[preset] };
        viewportChanged = true;
      } else if (Number.isFinite(width) && Number.isFinite(height)) {
        server.viewport = { width: Math.round(width), height: Math.round(height) };
        viewportChanged = true;
      }
      if (colorScheme === 'light' || colorScheme === 'dark') {
        server.colorScheme = colorScheme;
      }
      if (server.pagePromise) {
        const page = await getPage(server);
        await page.setViewportSize(server.viewport);
        await page.emulateMedia({ colorScheme: server.colorScheme });
      }
      const parts = [];
      if (viewportChanged || !colorScheme) {
        parts.push(
          `Viewport set to ${server.viewport.width}x${server.viewport.height}${preset && PRESETS[preset] ? ` (${preset})` : ''}.`
        );
      }
      if (colorScheme === 'light' || colorScheme === 'dark') {
        parts.push(`Color scheme set to ${colorScheme}.`);
      }
      return text(parts.join(' '));
    });
  },
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
      // Tool-level failures become isError results so the agent can react.
      reply(id, errorText(`Tool ${name} failed: ${error?.message ?? error}`));
    }
    return;
  }

  // Notifications (no id) need no response; unknown requests get method-not-found.
  if (id !== undefined && id !== null) {
    fail(id, -32601, `Unknown method: ${method}`);
  }
}

async function shutdown() {
  for (const server of servers.values()) {
    if (server.child?.pid) {
      try {
        process.kill(-server.child.pid, 'SIGTERM');
      } catch {
        // Already gone.
      }
    }
  }
  if (browserPromise) {
    await browserPromise.then((browser) => browser.close()).catch(() => {});
  }
  process.exit(0);
}

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    handle(JSON.parse(trimmed)).catch(() => {});
  } catch {
    // Ignore malformed lines; MCP clients resend on protocol errors.
  }
});
rl.on('close', () => {
  void shutdown();
});
