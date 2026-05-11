import { AsyncLocalStorage } from 'node:async_hooks';

import type { Channel } from 'storybook/internal/channels';

import MagicString from 'magic-string';
import type { Span, ValueSpan } from 'oxc-parser';
import { parseSync } from 'oxc-parser';
import type { Plugin, ViteDevServer } from 'vite';

import { notifyEnvApiServerReady, resetServerReadyHookForServer } from './server-ready-hook.ts';

// Vite restricts environment names to alphanumeric chars plus `$` and `_`, so
// we use a camelCase identifier internally. The on-the-wire query marker stays
// `env=before` because that is our own routing token, not a Vite env name.
export const BEFORE_ENV_NAME = 'storybookBefore';
export const ENV_MARKER = 'env=before';

interface AlsStore {
  scope: 'before-after';
  /**
   * Set when the dispatch middleware is about to call `next()` for a
   * `/iframe.html?env=before` request. Builder-vite's `iframeHandler` then
   * calls `server.transformIndexHtml('/iframe.html', html)` with a
   * hardcoded path that does NOT carry the marker — so our
   * `transformIndexHtml` hook cannot detect the before-iframe context via
   * `ctx.originalUrl`/`ctx.path`/`ctx.filename`. Stashing it here and
   * reading via `als.getStore()` in the hook bridges the gap without
   * touching `code/builders/builder-vite/`.
   */
  beforeIframe?: boolean;
}

const als = new AsyncLocalStorage<AlsStore>();

// Active channels are tracked as a Set so that multiple plugin instances (e.g.
// across `server.restart()` or in test runs spinning up several dev servers)
// can each register and de-register their channel without trampling each other.
const activeChannels = new Set<Pick<Channel, 'emit'>>();

// The unhandledRejection listener is installed lazily once per process. We
// keep a reference so it can be removed when the last plugin instance unwinds.
let unhandledListener: ((reason: unknown) => void) | null = null;

function emitStructuredError(source: string, error: unknown): void {
  if (activeChannels.size === 0) return;
  const payload = {
    type: 'before-error',
    source,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  for (const ch of activeChannels) {
    try {
      ch.emit('storybook/before-after/server-error', payload);
    } catch {
      // a single failing channel must not block others
    }
  }
}

function ensureUnhandledRejectionListener(): void {
  if (unhandledListener) return;
  unhandledListener = (reason: unknown) => {
    const store = als.getStore();
    if (store?.scope !== 'before-after') return;
    emitStructuredError('unhandledRejection', reason);
  };
  process.on('unhandledRejection', unhandledListener);
}

function detachChannel(channel: Pick<Channel, 'emit'>): void {
  activeChannels.delete(channel);
  if (activeChannels.size === 0 && unhandledListener) {
    process.off('unhandledRejection', unhandledListener);
    unhandledListener = null;
  }
}

/**
 * Compute the rewritten module specifier with the before-env marker.
 * Idempotent: if the marker is already present, returns the original specifier.
 */
export function appendEnvBefore(specifier: string): string {
  if (specifier.includes(ENV_MARKER)) return specifier;
  // Bare-directory specifiers (`.` / `..`) need a trailing slash before
  // the query — `./?env=before` resolves via Vite's directory-index
  // lookup, whereas `.?env=before` is parsed as a filename `.` with a
  // query and fails resolution.
  const [bare, ...queryParts] = specifier.split('?');
  const query = queryParts.join('?');
  const normalised = bare === '.' || bare === '..' ? `${bare}/` : bare;
  const sep = query ? '&' : '?';
  return `${normalised}${query ? `?${query}` : ''}${sep}${ENV_MARKER}`;
}

/**
 * Storybook-internal endpoints whose responses are NOT served by Vite's module
 * pipeline. The before-iframe dispatch middleware never routes these through
 * `beforeEnv.transformRequest`, regardless of `?env=before` marker or Referer.
 *
 * Adding to this list MUST be accompanied by a new `(k.3.*)` probe in
 * `before-env-routing.test.ts`. The `/sb-` entry is intentionally a wildcard
 * prefix capturing all Storybook-internal asset routes; reducing its
 * specificity requires a coordinated change. See ADR-0002 and the README.
 */
export const BYPASS_PREFIXES = [
  '/index.json',
  '/storybook-server-channel',
  '/runtime-error',
  '/sb-',
  // Vite / Vitest / builder-vite boot-time virtual modules. These are
  // owned by plugins registered in the `client` environment configuration
  // (e.g. `@vitejs/plugin-react`, vitest mocker, builder-vite's `vite-app`
  // virtual). The `storybookBefore` environment intentionally does not
  // duplicate that plugin set, so routing these URLs through
  // `beforeEnv.transformRequest` 500s. They are boot scaffolding, not
  // user code — serving them from the `client` env is correct.
  '/@react-refresh',
  '/@vite/',
  '/vite-inject-mocker-entry.js',
];

export function isBypassedUrl(url: string): boolean {
  return BYPASS_PREFIXES.some((prefix) => url.startsWith(prefix));
}

/**
 * Decide whether a request's `Referer` header proves it originated from the
 * before-iframe. Used by the dispatch middleware to route marker-less child
 * requests (e.g. `node_modules` deps resolved by `vite:import-analysis`,
 * optimized-deps URLs rewritten by `vite:optimized-deps`) into the before
 * environment.
 *
 * Requirements (all must hold):
 *   1. `referer` is a parseable URL
 *   2. `referer.host === host` (same-origin — prevents a stale before-iframe
 *      in another tab from poisoning a sibling preview's requests)
 *   3. `referer.pathname` ends in `/iframe.html`
 *   4. `referer.searchParams.get('env') === 'before'`
 *
 * Returns `false` on any parse failure or missing condition. The dispatch
 * middleware treats `false` as "no upgrade" — the request flows through to
 * the next middleware unchanged.
 */
export function isBeforeIframeReferer(
  referer: string | undefined,
  host: string | undefined
): boolean {
  if (typeof referer !== 'string' || typeof host !== 'string') return false;
  try {
    const parsed = new URL(referer);
    return (
      parsed.host === host &&
      parsed.pathname.endsWith('/iframe.html') &&
      parsed.searchParams.get('env') === 'before'
    );
  } catch {
    return false;
  }
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
  // Only rewrite absolute paths (`/foo`) or bare specifiers Vite resolves
  // via its module pipeline. Skip storybook runtime / API endpoints and
  // anything that already carries the marker.
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
  // inline module script (no `src=`) which path (1) cannot reach. We
  // rewrite `import x from "..."`, `import "..."`, and dynamic `import(...)`
  // literals whose specifier looks like an absolute path. Bare-specifier
  // imports inside inline scripts are left alone; Vite's transform pipeline
  // does not run on inline scripts so we cannot resolve them anyway.
  out = out.replace(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
    (full, attrs: string, body: string) => {
      // Skip non-module scripts and external scripts (src= handled above).
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

// Observability beacon (NOT a behavior shim). Injected into the before-iframe
// HTML by `transformIndexHtml`. Fires a single console.warn if the iframe
// loaded WITHOUT `env=before` on its own URL — a precondition for Referer-
// based env dispatch to work for descendants. Does NOT patch fetch, install
// MutationObservers, or rewrite URLs; the principle "no runtime URL
// synthesis in iframe" stays intact.
const DIAGNOSTIC_SCRIPT = `<script>(function(){try{var ok=/env=before/.test(location.search);if(!ok){console.warn('[storybook/before-after] Before-iframe loaded without env=before marker on its own URL. Referer-based env dispatch may not fire for child requests if your Referrer-Policy is restrictive. Before-iframe content may be stale (working-tree, not HEAD).');}}catch(e){}})();</script>`;

function injectDiagnosticBeacon(html: string): string {
  // Idempotent — skip if the beacon was already injected (e.g. by an
  // earlier transformIndexHtml hook pass for the same response).
  if (html.includes('[storybook/before-after]')) return html;
  // Append before </head>; if not present, prepend to the document so the
  // beacon still fires before any descendant request goes out.
  if (html.includes('</head>')) {
    return html.replace('</head>', `${DIAGNOSTIC_SCRIPT}</head>`);
  }
  return DIAGNOSTIC_SCRIPT + html;
}

interface AstNode {
  type: string;
  start?: number;
  end?: number;
  range?: [number, number];
  callee?: AstNode;
  name?: string;
  arguments?: AstNode[];
  value?: unknown;
  meta?: AstNode & { name?: string };
  property?: AstNode & { name?: string };
  object?: AstNode;
  [key: string]: unknown;
}

function walkAst(node: unknown, visit: (n: AstNode) => void): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walkAst(child, visit);
    return;
  }
  const obj = node as AstNode;
  if (typeof obj.type === 'string') visit(obj);
  for (const key of Object.keys(obj)) {
    if (key === 'type' || key === 'start' || key === 'end' || key === 'range' || key === 'loc') {
      continue;
    }
    const child = obj[key];
    if (child && typeof child === 'object') walkAst(child, visit);
  }
}

const STRING_LITERAL_RE = /^(['"])((?:\\.|(?!\1).)*)\1$/;
const TEMPLATE_NO_EXPR_RE = /^`((?:\\.|[^`$])*)`$/;

interface RewriteResult {
  code: string;
  map: ReturnType<MagicString['generateMap']>;
}

/**
 * Rewrite all module specifiers in `code` to carry the `?env=before` marker.
 * Static imports, re-exports, and dynamic imports (literal or non-literal) are
 * handled, plus the `new URL(literal, import.meta.url)` worker pattern.
 *
 * Returns `null` if the source contains no rewritable specifiers.
 */
export function rewriteImports(filename: string, code: string): RewriteResult | null {
  let result;
  try {
    result = parseSync(filename, code, { range: true });
  } catch {
    return null;
  }

  if (result.errors.some((e) => e.severity === 'Error')) {
    // Pass through; let Vite's downstream pipeline produce the error so it surfaces
    // in the same place users would expect.
    return null;
  }

  const ms = new MagicString(code);
  let changed = false;
  let helperInjected = false;

  const rewriteValueSpan = (span: ValueSpan): boolean => {
    const newValue = appendEnvBefore(span.value);
    if (newValue === span.value) return false;
    ms.overwrite(span.start, span.end, JSON.stringify(newValue));
    return true;
  };

  for (const imp of result.module.staticImports ?? []) {
    if (rewriteValueSpan(imp.moduleRequest)) changed = true;
  }

  for (const exp of result.module.staticExports ?? []) {
    for (const entry of exp.entries ?? []) {
      if (entry.moduleRequest && rewriteValueSpan(entry.moduleRequest)) {
        changed = true;
      }
    }
  }

  // Insert the helper AFTER any leading directive prologue (`'use strict'`,
  // `'use client'`, etc.) — directives must remain the first statement of the
  // module to keep React 19 / Next semantics correct. We compute the insertion
  // offset once on demand.
  const computeHelperInsertionOffset = (): number => {
    const directiveMatch = code.match(/^(?:\s*(?:['"][^'"\n]+['"]\s*;?\s*\n))+/);
    return directiveMatch ? directiveMatch[0].length : 0;
  };
  const ensureHelper = () => {
    if (helperInjected) return;
    helperInjected = true;
    const helper = `const __envBeforeJoin = (s) => s + (s.includes('?') ? '&' : '?') + 'env=before';\n`;
    const offset = computeHelperInsertionOffset();
    if (offset === 0) ms.prepend(helper);
    else ms.appendRight(offset, helper);
  };

  for (const dyn of result.module.dynamicImports ?? []) {
    const argSpan: Span = dyn.moduleRequest;
    const slice = code.slice(argSpan.start, argSpan.end);
    const trimmed = slice.trim();

    // For literal arguments, append the marker INSIDE the original quoted form
    // and preserve every escape verbatim. Decoding the literal (via JSON.parse
    // + ad-hoc unescaping) is fragile across quote styles and silently corrupts
    // edge cases like `import('./he said "hi".ts')`. The marker is plain ASCII
    // (`?env=before` / `&env=before`) so direct concatenation is safe.
    const stringMatch = STRING_LITERAL_RE.exec(trimmed);
    if (stringMatch) {
      const quote = stringMatch[1];
      const raw = stringMatch[2];
      if (raw.includes(ENV_MARKER)) continue;
      const sep = raw.includes('?') ? '&' : '?';
      ms.overwrite(argSpan.start, argSpan.end, `${quote}${raw}${sep}${ENV_MARKER}${quote}`);
      changed = true;
      continue;
    }

    const tmplMatch = TEMPLATE_NO_EXPR_RE.exec(trimmed);
    if (tmplMatch) {
      const raw = tmplMatch[1];
      if (raw.includes(ENV_MARKER)) continue;
      const sep = raw.includes('?') ? '&' : '?';
      ms.overwrite(argSpan.start, argSpan.end, '`' + raw + sep + ENV_MARKER + '`');
      changed = true;
      continue;
    }

    ensureHelper();
    ms.overwrite(argSpan.start, argSpan.end, `__envBeforeJoin(${slice})`);
    changed = true;
  }

  // Worker pattern: only walk AST if `import.meta` shows up in the file.
  if ((result.module.importMetas ?? []).length > 0) {
    walkAst(result.program, (node) => {
      if (node.type !== 'NewExpression') return;
      if (node.callee?.type !== 'Identifier' || node.callee?.name !== 'URL') return;
      const args = node.arguments ?? [];
      if (args.length < 2) return;
      const arg0 = args[0];
      const arg1 = args[1];
      if (arg0.type !== 'Literal' || typeof arg0.value !== 'string') return;

      const arg1Start = arg1.start ?? arg1.range?.[0];
      const arg1End = arg1.end ?? arg1.range?.[1];
      if (arg1Start == null || arg1End == null) return;
      // Verify second arg is import.meta.url (or import.meta in general).
      const arg1Source = code.slice(arg1Start, arg1End).replace(/\s+/g, '');
      if (!arg1Source.startsWith('import.meta')) return;

      const litStart = arg0.start ?? arg0.range?.[0];
      const litEnd = arg0.end ?? arg0.range?.[1];
      if (litStart == null || litEnd == null) return;
      const newValue = appendEnvBefore(arg0.value);
      if (newValue === arg0.value) return;
      ms.overwrite(litStart, litEnd, JSON.stringify(newValue));
      changed = true;
    });
  }

  if (!changed) return null;
  return {
    code: ms.toString(),
    map: ms.generateMap({ hires: true, source: filename }),
  };
}

export interface BeforeEnvironmentPluginOptions {
  channel?: Pick<Channel, 'emit'> | null;
  /**
   * Repository root (filesystem absolute path). Used by `resolveId` to decide
   * whether a resolved id should route through the before environment. Project
   * files (under `repoRoot`) and virtual modules are marked; `node_modules`
   * and Vite-internal URLs are NOT marked so they fall through to the client
   * environment's optimized-deps cache.
   *
   * If omitted, every non-virtual, non-`node_modules` resolved id falls back
   * to NOT being marked — addon effectively no-ops for project files.
   */
  repoRoot?: string;
  /** Hook for tests — called after middleware finishes serving each ?env=before request. */
  onMiddlewareDispatch?: (url: string) => void;
}

/**
 * Decide whether a resolved id should route through the before environment
 * (i.e. carry the `?env=before` marker on its URL). The decision is made
 * once at resolve-time and propagates via `vite:import-analysis` rewriting
 * the import to the marked URL.
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
  const localChannel = options.channel ?? null;
  const repoRoot = options.repoRoot;
  if (localChannel) {
    activeChannels.add(localChannel);
    ensureUnhandledRejectionListener();
  }

  return {
    name: 'storybook:before-environment',
    enforce: 'pre',

    // No separate Vite environment is registered. The original design used
    // a `storybookBefore` env so `beforeContentPlugin`'s load hook could be
    // gated via `applyToEnvironment`, but the per-environment isolation
    // caused intractable problems:
    //   - per-env `optimizeDeps` returned raw CJS files for `react`, with
    //     `vite:import-analysis` not applying the CJS-ESM interop wrap
    //     (because the URL was not in the env's optimizedDepInfo)
    //   - per-env bare-spec resolution didn't preserve query strings
    //     (`storybook/theming/create?env=before` failed exports lookup)
    //
    // The replacement model keeps a single environment (client). The
    // `?env=before` marker is purely a content-routing signal:
    //   - `transformIndexHtml` adds the marker to entry scripts when the
    //     iframe is loaded with `?env=before`
    //   - `resolveId` (this plugin) propagates the marker from importer to
    //     resolved id for project files / virtual modules (not node_modules)
    //   - `beforeContentPlugin.load` returns HEAD content when the id
    //     carries the marker; otherwise it returns null
    //   - Vite's default middleware/plugin-container serves marked URLs the
    //     same way as unmarked ones; the marker simply produces a different
    //     `id` and therefore a different `moduleGraph` entry, isolating HMR
    //     of HEAD-backed modules from working-tree changes.

    configureServer(server) {
      notifyEnvApiServerReady(server);

      // Tear down per-plugin state when the dev server closes, so a subsequent
      // restart starts from a clean slate (channels not double-emitted; the
      // unhandledRejection listener is removed once the last instance unwinds).
      const onClose = () => {
        if (localChannel) detachChannel(localChannel);
        resetServerReadyHookForServer(server);
      };
      server.httpServer?.once('close', onClose);

      // Legacy middleware kept for the few tests that exercise the dispatch
      // path directly via `server.middlewares.handle()`. In production this
      // is a no-op because Storybook's outer router catches `/iframe.html`
      // before Vite's middleware chain runs, and module URLs go through
      // Vite's default `transformMiddleware` where the marker is handled
      // entirely via `resolveId` / `load` hooks.
      server.middlewares.use((req, _res, next) => {
        const url = req.url || '';
        if (url.includes(ENV_MARKER)) {
          options.onMiddlewareDispatch?.(url);
        }
        return next();
      });
    },

    transformIndexHtml: {
      // `post` so we run AFTER Vite's built-in plugins inject the
      // react-refresh preamble, the mocker entry, and the `@vite/client`
      // script — we need to rewrite URLs inside ALL of them, not just the
      // entry script that originates from the builder-vite template.
      order: 'post',
      // DO NOT REMOVE — load-bearing for entry-script marker; see ADR-0002.
      // The bare `<script src="virtual:/@storybook/builder-vite/vite-app.js">`
      // at builders/builder-vite/input/iframe.html:95 has no `?env=before`
      // query baked in; this hook is the sole place that adds it. The
      // Referer-based dispatch in `configureServer` cannot recover this case
      // because the entry-script request itself has no Referer (it IS the
      // entry). Removing or short-circuiting this handler regresses the
      // entire propagation chain.
      handler(html, ctx) {
        // `originalUrl` is set by Vite's dev middleware, `path` falls back
        // when the hook is invoked programmatically, and `filename` is set
        // during builds. Any of them carrying the marker means we are
        // transforming the before-iframe HTML. Builder-vite's iframeHandler
        // hands the original request URL (with `?env=before`) via the
        // 3rd arg of `server.transformIndexHtml`, so `ctx.originalUrl`
        // is the reliable signal in production.
        const ctxAny = ctx as { originalUrl?: string; path?: string; filename?: string };
        const candidates = [ctxAny.originalUrl, ctxAny.path, ctxAny.filename];
        const matched = candidates.some((s) => typeof s === 'string' && s.includes(ENV_MARKER));
        if (!matched) return;
        return injectDiagnosticBeacon(rewriteHtmlUrls(html));
      },
    },

    /**
     * Marker propagation runs ENTIRELY through this hook. Source code is
     * never rewritten (no `transform()` hook) — instead, every spec resolved
     * within the before environment gets its resolved id tagged with
     * `?env=before` (when appropriate), and Vite's built-in
     * `vite:import-analysis` rewrites the import to the marked URL. The
     * browser then fetches the marked URL, the dispatch middleware routes it
     * back into the before environment, and the cycle continues.
     *
     * Why not source-level rewriting (the original approach):
     *   - Vite's bare-spec resolver (`vite:resolve`) does NOT strip query
     *     strings before matching `exports` map / Node-style resolution.
     *     `import 'storybook/theming/create?env=before'` fails resolution
     *     where the unmarked form succeeds. Source-level marker injection
     *     therefore breaks all workspace + npm subpath imports.
     *
     * Why prepending in `preset.ts` matters:
     *   - This hook delegates via `this.resolve(..., { skipSelf: true })` to
     *     subsequent plugins. We MUST run before `builder-vite`'s
     *     `code-generator-plugin` and `storybook-project-annotations-plugin`
     *     so we observe their virtual-module resolutions and can post-process
     *     the resolved id with the marker. The addon's `preset.ts` therefore
     *     prepends our plugins to the config rather than appending.
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
        emitStructuredError('resolveId', err);
        return null;
      }
      if (!resolved) return null;
      if (!shouldRouteThroughBeforeEnv(resolved.id, repoRoot)) {
        // Resolved id should NOT carry the marker (node_modules, Vite
        // internals, paths outside the repo). Return the resolved object
        // as-is so the client-env optimizer's metadata flows through and
        // `vite:import-analysis` can apply CJS-ESM interop wrapping.
        return resolved;
      }
      return { ...resolved, id: attachMarkerToId(resolved.id) };
    },

    handleHotUpdate(ctx) {
      // The marker-bearing module ids serve HEAD content; working-tree file
      // changes must never cause them to be invalidated. Filter them out of
      // the HMR module list so the marker'd module entries keep their HEAD
      // content. Working-tree changes still propagate to the unmarked
      // module entries (Vite's default behavior).
      return ctx.modules.filter((m) => !(m.id && m.id.includes(ENV_MARKER)));
    },
  };
}

/**
 * Invalidate every marker-bearing module in the dev server's client
 * moduleGraph. Called by the addon's preset on `HEAD_CHANGED` events;
 * working-tree modules (no marker on id) are intentionally untouched.
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

/** Test/diagnostic helper: clears all process-level addon state. */
export function __resetBeforeEnvironmentForTesting(): void {
  activeChannels.clear();
  if (unhandledListener) {
    process.off('unhandledRejection', unhandledListener);
    unhandledListener = null;
  }
}
