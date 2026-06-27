import type { PreviewWarmupTargets } from 'storybook/internal/types';

import { isAbsolute, join, normalize, relative } from 'pathe';
import type { ViteDevServer } from 'vite';

import { SB_VIRTUAL_FILES } from './virtual-file-names.ts';

/** URL form of the preview entry, matching the rewrite in `transformIframeHtml`. */
const VIRTUAL_APP_URL = `/@id/__x00__${SB_VIRTUAL_FILES.VIRTUAL_APP_FILE}`;

/** Translate an index `importPath` (relative to the working dir) into a Vite-resolvable dev URL. */
function toWarmupUrl(importPath: string): string {
  const absolutePath = isAbsolute(importPath)
    ? normalize(importPath)
    : normalize(join(process.cwd(), importPath));
  const relativePath = relative(process.cwd(), absolutePath);
  // Files outside the Vite root (cwd) must use the `/@fs/` absolute form.
  return relativePath.startsWith('..') ? `/@fs${absolutePath}` : `/${relativePath}`;
}

/**
 * Pre-transforms the preview entry graph and the first story so they are cached before the browser
 * requests them. This overlaps preview compilation with the otherwise-serial latency of opening the
 * browser and booting the manager UI.
 *
 * Best-effort and non-blocking: `warmupRequest` never throws, and we deliberately do not await this
 * in `start()`.
 */
export async function warmupPreview(
  server: ViteDevServer,
  warmupTargets: Promise<PreviewWarmupTargets | undefined> | undefined
): Promise<void> {
  // `server.warmupRequest` moved to `environment.warmupRequest` in Vite 6+ (deprecated on the
  // server in v8); prefer the per-environment API when available.
  const warmupRequest = (url: string): Promise<void> =>
    (server.environments?.client ?? server).warmupRequest(url);

  // Warm the preview entry chain. With Vite's `preTransformRequests` (on by default), this crawls
  // the static import graph: preview-api, framework runtime, the user's preview.ts, etc.
  void warmupRequest(VIRTUAL_APP_URL);

  // Warm the first entry's modules. These are dynamic imports (via `importFn`), so Vite can't
  // discover them by crawling — they must be requested explicitly.
  const targets = await warmupTargets;
  if (!targets) {
    return;
  }
  for (const importPath of targets.importPaths) {
    void warmupRequest(toWarmupUrl(importPath));
  }
}
