/// <reference types="node" />

import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Plugin, ViteDevServer } from 'vite';
import { createServer } from 'vite';

import { ENV_MARKER, beforeEnvironmentPlugin } from '../before-environment-plugin.ts';

// ── crash-containment ────────────────────────────────────────────────────────
//
// The single-env model exercises the marker via `?env=before` on the id.
// `load`-time failures inside the marker'd code path must not bring the
// dev server down, and the addon's structured-error channel must surface
// the failure.

describe('crash containment — load() rejection for marker-bearing ids', () => {
  let tmpRoot: string;
  let server: ViteDevServer;
  const channelEmit = vi.fn();
  const channel = { emit: channelEmit } as { emit: (event: string, payload: unknown) => void };

  // Plugin that throws inside `load` for marker-bearing ids that point at
  // `boom.ts`. Fires regardless of environment (single-env model).
  const explodingLoader: Plugin = {
    name: 'exploding-loader',
    enforce: 'pre',
    load(id: string) {
      if (!id.includes(ENV_MARKER)) return null;
      if (id.includes('boom.ts')) throw new Error('boom');
      return null;
    },
  };

  // Fixture loader: serve a stable string for `ok.ts?env=before` so the
  // second request in the test does not regress to the working-tree read
  // path (the tmpdir is not a git repo).
  const fixtureLoader: Plugin = {
    name: 'fixture-loader',
    enforce: 'pre',
    load(id: string) {
      if (!id.includes(ENV_MARKER)) return null;
      const cleanPath = id.split('?')[0];
      if (cleanPath.endsWith('/ok.ts')) return `export const v = 1;\n`;
      return null;
    },
  };

  beforeAll(async () => {
    // `realpathSync` because macOS `mkdtempSync` returns a `/var/folders/...`
    // path but Vite resolves files to their realpath under `/private/var/...`.
    // Without this the marker'd resolved id falls outside `repoRoot` and the
    // discriminator drops the marker, causing the load hook to skip the file.
    tmpRoot = realpathSync(mkdtempSync(join(tmpdir(), 'before-after-crash-')));
    writeFileSync(join(tmpRoot, 'ok.ts'), `export const v = 1;\n`);
    writeFileSync(join(tmpRoot, 'boom.ts'), `export const v = 2;\n`);

    server = await createServer({
      root: tmpRoot,
      configFile: false,
      logLevel: 'silent',
      appType: 'custom',
      server: { middlewareMode: true, hmr: false },
      plugins: [
        beforeEnvironmentPlugin({ channel, repoRoot: tmpRoot }),
        explodingLoader,
        fixtureLoader,
      ],
    });
  }, 30_000);

  afterAll(async () => {
    if (server) await server.close();
    if (tmpRoot && existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('(i) the dev server stays alive after a load() throw on a marked id', async () => {
    await expect(
      server.environments.client.transformRequest(`/boom.ts?${ENV_MARKER}`)
    ).rejects.toThrow(/boom/);
    // Subsequent unrelated request succeeds — server is not poisoned.
    const ok = await server.environments.client.transformRequest(`/ok.ts?${ENV_MARKER}`);
    expect(ok).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AsyncLocalStorage scoping for unhandled rejections — independent of the
// dev-server model, purely a unit test of the scoping mechanism.
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

    await als.run({ scope: 'before-after' }, async () => {
      Promise.reject(new Error('addon-owned')).catch(() => {
        // swallow at promise level
      });
      await new Promise<void>((resolve) => {
        Promise.reject(new Error('addon-unhandled')).then(undefined, undefined);
        setTimeout(resolve, 100);
      });
    });

    Promise.reject(new Error('not-addon-owned')).then(undefined, undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));

    process.off('unhandledRejection', handler);

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
