import { AsyncLocalStorage } from 'node:async_hooks';
import type { ServerResponse } from 'node:http';

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
  const sep = specifier.includes('?') ? '&' : '?';
  return `${specifier}${sep}${ENV_MARKER}`;
}

const BYPASS_PREFIXES = ['/index.json', '/storybook-server-channel', '/runtime-error', '/sb-'];

function isBypassedUrl(url: string): boolean {
  return BYPASS_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function isJsLike(id: string): boolean {
  // Strip query string then test extension. Vite typically transforms
  // .js/.jsx/.ts/.tsx/.mjs/.cjs through plugins; CSS/JSON/assets have their own
  // pipelines we should not interfere with.
  const noQuery = id.split('?')[0];
  return /\.(?:[mc]?[jt]sx?|svelte|vue)$/.test(noQuery);
}

function getMimeForUrl(url: string): string {
  const cleanUrl = url.split('?')[0];
  if (cleanUrl.endsWith('.css')) return 'text/css; charset=utf-8';
  if (cleanUrl.endsWith('.json')) return 'application/json; charset=utf-8';
  if (cleanUrl.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'application/javascript; charset=utf-8';
}

function rewriteHtmlUrls(html: string): string {
  // Rewrite src= and href= attributes for script/link/img tags to carry ?env=before.
  // Skip same-page anchors, data: / blob: URLs, and absolute http(s) URLs (they go elsewhere).
  return html.replace(
    /(<(?:script|link|img)\b[^>]*\s(?:src|href)=)(["'])([^"']+)\2/gi,
    (full, prefix: string, quote: string, attrUrl: string) => {
      if (
        attrUrl.startsWith('#') ||
        attrUrl.startsWith('data:') ||
        attrUrl.startsWith('blob:') ||
        attrUrl.startsWith('http://') ||
        attrUrl.startsWith('https://') ||
        attrUrl.startsWith('//')
      ) {
        return full;
      }
      // Bypass storybook runtime / API endpoints — they live in the client env.
      const pathPart = attrUrl.split('?')[0];
      if (isBypassedUrl(pathPart)) return full;
      if (attrUrl.includes(ENV_MARKER)) return full;
      const sep = attrUrl.includes('?') ? '&' : '?';
      return `${prefix}${quote}${attrUrl}${sep}${ENV_MARKER}${quote}`;
    }
  );
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
  /** Hook for tests — called after middleware finishes serving each ?env=before request. */
  onMiddlewareDispatch?: (url: string) => void;
}

interface PluginContext {
  environment?: { name: string };
}

/**
 * Vite plugin that registers the `storybook-before` environment, dispatches
 * `?env=before` requests to it via middleware, rewrites iframe HTML URLs and
 * module specifiers, and isolates HMR + crash containment to the addon's
 * AsyncLocalStorage scope.
 *
 * The plugin runs across all environments; the heavy lifting in `transform()` is
 * gated to `this.environment?.name === BEFORE_ENV_NAME` so it is a fast no-op for
 * the client environment.
 */
export function beforeEnvironmentPlugin(options: BeforeEnvironmentPluginOptions = {}): Plugin {
  const localChannel = options.channel ?? null;
  if (localChannel) {
    activeChannels.add(localChannel);
    ensureUnhandledRejectionListener();
  }

  return {
    name: 'storybook:before-environment',
    enforce: 'pre',

    config(config) {
      const cfg = config as { environments?: Record<string, unknown> };
      cfg.environments ??= {};
      const existing = (cfg.environments[BEFORE_ENV_NAME] ?? {}) as Record<string, unknown>;
      cfg.environments[BEFORE_ENV_NAME] = {
        ...existing,
        dev: { ...((existing.dev as object) ?? {}) },
        optimizeDeps: { ...((existing.optimizeDeps as object) ?? {}), noDiscovery: true },
        consumer: 'client',
        resolve: { ...((existing.resolve as object) ?? {}) },
      };
    },

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

      // Pre-transform middleware: route ?env=before requests to the before env.
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (!url.includes(ENV_MARKER)) return next();

        const pathPart = url.split('?')[0];
        if (isBypassedUrl(pathPart)) return next();
        // Iframe HTML handled by Vite's built-in indexHtml middleware (which calls
        // `transformIndexHtml`); we only intercept module/asset requests here.
        if (pathPart.endsWith('.html') || pathPart === '/' || pathPart === '') {
          return next();
        }

        const beforeEnv = server.environments[BEFORE_ENV_NAME];
        if (!beforeEnv) return next();

        try {
          // Sourcemap sidecar: only the strict `<module>.<ext>.map?env=before`
          // form OR the explicit `?map` query that Vite uses internally. We
          // anchor on `\.[mc]?[jt]sx?\.map` for sidecars to avoid stripping
          // `.map` from legitimate filenames like `foo.map.ts`.
          const SIDECAR_RE = /\.(?:[mc]?[jt]sx?|css)\.map(?:\?|$)/;
          const QUERY_MAP_RE = /[?&]map(?:&|$)/;
          const isMapRequest = SIDECAR_RE.test(url) || QUERY_MAP_RE.test(url);
          if (isMapRequest) {
            const sourceUrl = url
              .replace(SIDECAR_RE, (m) => m.replace('.map', ''))
              // Strip the bare `map` token from the query while preserving any
              // surrounding `?`/`&` separators.
              .replace(QUERY_MAP_RE, (m) =>
                m
                  .replace(/map(?=&|$)/, '')
                  .replace(/&{2,}/g, '&')
                  .replace(/[?&]$/, '')
              );
            const result = await als.run({ scope: 'before-after' }, () =>
              beforeEnv.transformRequest(sourceUrl)
            );
            if (result?.map) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              res.end(JSON.stringify(result.map));
              options.onMiddlewareDispatch?.(url);
              return;
            }
            return next();
          }

          const result = await als.run({ scope: 'before-after' }, () =>
            beforeEnv.transformRequest(url)
          );
          if (!result) return next();

          serveTransformResult(url, result, res);
          options.onMiddlewareDispatch?.(url);
        } catch (err) {
          emitStructuredError('middleware', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(err instanceof Error ? err.message : String(err));
          }
        }
      });
    },

    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        // Multiple signals — `originalUrl` is set by Vite's dev middleware,
        // `path` falls back when the hook is invoked through `transformIndexHtml`
        // programmatically, and `filename` is set during builds. Any of them
        // carrying the marker means we are transforming the before-iframe HTML.
        const ctxAny = ctx as { originalUrl?: string; path?: string; filename?: string };
        const candidates = [ctxAny.originalUrl, ctxAny.path, ctxAny.filename];
        const matched = candidates.some((s) => typeof s === 'string' && s.includes(ENV_MARKER));
        if (!matched) return;
        return rewriteHtmlUrls(html);
      },
    },

    transform(code, id) {
      const env = (this as PluginContext).environment;
      if (env?.name !== BEFORE_ENV_NAME) return null;
      if (!isJsLike(id)) return null;
      try {
        const out = rewriteImports(id, code);
        if (!out) return null;
        return out;
      } catch (err) {
        emitStructuredError('transform', err);
        return null;
      }
    },

    handleHotUpdate(ctx) {
      // The before environment serves HEAD content; working-tree file changes
      // must never cause it to re-fetch. We compare on the *file path* (which
      // is invariant) rather than `urlToModuleMap` (which is keyed on the
      // post-resolve URL including `?env=before` and Vite's normalisation, so
      // string equality with `m.url` would under-match).
      const beforeEnv = ctx.server.environments[BEFORE_ENV_NAME];
      if (!beforeEnv) return;
      const beforeFiles = new Set<string>();
      for (const mod of beforeEnv.moduleGraph.idToModuleMap.values()) {
        if (mod.file) beforeFiles.add(mod.file);
      }
      return ctx.modules.filter((m) => !(m.file && beforeFiles.has(m.file)));
    },
  };
}

function serveTransformResult(
  url: string,
  result: { code: string; map?: unknown },
  res: ServerResponse
): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', getMimeForUrl(url));
  res.setHeader('Cache-Control', 'no-cache');
  if (result.map) {
    // Modern SourceMap header (NOT legacy X-SourceMap).
    res.setHeader('SourceMap', `${url}.map`);
  }
  res.end(result.code);
}

/**
 * Invalidate every module in the `storybook-before` environment's module graph.
 * Called by the addon's preset on `HEAD_CHANGED` events; the client environment's
 * graph is intentionally untouched.
 */
export function invalidateBeforeEnvironment(server: ViteDevServer): void {
  const env = server.environments[BEFORE_ENV_NAME];
  if (!env) return;
  env.moduleGraph.invalidateAll();
}

/** Test/diagnostic helper: clears all process-level addon state. */
export function __resetBeforeEnvironmentForTesting(): void {
  activeChannels.clear();
  if (unhandledListener) {
    process.off('unhandledRejection', unhandledListener);
    unhandledListener = null;
  }
}
