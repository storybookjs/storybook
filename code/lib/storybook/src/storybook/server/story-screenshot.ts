import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import {
  CONFIG_ERROR,
  PLAY_FUNCTION_THREW_EXCEPTION,
  STORY_ERRORED,
  STORY_FINISHED,
  STORY_MISSING,
  STORY_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
} from '@storybook/core/internal/core-events';
import { StoryScreenshotBrowserUnavailableError } from '@storybook/core/internal/server-errors';
import type {
  StoryRenderAccess,
  StoryRenderStatus,
  StoryScreenshotRequest,
  StoryScreenshotResult,
} from '@storybook/core/internal/services';
import type { Storybook } from '@storybook/core';

import { join } from 'pathe';

import type { InProcessRequest, InProcessResponse } from './in-process-transport.ts';
import { type PreviewHost, type PreviewTransport, startPreviewHost } from './preview-host.ts';

export type StoryScreenshotAccess = StoryRenderAccess & { close(): Promise<void> };

export type StoryScreenshotAccessOptions = {
  /** How the browser reaches the self-hosted preview; ignored when a request names an origin. */
  transport?: PreviewTransport;
};

type Dispatch = (request: InProcessRequest) => Promise<InProcessResponse>;

type BrowserRoute = {
  request(): {
    method(): string;
    url(): string;
    headers(): Record<string, string>;
    postDataBuffer(): Buffer | null;
  };
  fulfill(response: InProcessResponse): Promise<void>;
  abort(): Promise<void>;
};

type BrowserPage = {
  route(url: (url: URL) => boolean, handler: (route: BrowserRoute) => Promise<void>): Promise<void>;
  routeWebSocket(url: (url: URL) => boolean, handler: () => void): Promise<void>;
  on(event: 'console', listener: (message: { type(): string; text(): string }) => void): void;
  on(event: 'pageerror', listener: (error: Error) => void): void;
  addInitScript(script: { content: string }): Promise<void>;
  goto(url: string, options: { timeout: number; waitUntil: 'load' }): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
  locator(selector: string): {
    boundingBox(): Promise<{ width: number; height: number } | null>;
    screenshot(options: { path: string; timeout: number }): Promise<unknown>;
  };
  screenshot(options: { path: string; timeout: number }): Promise<unknown>;
  close(): Promise<void>;
};

type Browser = {
  newPage(options: { viewport: { width: number; height: number } }): Promise<BrowserPage>;
  close(): Promise<void>;
};

type BrowserLauncher = { launch(options: { headless: boolean }): Promise<Browser> };

type RecordedEvent = { name: string; message?: string; status?: string };

const EVENTS_GLOBAL = '__STORYBOOK_SCREENSHOT_EVENTS__';
const RECORDED_EVENTS = [
  STORY_FINISHED,
  STORY_MISSING,
  STORY_ERRORED,
  STORY_THREW_EXCEPTION,
  PLAY_FUNCTION_THREW_EXCEPTION,
  UNHANDLED_ERRORS_WHILE_PLAYING,
  CONFIG_ERROR,
];
// Plain source rather than a function, so bundler helpers never leak into the page. It runs
// before any preview code and subscribes as soon as the preview installs its channel.
const RECORD_CHANNEL_EVENTS = `(() => {
  const recorded = [];
  const describe = (payload) =>
    Array.isArray(payload) ? payload.map(describe).join('\\n')
    : typeof payload === 'string' ? payload
    : payload?.message ?? [payload?.title, payload?.description].filter(Boolean).join(': ');
  let channel;
  window.${EVENTS_GLOBAL} = recorded;
  Object.defineProperty(window, '__STORYBOOK_ADDONS_CHANNEL__', {
    configurable: true,
    get: () => channel,
    set(next) {
      if (next && next !== channel) {
        for (const name of ${JSON.stringify(RECORDED_EVENTS)}) {
          next.on?.(name, (payload) => recorded.push(
            name === '${STORY_FINISHED}' ? { name, status: payload?.status }
            : name === '${STORY_MISSING}' ? { name, message: 'Story "' + payload + '" is missing from the index.' }
            : { name, message: describe(payload) }
          ));
        }
      }
      channel = next;
    },
  });
})();`;
// In-process measured ~25% slower per warm screenshot: every response body crosses the DevTools protocol.
const DEFAULT_TRANSPORT: PreviewTransport = 'port';
// A render exception before the story starts never reports `storyFinished`.
const ERROR_SETTLE_MS = 500;
const POLL_MS = 50;

/** Screenshot stories with a lazily launched Chromium against the given origin or a preview host. */
export function createStoryScreenshotAccess(
  storybook: Storybook,
  { transport = DEFAULT_TRANSPORT }: StoryScreenshotAccessOptions = {}
): StoryScreenshotAccess {
  let previewHost: Promise<PreviewHost> | undefined;
  let browser: Promise<Browser> | undefined;

  const getTarget = async (
    origin: string | undefined
  ): Promise<{ origin: string; dispatch?: Dispatch }> => {
    if (origin) {
      return { origin: origin.endsWith('/') ? origin : `${origin}/` };
    }
    previewHost ??= startPreviewHost(storybook, { transport }).catch((error: unknown) => {
      previewHost = undefined;
      throw error;
    });
    return previewHost;
  };

  return {
    async screenshot(request, { signal } = {}) {
      signal?.throwIfAborted();
      browser ??= launchBrowser(storybook.configDir).catch((error: unknown) => {
        browser = undefined;
        throw error;
      });
      const [target, launched] = await Promise.all([getTarget(request.origin), browser]);
      return capture(launched, target, request, signal);
    },
    async close() {
      const hosts = [browser, previewHost];
      browser = undefined;
      previewHost = undefined;
      await Promise.allSettled(hosts.map(async (host) => (await host)?.close()));
    },
  };
}

async function capture(
  browser: Browser,
  { origin, dispatch }: { origin: string; dispatch?: Dispatch },
  request: StoryScreenshotRequest,
  signal: AbortSignal | undefined
): Promise<StoryScreenshotResult> {
  const url = new URL(request.iframePath, origin).href;
  signal?.throwIfAborted();
  const page = await browser.newPage({ viewport: request.viewport });
  // Closing the page makes whatever it is awaiting reject, so the catch below sees the abort.
  const onAbort = (): void => void page.close().catch(() => undefined);
  signal?.addEventListener('abort', onAbort, { once: true });
  const errors = new Set<string>();
  // First lines only: stacks point into the preview bundle, not at anything an agent can edit.
  const addError = (text: string): void => {
    errors.add(text.split('\n')[0]);
  };
  page.on('console', (message) => {
    if (message.type() === 'error') {
      addError(message.text());
    }
  });
  page.on('pageerror', (error) => addError(error.message));

  try {
    signal?.throwIfAborted();
    if (dispatch) {
      await routeToDispatch(page, new URL(origin).hostname, dispatch);
    }
    await page.addInitScript({ content: RECORD_CHANNEL_EVENTS });
    const deadline = Date.now() + request.timeoutMs;
    await page.goto(url, { timeout: request.timeoutMs, waitUntil: 'load' });
    const { status, error } = await waitForRender(page, deadline);

    const root = page.locator('#storybook-root');
    const box = status === 'errored' ? null : await root.boundingBox();
    const target = box && box.width > 0 && box.height > 0 ? root : page;
    await target.screenshot({ path: request.path, timeout: request.timeoutMs });

    return {
      status,
      path: request.path,
      ...(error ? { error } : {}),
      consoleErrors: [...errors],
    };
  } catch (error) {
    signal?.throwIfAborted();
    return {
      status: error instanceof Error && error.name === 'TimeoutError' ? 'timeout' : 'errored',
      error: error instanceof Error ? error.message : String(error),
      consoleErrors: [...errors],
    };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await page.close().catch(() => undefined);
  }
}

/** Answer every request to `hostname` in-process; other hosts still reach the network. */
async function routeToDispatch(
  page: BrowserPage,
  hostname: string,
  dispatch: Dispatch
): Promise<void> {
  // Hostname, not origin: the HMR and channel sockets use their own scheme and port.
  const matches = (url: URL): boolean => url.hostname === hostname;
  await page.route(matches, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    try {
      const response = await dispatch({
        method: request.method(),
        url: url.pathname + url.search,
        // The synthetic host would fail the builder's host allow-list.
        headers: { ...request.headers(), host: 'localhost' },
        body: request.postDataBuffer() ?? undefined,
      });
      await route.fulfill(response);
    } catch {
      await route.abort().catch(() => undefined);
    }
  });
  // A silent mock keeps the HMR and channel clients connected instead of logging connection errors.
  await page.routeWebSocket(matches, () => undefined);
}

async function waitForRender(
  page: BrowserPage,
  deadline: number
): Promise<{ status: StoryRenderStatus; error?: string }> {
  let firstErrorAt: number | undefined;
  while (Date.now() < deadline) {
    const events = ((await page.evaluate(`window.${EVENTS_GLOBAL}`)) ?? []) as RecordedEvent[];
    const finished = events.some(
      (event) => event.name === STORY_FINISHED || event.name === STORY_MISSING
    );
    const errors = events.filter((event) => event.name !== STORY_FINISHED);
    firstErrorAt ??= errors.length > 0 ? Date.now() : undefined;
    if (finished || (firstErrorAt && Date.now() - firstErrorAt >= ERROR_SETTLE_MS)) {
      return statusFrom(events);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return { status: 'timeout', error: 'The story did not finish rendering before the timeout.' };
}

function statusFrom(events: RecordedEvent[]): { status: StoryRenderStatus; error?: string } {
  const message = (name: string): string | undefined =>
    events.find((event) => event.name === name)?.message;
  const playError = message(PLAY_FUNCTION_THREW_EXCEPTION);
  if (playError !== undefined) {
    return { status: 'play-failed', error: playError };
  }
  const error =
    message(STORY_THREW_EXCEPTION) ??
    message(STORY_ERRORED) ??
    message(CONFIG_ERROR) ??
    message(UNHANDLED_ERRORS_WHILE_PLAYING) ??
    message(STORY_MISSING);
  if (error !== undefined) {
    return { status: 'errored', error };
  }
  const failed = events.some((event) => event.name === STORY_FINISHED && event.status === 'error');
  return failed
    ? { status: 'errored', error: 'The story finished with errors.' }
    : { status: 'rendered' };
}

async function launchBrowser(configDir: string): Promise<Browser> {
  const launcher = await importChromium(configDir);
  try {
    return await launcher.launch({ headless: true });
  } catch (error) {
    throw new StoryScreenshotBrowserUnavailableError({
      reason: `Chromium failed to launch (${error instanceof Error ? error.message.split('\n')[0] : String(error)}).`,
    });
  }
}

async function importChromium(configDir: string): Promise<BrowserLauncher> {
  const resolvers = [
    createRequire(join(configDir, 'package.json')),
    createRequire(import.meta.url),
  ];
  for (const name of ['playwright-core', 'playwright']) {
    for (const resolver of resolvers) {
      let resolved: string;
      try {
        resolved = resolver.resolve(name);
      } catch {
        continue;
      }
      const loaded = (await import(pathToFileURL(resolved).href)) as {
        chromium?: BrowserLauncher;
        default?: { chromium?: BrowserLauncher };
      };
      const chromium = loaded.chromium ?? loaded.default?.chromium;
      if (chromium) {
        return chromium;
      }
    }
  }
  throw new StoryScreenshotBrowserUnavailableError({
    reason: 'neither `playwright-core` nor `playwright` is installed.',
  });
}
