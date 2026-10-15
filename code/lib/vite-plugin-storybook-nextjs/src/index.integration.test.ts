import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { afterAll, expect, it, onTestFinished, vi } from 'vitest';

import { dirname, join } from 'pathe';
import { createLogger, createServer, normalizePath } from 'vite';

const require = createRequire(import.meta.url);

// utils.ts captures VITEST at import time; load the plugin in browser mode.
vi.stubEnv('VITEST', 'false');
const { default: nextPlugin } = await import('./index.ts');

afterAll(() => vi.unstubAllEnvs());

// Allow time for cold Next.js/Vite startup before the optimizer poll.
it.each(['isolated', 'hoisted'])(
  'optimizes Next.js styled-jsx with %s dependencies',
  async (layout) => {
    const root = await mkdtemp(join(tmpdir(), 'storybook-nextjs-optimizer-'));
    onTestFinished(() => rm(root, { recursive: true, force: true }));
    const nextRequire = createRequire(require.resolve('next/package.json'));
    const logger = createLogger();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    await mkdir(join(root, 'node_modules'));
    await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
    for (const dependency of ['next', 'react', 'react-dom']) {
      await symlink(
        dirname(require.resolve(`${dependency}/package.json`)),
        join(root, 'node_modules', dependency),
        'junction'
      );
    }
    if (layout === 'hoisted') {
      await symlink(
        dirname(nextRequire.resolve('styled-jsx/package.json')),
        join(root, 'node_modules/styled-jsx'),
        'junction'
      );
    }

    const server = await createServer({
      configFile: false,
      root,
      customLogger: logger,
      plugins: [nextPlugin({ dir: root })],
      optimizeDeps: { force: true, noDiscovery: true, holdUntilCrawlEnd: false },
      server: { middlewareMode: true, watch: null, ws: false },
    });
    onTestFinished(() => server.close());
    const optimizer = server.environments.client.depsOptimizer!;
    await optimizer.scanProcessing;
    const sources = ['styled-jsx', 'styled-jsx/style'].map((id) =>
      normalizePath(nextRequire.resolve(id))
    );
    const optimized = () => Object.values(optimizer.metadata.optimized);
    await expect
      .poll(
        () => sources.every((src) => optimized().some((dependency) => dependency.src === src)),
        { timeout: 5000 }
      )
      .toBe(true);
    for (const src of sources) {
      const dependency = optimized().find((dependency) => dependency.src === src)!;
      expect(await readFile(dependency.file, 'utf8')).not.toHaveLength(0);
    }
    expect(warn.mock.calls.map(([message]) => message).join('\n')).not.toContain(
      'Failed to resolve dependency'
    );
  },
  30_000
);
