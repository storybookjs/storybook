import { fileURLToPath } from 'node:url';
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Plugin } from 'vite';

import type { CaptureResponse } from '../types.ts';
import { DEFAULT_EMBED_STORYBOOK_URL } from '../client/embed-url.ts';
import { CaptureRequestError, handleCapture, type PathRoots } from './capture-handler.ts';

const VIRTUAL_CLIENT_ID = 'virtual:sb-devtools-client';

/**
 * Resolved to the real client entry file so Vite's regular pipeline (esbuild
 * TS transform, HMR) loads it — the vite-inject-mocker pattern.
 */
const CLIENT_ENTRY_PATH = fileURLToPath(new URL('../client/entry.ts', import.meta.url));

const CLIENT_SCRIPT_TAG = `<script type="module" src="/@id/${VIRTUAL_CLIENT_ID}"></script>`;

/** The repo's `code/` directory — source.file paths are relativized against it. */
const CODE_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * Pure injection behavior of transformIndexHtml: the client script is added
 * right after the opening <head> tag when (and only when) the dev server is
 * serving. Production builds get the HTML byte-for-byte unchanged.
 */
export function injectDevtoolsClient(html: string, command: string | undefined): string {
  if (command !== 'serve') {
    return html;
  }
  const headTag = html.match(/<head[^>]*>/);
  if (!headTag) {
    return html;
  }
  const headEnd = html.indexOf(headTag[0]) + headTag[0].length;
  return html.slice(0, headEnd) + CLIENT_SCRIPT_TAG + html.slice(headEnd);
}

/**
 * Pure id resolution of the plugin's resolveId hook: only the devtools client
 * virtual module maps (to the real client entry file); everything else passes
 * through.
 */
export function resolveClientEntry(source: string): string | undefined {
  return source === VIRTUAL_CLIENT_ID ? CLIENT_ENTRY_PATH : undefined;
}

export interface DevtoolsSpikePluginOptions {
  /** Story files may only be written inside this glob (relative to the app using the plugin). */
  storiesGlob: string;
  /** Where the embed-host Storybook dev server listens (the storybook-probe target). */
  storybookUrl?: string;
}

/**
 * Devtools spike Vite plugin — dev-only client injection plus the capture
 * middleware under /__sb-devtools (serve mode only).
 */
export function devtoolsSpikePlugin(options: DevtoolsSpikePluginOptions): Plugin {
  let command: string | undefined;

  return {
    name: 'storybook:devtools-spike',
    // Gating uses configResolved (not apply: 'serve') — the repo pattern;
    // apply: 'serve' appears nowhere in this codebase.
    configResolved(config) {
      command = config.command;
    },
    transformIndexHtml(html) {
      return injectDevtoolsClient(html, command);
    },
    resolveId: resolveClientEntry,
    configureServer(server) {
      const roots: PathRoots = { codeRoot: CODE_ROOT, cwd: process.cwd() };
      server.middlewares.use('/__sb-devtools', (req, res, next) => {
        void routeDevtoolsRequest(req, res, next, options, roots);
      });
    },
  };
}

/**
 * The spike's whole "backend": POST /__sb-devtools/capture runs the
 * parse → serialize → write pipeline; GET /__sb-devtools/storybook-probe
 * answers whether the embed-host Storybook dev server is reachable and has
 * indexed a story id (probed server-side so the browser never fights CORS).
 */
async function routeDevtoolsRequest(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
  options: DevtoolsSpikePluginOptions,
  roots: PathRoots
): Promise<void> {
  if (req.method === 'POST' && req.url?.startsWith('/capture')) {
    await captureRoute(req, res, options, roots);
    return;
  }
  if (req.method === 'GET' && req.url?.startsWith('/storybook-probe')) {
    await probeRoute(res, req.url, options.storybookUrl ?? DEFAULT_EMBED_STORYBOOK_URL);
    return;
  }
  next();
}

function respondJson(res: ServerResponse, status: number, body: CaptureResponse): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

async function captureRoute(
  req: IncomingMessage,
  res: ServerResponse,
  options: DevtoolsSpikePluginOptions,
  roots: PathRoots
): Promise<void> {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  try {
    const result = await handleCapture(body, { storiesGlob: options.storiesGlob, roots });
    respondJson(res, 200, result);
  } catch (error) {
    if (error instanceof CaptureRequestError) {
      respondJson(res, error.kind === 'write_failed' ? 500 : 400, {
        error: error.kind,
        message: error.message,
        filePath: error.filePath,
      });
    } else {
      respondJson(res, 500, {
        error: 'write_failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface StorybookProbe {
  reachable: boolean;
  indexed: boolean;
}

/**
 * Server-side probe of the embed host: reachable = the Storybook dev server
 * answers; indexed = its /index.json already lists the story id (Storybook's
 * HMR picked the generated file up). Always answers 200 — the client decides
 * what to render.
 */
async function probeRoute(res: ServerResponse, url: string, storybookUrl: string): Promise<void> {
  const storyId = new URL(url, 'http://localhost').searchParams.get('storyId') ?? '';
  try {
    const response = await fetch(`${storybookUrl}/index.json`);
    if (!response.ok) {
      respondJson(res, 200, { reachable: true, indexed: false } satisfies StorybookProbe);
      return;
    }
    const index: unknown = await response.json();
    const entries = isRecord(index) && isRecord(index.entries) ? index.entries : {};
    respondJson(res, 200, {
      reachable: true,
      indexed: storyId.length > 0 && storyId in entries,
    } satisfies StorybookProbe);
  } catch {
    respondJson(res, 200, { reachable: false, indexed: false } satisfies StorybookProbe);
  }
}
