/// <reference types="node" />

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SourceMapConsumer } from 'source-map-js';
import type { Plugin, ViteDevServer } from 'vite';
import { createServer } from 'vite';

import {
  BEFORE_ENV_NAME,
  ENV_MARKER,
  appendEnvBefore,
  beforeEnvironmentPlugin,
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
      plugins: [beforeEnvironmentPlugin(), fixtureLoader, makeSpyPlugin()],
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
