import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

const VIRTUAL_CLIENT_ID = 'virtual:sb-devtools-client';

/**
 * Resolved to the real client entry file so Vite's regular pipeline (esbuild
 * TS transform, HMR) loads it — the vite-inject-mocker pattern.
 */
const CLIENT_ENTRY_PATH = fileURLToPath(new URL('../client/entry.ts', import.meta.url));

const CLIENT_SCRIPT_TAG = `<script type="module" src="/@id/${VIRTUAL_CLIENT_ID}"></script>`;

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

/**
 * Devtools spike Vite plugin — dev-only client injection. The capture
 * middleware registers under /__sb-devtools/capture in serve mode only.
 */
export function devtoolsSpikePlugin(): Plugin {
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
      // Stage-0 stub. The real middleware (parse CapturePayload → serialize →
      // csf-tools story write → respond { storyId, flagged }) lands in the
      // follow-up task. Client code must see an explicit marker, not a 404.
      server.middlewares.use('/__sb-devtools/capture', (_req, res) => {
        res.statusCode = 501;
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            error: 'not_implemented',
            message: 'capture middleware arrives with the story-generation task',
          })
        );
      });
    },
  };
}
