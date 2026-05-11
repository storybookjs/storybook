import type { Channel } from 'storybook/internal/channels';

import type { Plugin, ViteDevServer } from 'vite';

export const ENV_MARKER = 'env=before';

/**
 * Storybook-internal endpoints whose responses are NOT served by Vite's module
 * pipeline. Skipped by `rewriteHtmlUrls` so the marker is never appended to
 * URLs that bypass Vite's plugin container.
 */
const BYPASS_PREFIXES = [
  '/index.json',
  '/storybook-server-channel',
  '/runtime-error',
  '/sb-',
  // Vite / Vitest / builder-vite boot-time virtual modules. Owned by plugins
  // registered in the `client` environment (e.g. `@vitejs/plugin-react`,
  // vitest mocker, builder-vite's `vite-app` virtual). Serving these via
  // the marker'd module graph 500s. They are boot scaffolding, not user code.
  '/@react-refresh',
  '/@vite/',
  '/vite-inject-mocker-entry.js',
];

function isBypassedUrl(url: string): boolean {
  return BYPASS_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function shouldRewriteSpecifier(spec: string): boolean {
  if (
    spec.startsWith('#') ||
    spec.startsWith('data:') ||
    spec.startsWith('blob:') ||
    spec.startsWith('http://') ||
    spec.startsWith('https://') ||
    spec.startsWith('//')
  ) {
    return false;
  }
  const pathPart = spec.split('?')[0];
  if (isBypassedUrl(pathPart)) return false;
  if (spec.includes(ENV_MARKER)) return false;
  return true;
}

function appendMarker(spec: string): string {
  const sep = spec.includes('?') ? '&' : '?';
  return `${spec}${sep}${ENV_MARKER}`;
}

function rewriteHtmlUrls(html: string): string {
  // (1) Rewrite src= and href= attributes for script/link/img tags.
  let out = html.replace(
    /(<(?:script|link|img)\b[^>]*\s(?:src|href)=)(["'])([^"']+)\2/gi,
    (full, prefix: string, quote: string, attrUrl: string) => {
      if (!shouldRewriteSpecifier(attrUrl)) return full;
      return `${prefix}${quote}${appendMarker(attrUrl)}${quote}`;
    }
  );

  // (2) Rewrite import specifiers inside inline `<script type="module">`
  // blocks. Vite's React plugin injects a `@react-refresh` preamble as an
  // inline module script (no `src=`) which path (1) cannot reach.
  out = out.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs: string, body: string) => {
      if (!/\btype\s*=\s*["']module["']/i.test(attrs)) return full;
      if (/\bsrc\s*=\s*["'][^"']*["']/i.test(attrs)) return full;
      if (!body.trim()) return full;
      const rewritten = body.replace(
        /(\bfrom\s+|\bimport\s+|\bimport\s*\(\s*)(["'])([^"']+)\2/g,
        (m, lead: string, quote: string, spec: string) => {
          if (!shouldRewriteSpecifier(spec)) return m;
          return `${lead}${quote}${appendMarker(spec)}${quote}`;
        }
      );
      return `<script${attrs}>${rewritten}</script>`;
    }
  );

  return out;
}

// Observability beacon (NOT a behavior shim). Fires a single console.warn if
// the iframe loaded WITHOUT `env=before` on its own URL — a precondition for
// the marker propagation chain to work for descendants.
const DIAGNOSTIC_SCRIPT = `<script>(function(){try{var ok=/env=before/.test(location.search);if(!ok){console.warn('[storybook/before-after] Before-iframe loaded without env=before marker on its own URL. Before-iframe content may be stale (working-tree, not HEAD).');}}catch(e){}})();</script>`;

function injectDiagnosticBeacon(html: string): string {
  if (html.includes('[storybook/before-after]')) return html;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${DIAGNOSTIC_SCRIPT}</head>`);
  }
  return DIAGNOSTIC_SCRIPT + html;
}

export interface BeforeEnvironmentPluginOptions {
  channel?: Pick<Channel, 'emit'> | null;
  /**
   * Repository root (filesystem absolute path). Used by `resolveId` to decide
   * whether a resolved id should route through the before environment. Project
   * files (under `repoRoot`) and virtual modules are marked; `node_modules`
   * and Vite-internal URLs are NOT marked so they fall through to the client
   * environment's optimized-deps cache.
   */
  repoRoot?: string;
  /** Called from `configureServer` with the resolved dev server. */
  onServerReady?: (server: ViteDevServer) => void;
}

/**
 * Decide whether a resolved id should route through the before environment
 * (i.e. carry the `?env=before` marker on its URL).
 */
export function shouldRouteThroughBeforeEnv(id: string, repoRoot: string | undefined): boolean {
  if (id.includes(ENV_MARKER)) return false;
  if (id.startsWith('\0')) return true;
  const path = id.split('?')[0];
  if (path.startsWith('/@vite/')) return false;
  if (path === '/@react-refresh') return false;
  if (path.includes('/node_modules/')) return false;
  if (repoRoot && path.startsWith(repoRoot)) return true;
  return false;
}

function stripMarkerFromSpec(spec: string): string {
  return spec
    .replace(/([?&])env=before(&|$)/, (_, lead: string, tail: string) => (tail === '&' ? lead : ''))
    .replace(/\?$/, '');
}

function attachMarkerToId(id: string): string {
  if (id.includes(ENV_MARKER)) return id;
  const sep = id.includes('?') ? '&' : '?';
  return `${id}${sep}${ENV_MARKER}`;
}

/**
 * Vite plugin that propagates the `?env=before` marker from importer to
 * resolved id (project files / virtual modules only), rewrites entry
 * script URLs in the before-iframe HTML, and isolates marker-bearing
 * modules from working-tree HMR. See ADR-0003 for the design.
 */
export function beforeEnvironmentPlugin(options: BeforeEnvironmentPluginOptions = {}): Plugin {
  const channel = options.channel ?? null;
  const repoRoot = options.repoRoot;
  const onServerReady = options.onServerReady;

  const emitError = (source: string, error: unknown) => {
    if (!channel) return;
    try {
      channel.emit('storybook/before-after/server-error', {
        type: 'before-error',
        source,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } catch {
      // channel emit must not break the resolve pipeline
    }
  };

  return {
    name: 'storybook:before-environment',
    enforce: 'pre',

    configureServer(server) {
      onServerReady?.(server);
    },

    transformIndexHtml: {
      // `post` so we run AFTER Vite's built-in plugins inject the
      // react-refresh preamble, the mocker entry, and the `@vite/client`
      // script — we need to rewrite URLs inside ALL of them.
      order: 'post',
      // DO NOT REMOVE — load-bearing for entry-script marker.
      // The bare `<script src="virtual:/@storybook/builder-vite/vite-app.js">`
      // at builders/builder-vite/input/iframe.html has no `?env=before`
      // baked in; this hook is the sole place that adds it.
      handler(html, ctx) {
        // Builder-vite's `iframeHandler` passes the original request URL
        // (with `?env=before`) as the 3rd arg of `server.transformIndexHtml`,
        // surfaced here via `ctx.originalUrl`. `path`/`filename` are fallbacks
        // for programmatic invocations / builds.
        const ctxAny = ctx as { originalUrl?: string; path?: string; filename?: string };
        const candidates = [ctxAny.originalUrl, ctxAny.path, ctxAny.filename];
        const matched = candidates.some((s) => typeof s === 'string' && s.includes(ENV_MARKER));
        if (!matched) return;
        return injectDiagnosticBeacon(rewriteHtmlUrls(html));
      },
    },

    /**
     * Marker propagation runs ENTIRELY through this hook. Every spec resolved
     * within the before environment gets its resolved id tagged with
     * `?env=before` (when appropriate), and Vite's built-in
     * `vite:import-analysis` rewrites the import to the marked URL.
     *
     * Source-level rewriting is NOT used because Vite's bare-spec resolver
     * does not strip query strings before matching `exports` maps, so
     * `import 'storybook/theming/create?env=before'` would fail resolution.
     *
     * The addon's `preset.ts` prepends this plugin to `config.plugins` so we
     * run before builder-vite's `code-generator-plugin` and
     * `storybook-project-annotations-plugin` — we delegate via
     * `this.resolve({ skipSelf: true })` and need to observe their virtual-
     * module resolutions to post-process the resolved id with the marker.
     */
    async resolveId(source, importer) {
      const sourceHasMarker = source.includes(ENV_MARKER);
      const importerHasMarker = !!importer && importer.includes(ENV_MARKER);
      if (!sourceHasMarker && !importerHasMarker) return null;
      const cleanSource = stripMarkerFromSpec(source);
      const cleanImporter = importer ? stripMarkerFromSpec(importer) : undefined;
      let resolved: { id: string } | null | undefined;
      try {
        resolved = await (
          this as {
            resolve: (
              s: string,
              i?: string,
              o?: object
            ) => Promise<{ id: string } | null | undefined>;
          }
        ).resolve(cleanSource, cleanImporter, { skipSelf: true });
      } catch (err) {
        emitError('resolveId', err);
        return null;
      }
      if (!resolved) return null;
      if (!shouldRouteThroughBeforeEnv(resolved.id, repoRoot)) {
        return resolved;
      }
      return { ...resolved, id: attachMarkerToId(resolved.id) };
    },

    handleHotUpdate(ctx) {
      // Marker-bearing module ids serve HEAD content; working-tree file
      // changes must never invalidate them. Working-tree changes still
      // propagate to the unmarked module entries (Vite's default behavior).
      return ctx.modules.filter((m) => !(m.id && m.id.includes(ENV_MARKER)));
    },
  };
}

/**
 * Invalidate every marker-bearing module in the dev server's client
 * moduleGraph. Called by the addon's preset on `HEAD_CHANGED` events.
 */
export function invalidateBeforeEnvironment(server: ViteDevServer): void {
  const clientEnv = server.environments?.client as
    | {
        moduleGraph: {
          idToModuleMap: Map<string, { id?: string }>;
          invalidateModule: (m: unknown) => void;
        };
      }
    | undefined;
  if (!clientEnv) return;
  for (const mod of clientEnv.moduleGraph.idToModuleMap.values()) {
    if (mod.id && mod.id.includes(ENV_MARKER)) {
      clientEnv.moduleGraph.invalidateModule(mod);
    }
  }
}
