/// <reference types="node" />

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SourceMapConsumer } from 'source-map-js';
import type { ModuleNode, Plugin, ViteDevServer } from 'vite';
import { createServer } from 'vite';

import {
  BEFORE_ENV_NAME,
  BYPASS_PREFIXES,
  ENV_MARKER,
  appendEnvBefore,
  beforeEnvironmentPlugin,
  isBeforeIframeReferer,
  rewriteImports,
} from '../before-environment-plugin.ts';
import { beforeContentPlugin } from '../before-content-plugin.ts';

// ── Probe-1: routing/rewrite coverage for STORYBOOK_BEFORE_AFTER_ENV_API.
//
// Coverage map (must all be green before wiring into preset.ts):
//   (a) `server.environments['storybook-before']` exists.
//   (b) Requests with `?env=before` route through that env's `transformRequest`.
//   (c) Static `import` rewrite.
//   (d) Dynamic `import()` literal.
//   (e) Dynamic `import()` non-literal: helper injected exactly once per module.
//   (f) Recursive dynamic imports: deep chains keep the marker.
//   (g) CSS `?direct` and `?used` query variants preserved.
//   (h) Worker URL: `new URL(literal, import.meta.url)` marker appended.
//   (i) Sourcemap correctness via source-map-consumer round-trip + sidecar header.
//   (j) oxc-parser byte-offset on multi-byte source.
// ─────────────────────────────────────────────────────────────────────────────

describe('appendEnvBefore (idempotence + query handling)', () => {
  it('appends ?env=before when no query is present', () => {
    expect(appendEnvBefore('./a.ts')).toBe('./a.ts?env=before');
  });
  it('appends &env=before when a query already exists', () => {
    expect(appendEnvBefore('./a.ts?direct')).toBe('./a.ts?direct&env=before');
  });
  it('is idempotent — re-appending is a no-op', () => {
    expect(appendEnvBefore('./a.ts?env=before')).toBe('./a.ts?env=before');
    expect(appendEnvBefore('./a.ts?direct&env=before')).toBe('./a.ts?direct&env=before');
  });
});

describe('isBeforeIframeReferer (helper unit slice)', () => {
  const HOST = 'localhost:6006';
  it('(a) bare iframe.html?env=before — true', () => {
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html?env=before', HOST)).toBe(true);
  });
  it('(b) iframe.html?env=before&id=foo — true', () => {
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html?env=before&id=foo', HOST)).toBe(
      true
    );
  });
  it('(c) iframe.html?id=foo&env=before — true (param order indifferent)', () => {
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html?id=foo&env=before', HOST)).toBe(
      true
    );
  });
  it('(d) cross-origin host — false', () => {
    expect(isBeforeIframeReferer('http://other-host:1234/iframe.html?env=before', HOST)).toBe(
      false
    );
  });
  it('(e) unparseable URL — false (graceful)', () => {
    expect(isBeforeIframeReferer('not-a-url', HOST)).toBe(false);
  });
  it('(f) wrong path (/index.html) — false', () => {
    expect(isBeforeIframeReferer('http://localhost:6006/index.html?env=before', HOST)).toBe(false);
  });
  it('(g) wrong env value (env=after) — false', () => {
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html?env=after', HOST)).toBe(false);
  });
  it('returns false for missing referer or host', () => {
    expect(isBeforeIframeReferer(undefined, HOST)).toBe(false);
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html?env=before', undefined)).toBe(
      false
    );
  });
});

describe('rewriteImports — static imports (probe c)', () => {
  it('rewrites a basic static default import', () => {
    const out = rewriteImports('a.ts', `import x from './a.ts';`);
    expect(out).not.toBeNull();
    expect(out!.code).toBe(`import x from "./a.ts?env=before";`);
  });

  it('rewrites multiple static specifiers and side-effect imports', () => {
    const out = rewriteImports(
      'a.ts',
      `import x from './a.ts';\nimport "./b.ts";\nimport { c } from "./c.ts";\n`
    );
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`"./a.ts?env=before"`);
    expect(out!.code).toContain(`"./b.ts?env=before"`);
    expect(out!.code).toContain(`"./c.ts?env=before"`);
  });

  it('rewrites re-exports (export … from)', () => {
    const out = rewriteImports('a.ts', `export { c } from "./c.ts";\nexport * from "./d.ts";\n`);
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`"./c.ts?env=before"`);
    expect(out!.code).toContain(`"./d.ts?env=before"`);
  });

  it('returns null when there is nothing to rewrite', () => {
    expect(rewriteImports('a.ts', `const x = 1;`)).toBeNull();
  });
});

describe('rewriteImports — dynamic imports (probe d, e)', () => {
  it('rewrites string-literal dynamic imports', () => {
    const out = rewriteImports('a.ts', `const m = import('./b.ts');`);
    expect(out).not.toBeNull();
    // Quote style is preserved: single-quoted source stays single-quoted.
    expect(out!.code).toContain(`import('./b.ts?env=before')`);
  });

  it('rewrites template-literal dynamic imports without expressions', () => {
    const out = rewriteImports('a.ts', 'const m = import(`./b.ts`);');
    expect(out).not.toBeNull();
    expect(out!.code).toContain('import(`./b.ts?env=before`)');
  });

  it('wraps non-literal dynamic imports with helper, injected exactly once', () => {
    const src = `const a = import(getName1());\nconst b = import(getName2());`;
    const out = rewriteImports('a.ts', src);
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`__envBeforeJoin(getName1())`);
    expect(out!.code).toContain(`__envBeforeJoin(getName2())`);
    const helperCount = (out!.code.match(/const __envBeforeJoin = /g) ?? []).length;
    expect(helperCount).toBe(1);
  });
});

describe('rewriteImports — query preservation (probe g)', () => {
  it('preserves an existing `?direct` CSS query', () => {
    const out = rewriteImports('a.ts', `import './a.css?direct';`);
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`"./a.css?direct&env=before"`);
  });
  it('preserves an existing `?used` CSS query', () => {
    const out = rewriteImports('a.ts', `import './a.css?used';`);
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`"./a.css?used&env=before"`);
  });
});

describe('rewriteImports — worker URL pattern (probe h)', () => {
  it('appends the marker to `new URL(literal, import.meta.url)`', () => {
    const out = rewriteImports(
      'a.ts',
      `const w = new Worker(new URL('./worker.ts', import.meta.url));`
    );
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`"./worker.ts?env=before"`);
  });

  it('skips `new URL(...)` whose second arg is not import.meta.url', () => {
    const out = rewriteImports('a.ts', `const u = new URL('./worker.ts', 'http://example.com');`);
    expect(out).toBeNull();
  });
});

describe('rewriteImports — multi-byte source (probe j)', () => {
  it('rewrites correctly when the source contains multi-byte chars before the import', () => {
    const out = rewriteImports('a.ts', `const e = '🎉 emoji';\nimport('./mb.ts');`);
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`'🎉 emoji'`);
    expect(out!.code).toContain(`import('./mb.ts?env=before')`);
  });

  it('rewrites when the multi-byte char is on the same line as the specifier', () => {
    const out = rewriteImports('a.ts', `import x from './a-🎉.ts';`);
    expect(out).not.toBeNull();
    expect(out!.code).toContain(`"./a-🎉.ts?env=before"`);
  });
});

describe('rewriteImports — sourcemap (probe i, unit slice)', () => {
  it('produces a magic-string map whose mappings cover the rewritten range', () => {
    const src = `import x from './a.ts';\nconst y = 1;\n`;
    const out = rewriteImports('a.ts', src);
    expect(out).not.toBeNull();
    expect(out!.map).toBeDefined();
    const map = out!.map as { mappings: string; sources: string[] };
    expect(map.mappings.length).toBeGreaterThan(0);
    expect(map.sources).toContain('a.ts');

    const consumer = new SourceMapConsumer(out!.map as never);
    const importLine = out!.code.split('\n')[0];
    const xCol = importLine.indexOf('x');
    const orig = consumer.originalPositionFor({ line: 1, column: xCol });
    expect(orig.line).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Real Vite server integration tests for routing (probes a, b, f, i-sidecar)
// ─────────────────────────────────────────────────────────────────────────────

describe('Vite Environment API integration', () => {
  let tmpRoot: string;
  let server: ViteDevServer;
  // Spy plugin: counts how many times each env's transform fires per id, so we can
  // assert that ?env=before requests reach the storybook-before env (probe b).
  const spyPerEnv: Record<string, Set<string>> = {
    client: new Set(),
    [BEFORE_ENV_NAME]: new Set(),
  };
  // Mutable holder for the URL last passed through `onMiddlewareDispatch`.
  // Reset between probes via `beforeEach`. `null` means the addon's middleware
  // called `next()` without dispatching this request to the before env.
  const dispatchState: { url: string | null } = { url: null };

  function makeSpyPlugin(): Plugin {
    return {
      name: 'storybook-before-spy',
      enforce: 'post',
      transform(_code, id) {
        const env = (this as unknown as { environment?: { name: string } }).environment;
        const name = env?.name ?? 'unknown';
        if (!spyPerEnv[name]) spyPerEnv[name] = new Set();
        spyPerEnv[name].add(id.split('?')[0]);
        return null;
      },
    };
  }

  beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'before-after-probe-'));
    writeFileSync(
      join(tmpRoot, 'a.ts'),
      `import { value } from './b.ts';\nexport const fromA = value + 1;\n`
    );
    writeFileSync(
      join(tmpRoot, 'b.ts'),
      `import { v as third } from './c.ts';\nexport const value = 41 + third;\n`
    );
    writeFileSync(join(tmpRoot, 'c.ts'), `export const v = 1;\n`);
    // Single-export module, no imports — used by the (k.*) middleware-dispatch
    // probes so the spy plugin can observe a clean before-env transform.
    writeFileSync(join(tmpRoot, 'd.ts'), `export const fromD = 7;\n`);

    // Tiny loader that supplies content for `?env=before` requests, scoped to
    // the storybook-before environment. Stands in for `before-content-plugin`
    // (whose HEAD blob retrieval is not exercised in this routing-only probe).
    const fixtureLoader: Plugin = {
      name: 'fixture-loader',
      enforce: 'pre',
      load: {
        async handler(id: string) {
          const env = (this as unknown as { environment?: { name: string } }).environment;
          if (env?.name !== BEFORE_ENV_NAME) return null;
          const cleanPath = id.split('?')[0];
          const { readFile } = await import('node:fs/promises');
          try {
            return await readFile(cleanPath, 'utf-8');
          } catch {
            return null;
          }
        },
      },
    };

    server = await createServer({
      root: tmpRoot,
      configFile: false,
      logLevel: 'silent',
      appType: 'custom',
      server: { middlewareMode: true, hmr: false },
      plugins: [
        beforeEnvironmentPlugin({
          onMiddlewareDispatch: (url) => {
            dispatchState.url = url;
          },
        }),
        fixtureLoader,
        makeSpyPlugin(),
      ],
    });
  }, 30_000);

  afterAll(async () => {
    if (server) await server.close();
    if (tmpRoot && existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('(a) registers `server.environments["storybook-before"]`', () => {
    expect(server.environments[BEFORE_ENV_NAME]).toBeDefined();
    expect(server.environments[BEFORE_ENV_NAME]?.name).toBe(BEFORE_ENV_NAME);
  });

  it('(b) routes `?env=before` requests through the before environment', async () => {
    spyPerEnv.client.clear();
    spyPerEnv[BEFORE_ENV_NAME].clear();

    const beforeEnv = server.environments[BEFORE_ENV_NAME]!;
    const result = await beforeEnv.transformRequest(`/a.ts?${ENV_MARKER}`);
    expect(result).not.toBeNull();
    expect(result!.code).toContain(`?env=before`);

    // The spy should have observed the file in the before env, not the client env.
    const beforeIds = Array.from(spyPerEnv[BEFORE_ENV_NAME]).join('|');
    expect(beforeIds).toMatch(/a\.ts/);
    const clientIds = Array.from(spyPerEnv.client).join('|');
    expect(clientIds).not.toMatch(/a\.ts/);
  });

  it('(f) recursive imports carry the env marker through Vite resolution', async () => {
    const beforeEnv = server.environments[BEFORE_ENV_NAME]!;
    const a = await beforeEnv.transformRequest(`/a.ts?${ENV_MARKER}`);
    // Vite's downstream resolver may rewrite relative specifiers to absolute
    // `/@fs/...` URLs; what matters is that the env marker survives that rewrite.
    expect(a!.code).toMatch(/b\.ts\?env=before/);
    const b = await beforeEnv.transformRequest(`/b.ts?${ENV_MARKER}`);
    expect(b!.code).toMatch(/c\.ts\?env=before/);
    const c = await beforeEnv.transformRequest(`/c.ts?${ENV_MARKER}`);
    expect(c).not.toBeNull();
  });

  it('(i) sidecar map: middleware exposes a sourcemap for transformed modules', async () => {
    const beforeEnv = server.environments[BEFORE_ENV_NAME]!;
    const a = await beforeEnv.transformRequest(`/a.ts?${ENV_MARKER}`);
    expect(a).not.toBeNull();
    expect(a!.map).toBeTruthy();
    const consumer = new SourceMapConsumer(a!.map as never);
    const orig = consumer.originalPositionFor({ line: 1, column: 0 });
    expect(orig).toBeDefined();
  });

  // ───────────────────────────────────────────────────────────────────────
  // Probe (k): middleware-driven Referer dispatch
  //
  // These probes drive `server.middlewares.handle()` end-to-end with
  // synthetic IncomingMessage/ServerResponse pairs so the dispatch decision
  // (gate → bypass → path-blocklist → html → dispatch) is exercised on
  // exactly the surface that production traffic hits. Probes that call
  // `beforeEnv.transformRequest()` directly (probes b/f/i above) cannot
  // catch regressions in the middleware itself.
  // ───────────────────────────────────────────────────────────────────────

  describe('configureServer middleware — Referer dispatch (probe k)', () => {
    interface ProbeRequest {
      url: string;
      method?: string;
      referer?: string;
      host?: string;
    }

    interface ProbeResult {
      statusCode: number;
      body: string;
      headersSent: boolean;
      nextCalled: boolean;
      dispatchedUrl: string | null;
      spyBeforeIds: string[];
      spyClientIds: string[];
      beforeGraphIds: string[];
    }

    async function driveMiddleware(req: ProbeRequest): Promise<ProbeResult> {
      const socket = new Socket();
      const incoming = new IncomingMessage(socket);
      incoming.url = req.url;
      incoming.method = req.method ?? 'GET';
      incoming.headers = {
        host: req.host ?? 'localhost:6006',
        ...(req.referer ? { referer: req.referer } : {}),
      };

      const chunks: Buffer[] = [];
      const response = new ServerResponse(incoming);
      // ServerResponse's `'finish'` event fires after the body flushes through
      // the underlying socket, which our synthetic Socket never does — so we
      // resolve via the wrapped `write`/`end` calls instead. The wrappers
      // intentionally return without invoking the original methods to avoid
      // waiting on socket flushes that will never happen in the test harness.
      let resolveEnd: () => void = () => {};
      const endPromise = new Promise<void>((r) => {
        resolveEnd = r;
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.write = ((chunk: any) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        return true;
      }) as typeof response.write;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      response.end = ((chunk?: any) => {
        if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        resolveEnd();
        return response;
      }) as typeof response.end;

      let nextCalled = false;
      let resolveNext: () => void = () => {};
      const nextPromise = new Promise<void>((r) => {
        resolveNext = r;
      });
      const stack = server.middlewares as unknown as {
        handle: (req: IncomingMessage, res: ServerResponse, out: (err?: unknown) => void) => void;
      };
      stack.handle(incoming, response, () => {
        nextCalled = true;
        resolveNext();
      });
      // Whichever happens first — the addon dispatches (end called) or the
      // middleware chain falls through (next called) — completes the probe.
      await Promise.race([endPromise, nextPromise]);

      // Snapshot of `urlToModuleMap` keys (urls): captures any ids the before
      // env's resolver registered as a result of this dispatch — used by (k.8)
      // to assert path-blocklist requests do NOT poison the before graph.
      const beforeEnv = server.environments[BEFORE_ENV_NAME]!;
      const beforeGraphIds: string[] = [];
      for (const mod of beforeEnv.moduleGraph.idToModuleMap.values()) {
        if (mod.id) beforeGraphIds.push(mod.id);
      }

      return {
        statusCode: response.statusCode,
        body: Buffer.concat(chunks).toString('utf-8'),
        headersSent: response.headersSent,
        nextCalled,
        dispatchedUrl: dispatchState.url,
        spyBeforeIds: Array.from(spyPerEnv[BEFORE_ENV_NAME] ?? []),
        spyClientIds: Array.from(spyPerEnv.client ?? []),
        beforeGraphIds,
      };
    }

    beforeEach(() => {
      dispatchState.url = null;
      spyPerEnv.client.clear();
      spyPerEnv[BEFORE_ENV_NAME].clear();
      // Invalidate transform caches so each probe re-runs the full pipeline
      // (and the spy fires fresh). Without this, repeat requests to the same
      // URL across probes hit Vite's transform cache and the spy never sees
      // them, masking real dispatch behavior.
      server.environments[BEFORE_ENV_NAME]?.moduleGraph.invalidateAll();
      server.environments.client?.moduleGraph.invalidateAll();
    });

    it('(k.1) marker-present `/d.ts?env=before` (no Referer) → dispatched through before env', async () => {
      const r = await driveMiddleware({ url: `/d.ts?${ENV_MARKER}` });
      expect(r.dispatchedUrl).toBe(`/d.ts?${ENV_MARKER}`);
      expect(r.spyBeforeIds.some((id) => id.endsWith('/d.ts'))).toBe(true);
      expect(r.spyClientIds.some((id) => id.endsWith('/d.ts'))).toBe(false);
    });

    it('(k.2) marker-less `/d.ts` + same-origin before-iframe Referer → dispatched with marker append', async () => {
      const r = await driveMiddleware({
        url: '/d.ts',
        referer: 'http://localhost:6006/iframe.html?id=x&viewMode=story&env=before',
      });
      expect(r.dispatchedUrl).toBe(`/d.ts?${ENV_MARKER}`);
      expect(r.spyBeforeIds.some((id) => id.endsWith('/d.ts'))).toBe(true);
      expect(r.spyClientIds.some((id) => id.endsWith('/d.ts'))).toBe(false);
    });

    it('(k.2.b) marker-less `/d.ts` + non-before Referer → next() (no dispatch)', async () => {
      const r = await driveMiddleware({
        url: '/d.ts',
        referer: 'http://localhost:6006/iframe.html?id=x&viewMode=story',
      });
      expect(r.dispatchedUrl).toBeNull();
      expect(r.spyBeforeIds.some((id) => id.endsWith('/d.ts'))).toBe(false);
    });

    it('(k.3.0) BYPASS_PREFIXES forcing function — adding entries here requires a probe', () => {
      // If this fails, you added a new bypass prefix without a corresponding
      // (k.3.*) probe below. Add the probe AND bump this length, in that order.
      expect(BYPASS_PREFIXES.length).toBe(4);
    });

    it('(k.3.a) marker-less `/index.json` + before-Referer → next() (bypass wins)', async () => {
      const r = await driveMiddleware({
        url: '/index.json',
        referer: 'http://localhost:6006/iframe.html?env=before',
      });
      expect(r.dispatchedUrl).toBeNull();
    });

    it('(k.3.b) marker-less `/storybook-server-channel/?token=abc` + before-Referer → next()', async () => {
      const r = await driveMiddleware({
        url: '/storybook-server-channel/?token=abc',
        referer: 'http://localhost:6006/iframe.html?env=before',
      });
      expect(r.dispatchedUrl).toBeNull();
    });

    it('(k.3.c) marker-less `/runtime-error` + before-Referer → next()', async () => {
      const r = await driveMiddleware({
        url: '/runtime-error',
        referer: 'http://localhost:6006/iframe.html?env=before',
      });
      expect(r.dispatchedUrl).toBeNull();
    });

    it('(k.3.d) marker-less `/sb-common-assets/font.woff2` + before-Referer → next()', async () => {
      const r = await driveMiddleware({
        url: '/sb-common-assets/font.woff2',
        referer: 'http://localhost:6006/iframe.html?env=before',
      });
      expect(r.dispatchedUrl).toBeNull();
    });

    it('(k.4) marker-less `/` + before-Referer → next() (root deferred to indexHtml)', async () => {
      const r = await driveMiddleware({
        url: '/',
        referer: 'http://localhost:6006/iframe.html?env=before',
      });
      expect(r.dispatchedUrl).toBeNull();
    });

    it('(k.5) `/iframe.html?env=before` (no Referer) → next() (HTML handled by transformIndexHtml)', async () => {
      const r = await driveMiddleware({ url: `/iframe.html?${ENV_MARKER}` });
      expect(r.dispatchedUrl).toBeNull();
    });

    it('(k.6) cross-origin Referer (host mismatch) → next() (same-origin rejects)', async () => {
      const r = await driveMiddleware({
        url: '/d.ts',
        referer: 'http://evil-host:1234/iframe.html?env=before',
        host: 'localhost:6006',
      });
      expect(r.dispatchedUrl).toBeNull();
      expect(r.spyBeforeIds.some((id) => id.endsWith('/d.ts'))).toBe(false);
    });

    it('(k.7) before-Referer + `/node_modules/x/index.js` → next() (path-blocklist)', async () => {
      const r = await driveMiddleware({
        url: '/node_modules/some-pkg/index.js',
        referer: 'http://localhost:6006/iframe.html?env=before',
      });
      expect(r.dispatchedUrl).toBeNull();
    });

    it('(k.7.b) before-Referer + `/.vite/deps/react.js` → next() (path-blocklist)', async () => {
      const r = await driveMiddleware({
        url: '/foo/.vite/deps/react.js',
        referer: 'http://localhost:6006/iframe.html?env=before',
      });
      expect(r.dispatchedUrl).toBeNull();
    });

    it('(k.8) before-Referer + node_modules path → before env moduleGraph stays clean', async () => {
      const r = await driveMiddleware({
        url: '/node_modules/some-pkg/index.js',
        referer: 'http://localhost:6006/iframe.html?env=before',
      });
      expect(r.beforeGraphIds.some((id) => id.includes('/node_modules/'))).toBe(false);
    });

    it('(k.9) handleHotUpdate does NOT over-filter never-routed files', () => {
      // Locate the addon plugin instance to call handleHotUpdate directly with
      // a synthetic ctx. The filter expression at before-environment-plugin.ts:463
      // is `!(m.file && beforeFiles.has(m.file))` — a never-routed file's
      // `m.file` is NOT in `beforeFiles`, so the filter keeps it and the mod
      // entry MUST appear in the array RETURNED by handleHotUpdate.
      const plugins = server.config.plugins as unknown as ReadonlyArray<Plugin>;
      const addonPlugin = plugins.find((p) => p && p.name === 'storybook:before-environment');
      expect(addonPlugin).toBeDefined();

      const neverRoutedFile = join(tmpRoot, 'src', 'never-before-routed.ts');
      const fakeMod: ModuleNode = {
        file: neverRoutedFile,
      } as unknown as ModuleNode;

      const ctx = {
        server,
        modules: [fakeMod],
        // unused, but typed loosely so we don't depend on Vite's HmrContext shape
        file: neverRoutedFile,
        timestamp: Date.now(),
        read: async () => '',
      } as unknown as Parameters<NonNullable<Plugin['handleHotUpdate']>>[0];

      // Call the hook (could be a function or an object with handler); in this
      // plugin it's defined as a plain function.
      const hook = addonPlugin!.handleHotUpdate;
      const fn = typeof hook === 'function' ? hook : hook?.handler;
      expect(typeof fn).toBe('function');

      const result = fn!.call(addonPlugin as unknown as never, ctx);
      // Resolve to an array of modules; handleHotUpdate may return Promise or sync value.
      const resolved = Array.isArray(result) ? result : [];
      expect(resolved.some((m) => m.file === neverRoutedFile)).toBe(true);
    });

    it('(k.10) transformIndexHtml emits ?env=before on the entry script AND ships the diagnostic beacon', async () => {
      const html = await server.transformIndexHtml(
        `/iframe.html?${ENV_MARKER}`,
        '<html><head></head><body><script type="module" src="virtual:/@storybook/builder-vite/vite-app.js"></script></body></html>'
      );
      // Load-bearing for the entry-script marker: bare `<script src="virtual:..">`
      // at builders/builder-vite/input/iframe.html:95 has no `?env=before` baked
      // in; this rewrite is the sole place that adds it. See ADR-0002.
      expect(html).toContain('vite-app.js?env=before');
      // Diagnostic beacon (Step 5.5): observability-only console.warn that fires
      // when the iframe loads without `env=before` on its own URL — a precondition
      // for Referer-based dispatch to work for descendants.
      expect(html).toContain('storybook/before-after');
      expect(html).toContain('Referrer-Policy');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// applyToEnvironment gating (probe b, content-plugin scoping)
// ─────────────────────────────────────────────────────────────────────────────

describe('beforeContentPlugin scoping', () => {
  it('scopes applyToEnvironment to the before env', () => {
    const plugin = beforeContentPlugin({ repoRoot: '/tmp' });
    const apply = (plugin as unknown as { applyToEnvironment?: (e: { name: string }) => boolean })
      .applyToEnvironment;
    expect(typeof apply).toBe('function');
    expect(apply!({ name: BEFORE_ENV_NAME })).toBe(true);
    expect(apply!({ name: 'client' })).toBe(false);
    // Sanity check: BEFORE_ENV_NAME respects Vite's identifier rules (no hyphens).
    expect(BEFORE_ENV_NAME).toMatch(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
  });
});
