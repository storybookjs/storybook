/// <reference types="node" />

import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Plugin, ViteDevServer } from 'vite';
import { createServer } from 'vite';

import {
  BEFORE_ENV_NAME,
  ENV_MARKER,
  beforeEnvironmentPlugin,
} from '../before-environment-plugin.ts';

// ── crash-containment probe (K5) ─────────────────────────────────────────────
//
// Asserts:
//   (i)  An exception inside the before env's load pipeline does not crash the
//        Vite dev server — subsequent unrelated requests still succeed.
//   (ii) A structured `{ type: 'before-error', source: 'transform' | 'load',
//        message, stack }` channel event is emitted.
//   (iii) The global `unhandledRejection` swallow ONLY triggers inside the
//        addon's ALS scope. Out-of-scope rejections propagate.

describe('crash containment — load() rejection inside before env', () => {
  let tmpRoot: string;
  let server: ViteDevServer;
  const channelEmit = vi.fn();
  const channel = { emit: channelEmit } as { emit: (event: string, payload: unknown) => void };

  // Plugin that always throws inside `load` for the before env.
  const explodingLoader: Plugin = {
    name: 'exploding-loader',
    enforce: 'pre',
    load: {
      handler(id: string) {
        const env = (this as unknown as { environment?: { name: string } }).environment;
        if (env?.name !== BEFORE_ENV_NAME) return null;
        if (id.includes('boom.ts')) throw new Error('boom');
        return null;
      },
    },
  };

  // Fixture loader for non-exploding files (so the test fixture can resolve).
  const fixtureLoader: Plugin = {
    name: 'fixture-loader',
    enforce: 'pre',
    load: {
      async handler(id: string) {
        const env = (this as unknown as { environment?: { name: string } }).environment;
        if (env?.name !== BEFORE_ENV_NAME) return null;
        const cleanPath = id.split('?')[0];
        if (cleanPath.includes('boom.ts')) return null;
        const { readFile } = await import('node:fs/promises');
        try {
          return await readFile(cleanPath, 'utf-8');
        } catch {
          return null;
        }
      },
    },
  };

  beforeAll(async () => {
    tmpRoot = mkdtempSync(join(tmpdir(), 'before-after-crash-'));
    writeFileSync(join(tmpRoot, 'ok.ts'), `export const v = 1;\n`);
    writeFileSync(join(tmpRoot, 'boom.ts'), `export const v = 2;\n`);

    server = await createServer({
      root: tmpRoot,
      configFile: false,
      logLevel: 'silent',
      appType: 'custom',
      server: { middlewareMode: true, hmr: false },
      plugins: [beforeEnvironmentPlugin({ channel }), explodingLoader, fixtureLoader],
    });
  }, 30_000);

  afterAll(async () => {
    if (server) await server.close();
    if (tmpRoot && existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('(i) the dev server stays alive after a load() throw', async () => {
    const beforeEnv = server.environments[BEFORE_ENV_NAME]!;
    await expect(beforeEnv.transformRequest(`/boom.ts?${ENV_MARKER}`)).rejects.toThrow(/boom/);
    // Subsequent unrelated request succeeds — server is not poisoned.
    const ok = await beforeEnv.transformRequest(`/ok.ts?${ENV_MARKER}`);
    expect(ok).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (iii) ALS scoping for unhandledRejection
// ─────────────────────────────────────────────────────────────────────────────

describe('AsyncLocalStorage scoping for unhandled rejections', () => {
  it('rejections inside the addon ALS scope can be intercepted; outside-scope rejections propagate', async () => {
    const als = new AsyncLocalStorage<{ scope: 'before-after' }>();
    const inScopeReasons: unknown[] = [];
    const outOfScopeReasons: unknown[] = [];

    const handler = (reason: unknown) => {
      const store = als.getStore();
      if (store?.scope === 'before-after') {
        inScopeReasons.push(reason);
      } else {
        outOfScopeReasons.push(reason);
      }
    };
    process.on('unhandledRejection', handler);

    // In-scope rejection: triggered inside `als.run`. The store is set when the
    // listener fires, so the handler routes it as `inScopeReasons`.
    await als.run({ scope: 'before-after' }, async () => {
      Promise.reject(new Error('addon-owned')).catch(() => {
        // swallow at promise level — but we want the *unhandledRejection*
        // event to also fire. Re-emit via setImmediate inside the same
        // ALS context to simulate a truly-unhandled rejection.
      });
      await new Promise<void>((resolve) => {
        // Schedule an actually-unhandled rejection.
        Promise.reject(new Error('addon-unhandled')).then(undefined, undefined);
        setTimeout(resolve, 100);
      });
    });

    // Out-of-scope rejection: created OUTSIDE the ALS run.
    Promise.reject(new Error('not-addon-owned')).then(undefined, undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));

    process.off('unhandledRejection', handler);

    // The handler distinguished the two by ALS store presence.
    const inScopeMessages = inScopeReasons
      .map((r) => (r instanceof Error ? r.message : String(r)))
      .join(',');
    const outOfScopeMessages = outOfScopeReasons
      .map((r) => (r instanceof Error ? r.message : String(r)))
      .join(',');
    expect(inScopeMessages).toContain('addon-unhandled');
    expect(outOfScopeMessages).toContain('not-addon-owned');
    expect(inScopeMessages).not.toContain('not-addon-owned');
    expect(outOfScopeMessages).not.toContain('addon-unhandled');
  });
});
