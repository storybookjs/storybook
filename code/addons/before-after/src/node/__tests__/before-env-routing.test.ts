/// <reference types="node" />

import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ViteDevServer } from 'vite';
import { createServer } from 'vite';

import {
  appendEnvBefore,
  beforeEnvironmentPlugin,
  isBeforeIframeReferer,
  shouldRouteThroughBeforeEnv,
} from '../before-environment-plugin.ts';
import { beforeContentPlugin } from '../before-content-plugin.ts';

// ─────────────────────────────────────────────────────────────────────────────
//
// SINGLE-ENV ARCHITECTURE (replaces the obsolete `storybookBefore` env model)
//
// The before-after addon used to register a second Vite environment named
// `storybookBefore` and dispatch `?env=before` URLs through its plugin
// container. That model produced two unfixable problems:
//
//   1. Per-env `vite:optimizeDeps` returned raw CJS files for `react` and
//      similar packages; the per-env import-analysis did not see them as
//      optimized URLs and emitted raw named-import statements that the
//      browser rejected (`The requested module does not provide an export
//      named 'default'`).
//   2. Per-env bare-spec resolution did not strip query strings before
//      matching the package `exports` map, so any subpath import that
//      reached the env carried with `?env=before` failed
//      (`storybook/theming/create?env=before` → `Does the file exist?`).
//
// The replacement model uses a SINGLE Vite environment (the default `client`).
// The `?env=before` marker is purely a content-routing signal:
//
//   - `transformIndexHtml` adds the marker to entry script `src` attributes
//     when the iframe is requested with `?env=before`.
//   - `beforeEnvironmentPlugin.resolveId` propagates the marker from the
//     importer's id onto each resolved id for project files / virtual
//     modules (NOT `node_modules`, so optimizeDeps still applies).
//   - `beforeContentPlugin.load` returns HEAD content when the id carries
//     the marker; otherwise it returns `null` and Vite reads working tree.
//   - Vite's default `transformMiddleware` serves marked URLs the same way
//     as unmarked ones; the marker simply produces a different `id` and
//     therefore a different moduleGraph entry, isolating HMR of HEAD-backed
//     modules from working-tree changes.
//
// The tests below cover the new architecture. The obsolete integration
// probes (`(k.*)` family from the env-dispatch model) have been removed.
//
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
  it('normalises bare-directory specifiers ("." → "./")', () => {
    // `./?env=before` resolves via directory-index; `.?env=before` doesn't.
    expect(appendEnvBefore('.')).toBe('./?env=before');
    expect(appendEnvBefore('..')).toBe('../?env=before');
  });
});

describe('isBeforeIframeReferer (helper)', () => {
  const HOST = 'localhost:6006';
  it('accepts a same-origin /iframe.html?env=before referer', () => {
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html?env=before', HOST)).toBe(true);
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html?env=before&id=x', HOST)).toBe(
      true
    );
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html?id=x&env=before', HOST)).toBe(
      true
    );
  });
  it('rejects when host, path, or marker mismatch', () => {
    expect(isBeforeIframeReferer('http://other:1234/iframe.html?env=before', HOST)).toBe(false);
    expect(isBeforeIframeReferer('http://localhost:6006/index.html?env=before', HOST)).toBe(false);
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html?env=after', HOST)).toBe(false);
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html', HOST)).toBe(false);
  });
  it('returns false for unparseable / missing inputs', () => {
    expect(isBeforeIframeReferer('not-a-url', HOST)).toBe(false);
    expect(isBeforeIframeReferer(undefined, HOST)).toBe(false);
    expect(isBeforeIframeReferer('http://localhost:6006/iframe.html?env=before', undefined)).toBe(
      false
    );
  });
});

describe('shouldRouteThroughBeforeEnv (marker-attach discriminator)', () => {
  const repoRoot = '/repo';
  it('marks project paths', () => {
    expect(shouldRouteThroughBeforeEnv('/repo/src/foo.ts', repoRoot)).toBe(true);
  });
  it('marks virtual modules', () => {
    expect(shouldRouteThroughBeforeEnv('\0virtual:/@x/vite-app.js', repoRoot)).toBe(true);
  });
  it('does NOT mark node_modules (CJS interop must stay in client env)', () => {
    expect(shouldRouteThroughBeforeEnv('/repo/node_modules/react/index.js', repoRoot)).toBe(false);
  });
  it('does NOT mark Vite-internal URLs', () => {
    expect(shouldRouteThroughBeforeEnv('/@vite/client', repoRoot)).toBe(false);
    expect(shouldRouteThroughBeforeEnv('/@react-refresh', repoRoot)).toBe(false);
  });
  it('does NOT double-mark an id that already carries the marker', () => {
    expect(shouldRouteThroughBeforeEnv('/repo/src/foo.ts?env=before', repoRoot)).toBe(false);
  });
  it('does NOT mark paths outside the repo when repoRoot is set', () => {
    expect(shouldRouteThroughBeforeEnv('/elsewhere/foo.ts', repoRoot)).toBe(false);
  });
  it('does not mark anything when repoRoot is undefined', () => {
    expect(shouldRouteThroughBeforeEnv('/anything/foo.ts', undefined)).toBe(false);
  });
});

describe('beforeContentPlugin (load gating)', () => {
  it('serves HEAD content only for marker-bearing project ids', async () => {
    const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'sb-before-after-')));
    try {
      // Initialise a git repo with a committed file, then modify the working
      // tree so HEAD and disk differ. The plugin's load hook should return
      // the HEAD content (via `git show HEAD:...`) when the id carries the
      // marker, and `null` otherwise.
      const { execSync } = await import('node:child_process');
      const execaSync = (cmd: string, args: string[], opts: { cwd: string }) =>
        execSync(`${cmd} ${args.map((a) => JSON.stringify(a)).join(' ')}`, opts);
      execaSync('git', ['init'], { cwd: tmp });
      execaSync('git', ['config', 'user.email', 'test@test'], { cwd: tmp });
      execaSync('git', ['config', 'user.name', 'test'], { cwd: tmp });
      writeFileSync(join(tmp, 'foo.ts'), 'export const x = "HEAD";', 'utf-8');
      execaSync('git', ['add', '.'], { cwd: tmp });
      execaSync('git', ['commit', '-m', 'init'], { cwd: tmp });
      writeFileSync(join(tmp, 'foo.ts'), 'export const x = "WORKING";', 'utf-8');

      const plugin = beforeContentPlugin({ repoRoot: tmp });
      const loadHook = plugin.load as (id: string) => Promise<string | null | undefined>;
      const headPath = `${tmp}/foo.ts?env=before`;
      const workingPath = `${tmp}/foo.ts`;
      await expect(loadHook(headPath)).resolves.toBe('export const x = "HEAD";');
      await expect(loadHook(workingPath)).resolves.toBe(null);
    } finally {
      if (existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('returns null for virtual ids and node_modules ids even with marker', async () => {
    const plugin = beforeContentPlugin({ repoRoot: '/repo' });
    const loadHook = plugin.load as (id: string) => Promise<string | null | undefined>;
    await expect(loadHook('\0virtual:/x?env=before')).resolves.toBe(null);
    await expect(loadHook('/repo/node_modules/react/index.js?env=before')).resolves.toBe(null);
  });
});

describe('beforeEnvironmentPlugin (resolveId hook, isolated)', () => {
  let workdir: string;
  let server: ViteDevServer;

  beforeAll(async () => {
    workdir = realpathSync(mkdtempSync(join(tmpdir(), 'sb-before-after-integration-')));
    mkdirSync(join(workdir, 'src'), { recursive: true });
    writeFileSync(join(workdir, 'src/main.ts'), `export const v = "WORKING";`, 'utf-8');
    writeFileSync(join(workdir, 'src/index.ts'), `import './main.ts';`, 'utf-8');

    server = await createServer({
      root: workdir,
      logLevel: 'error',
      configFile: false,
      server: { middlewareMode: true, hmr: false },
      plugins: [beforeEnvironmentPlugin({ channel: null, repoRoot: workdir })],
    });
  });

  afterAll(async () => {
    await server.close();
    if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
  });

  it('propagates the marker from importer to resolved id for project paths', async () => {
    // Mimic `vite:import-analysis` calling resolveId for a relative import
    // from a marker-bearing importer: the resolved id should carry the
    // marker so the URL written into the transformed source routes back
    // through the before-content load gate.
    const resolved = await server.environments.client.pluginContainer.resolveId(
      './main.ts',
      `${workdir}/src/index.ts?env=before`
    );
    expect(resolved).toBeTruthy();
    expect(resolved!.id).toMatch(/\?env=before/);
  });

  it('returns clean (unmarked) ids when neither source nor importer carries the marker', async () => {
    const resolved = await server.environments.client.pluginContainer.resolveId(
      './main.ts',
      `${workdir}/src/index.ts`
    );
    expect(resolved).toBeTruthy();
    expect(resolved!.id).not.toMatch(/\?env=before/);
  });
});
