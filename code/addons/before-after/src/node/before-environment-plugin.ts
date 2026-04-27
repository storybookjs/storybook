import { AsyncLocalStorage } from 'node:async_hooks';
import type { ServerResponse } from 'node:http';

import type { Channel } from 'storybook/internal/channels';

import MagicString from 'magic-string';
import type { Span, ValueSpan } from 'oxc-parser';
import { parseSync } from 'oxc-parser';
import type { Plugin, ViteDevServer } from 'vite';

import { notifyEnvApiServerReady } from './server-ready-hook.ts';

// Vite restricts environment names to alphanumeric chars plus `$` and `_`, so
// we use a camelCase identifier internally. The on-the-wire query marker stays
// `env=before` because that is our own routing token, not a Vite env name.
export const BEFORE_ENV_NAME = 'storybookBefore';
export const ENV_MARKER = 'env=before';

interface AlsStore {
  scope: 'before-after';
}

const als = new AsyncLocalStorage<AlsStore>();

let unhandledListenerInstalled = false;
let activeChannel: Pick<Channel, 'emit'> | null = null;

function emitStructuredError(source: string, error: unknown): void {
  if (!activeChannel) return;
  activeChannel.emit('storybook/before-after/server-error', {
    type: 'before-error',
    source,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

function installUnhandledRejectionListener(): void {
  if (unhandledListenerInstalled) return;
  unhandledListenerInstalled = true;
  process.on('unhandledRejection', (reason) => {
    const store = als.getStore();
    if (store?.scope !== 'before-after') {
      // Not addon-owned: let other handlers (or Node's default) see it.
      return;
    }
    emitStructuredError('unhandledRejection', reason);
  });
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

  const ensureHelper = () => {
    if (helperInjected) return;
    helperInjected = true;
    ms.prepend(
      `const __envBeforeJoin = (s) => s + (s.includes('?') ? '&' : '?') + 'env=before';\n`
    );
  };

  for (const dyn of result.module.dynamicImports ?? []) {
    const argSpan: Span = dyn.moduleRequest;
    const slice = code.slice(argSpan.start, argSpan.end);
    const trimmed = slice.trim();

    const stringMatch = STRING_LITERAL_RE.exec(trimmed);
    if (stringMatch) {
      const raw = stringMatch[2];
      let unescaped: string;
      try {
        unescaped = JSON.parse(`"${raw.replace(/\\'/g, "'")}"`);
      } catch {
        unescaped = raw;
      }
      const newValue = appendEnvBefore(unescaped);
      if (newValue !== unescaped) {
        ms.overwrite(argSpan.start, argSpan.end, JSON.stringify(newValue));
        changed = true;
      }
      continue;
    }

    const tmplMatch = TEMPLATE_NO_EXPR_RE.exec(trimmed);
    if (tmplMatch) {
      const raw = tmplMatch[1];
      const newValue = appendEnvBefore(raw);
      if (newValue !== raw) {
        ms.overwrite(argSpan.start, argSpan.end, '`' + newValue + '`');
        changed = true;
      }
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
  if (options.channel) activeChannel = options.channel;
  installUnhandledRejectionListener();

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
          // Sourcemap sidecar: `<module>?env=before&map` or `<module>?env=before.map`.
          const isMapRequest = /\.map(?:\?|$)/.test(url) || /[?&]map(?:&|$)/.test(url);
          if (isMapRequest) {
            const sourceUrl = url.replace(/\.map(\?|$)/, '$1').replace(/([?&])map(?=&|$)/, '$1');
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
        const originalUrl = ctx.originalUrl ?? ctx.path ?? '';
        if (!originalUrl.includes(ENV_MARKER)) return;
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
      // The before environment serves HEAD content; working-tree changes must
      // never cause it to re-fetch. Filter out any modules belonging to the
      // before env's module graph from the HMR update set.
      const beforeEnv = ctx.server.environments[BEFORE_ENV_NAME];
      if (!beforeEnv) return;
      return ctx.modules.filter((m) => !beforeEnv.moduleGraph.urlToModuleMap.has(m.url));
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

/** Test/diagnostic helper: clears the global channel reference. */
export function __resetBeforeEnvironmentForTesting(): void {
  activeChannel = null;
}
