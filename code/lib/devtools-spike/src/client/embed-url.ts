/**
 * Embed navigation for the panel's preview iframe.
 *
 * The URL contract is client-enforced by preview-web: the selected story
 * lives in the query params (`?id=<storyId>&viewMode=story`), not on the
 * server — see code/core/src/preview-api/modules/preview-web/UrlStore.ts
 * (`pathToSelectedElement` parses the initial selection from `query.params`)
 * — and `embed=true` puts the iframe runtime into embedded mode, see
 * code/core/src/preview-api/modules/preview-web/embedMode.ts:2
 * (`isRequestToEmbedMode` checks `parameters.get('embed')`). The iframe
 * document itself is served by builder-vite at /iframe.html
 * (code/builders/builder-vite/src/index.ts:73).
 */

/** Command that starts the embed-host Storybook dev server (strategy A). */
export const STORYBOOK_START_COMMAND =
  'node code/core/dist/bin/dispatcher.js dev --port 6006 --config-dir code/lib/devtools-spike/.storybook';

/** Where the embed-host Storybook dev server listens by default. */
export const DEFAULT_EMBED_STORYBOOK_URL = 'http://localhost:6006';

/**
 * The iframe URL for one story: ?id=&viewMode=story&embed=true per the
 * preview-web contract cited above. The base may carry a trailing slash.
 */
export function embedUrl(storybookBaseUrl: string, storyId: string): string {
  const base = storybookBaseUrl.replace(/\/+$/, '');
  return `${base}/iframe.html?id=${encodeURIComponent(storyId)}&viewMode=story&embed=true`;
}

export interface StorybookProbeResult {
  reachable: boolean;
  indexed: boolean;
}

export type EmbedProbeOutcome = 'indexed' | 'unreachable' | 'timeout';

/**
 * Asks the demo app's own dev-server middleware about the embed host —
 * same-origin, so the browser never makes a cross-origin request to
 * Storybook (the middleware proxies the index check server-side).
 */
export function probeStorybook(storyId: string): Promise<StorybookProbeResult> {
  return fetch(`/__sb-devtools/storybook-probe?storyId=${encodeURIComponent(storyId)}`).then(
    (response) => response.json() as Promise<StorybookProbeResult>
  );
}

/**
 * Polls until the embed host has indexed the generated story (Storybook's
 * HMR picks the file up within ~1s). 'unreachable' means the Storybook
 * server is down — the panel shows the banner; 'timeout' still lets the
 * panel navigate the iframe, which shows the real state.
 */
export async function waitForStoryIndexed(
  probe: () => Promise<StorybookProbeResult>,
  { timeoutMs = 10000, intervalMs = 500 }: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<EmbedProbeOutcome> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let result: StorybookProbeResult;
    try {
      result = await probe();
    } catch {
      return 'unreachable';
    }
    if (!result.reachable) {
      return 'unreachable';
    }
    if (result.indexed) {
      return 'indexed';
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return 'timeout';
}
