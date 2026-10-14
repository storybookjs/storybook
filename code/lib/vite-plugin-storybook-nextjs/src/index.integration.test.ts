import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

import { afterEach, expect, it, vi } from 'vitest';

import { dirname, join } from 'pathe';
import { createLogger, createServer, normalizePath } from 'vite';

const require = createRequire(import.meta.url);

afterEach(() => vi.unstubAllEnvs());

it.each(['isolated', 'hoisted'])(
  'optimizes Next.js styled-jsx with %s dependencies',
  async (layout) => {
    vi.stubEnv('VITEST', 'false');
    const { default: nextPlugin } = await import('./index.ts');
    const root = await mkdtemp(join(tmpdir(), 'storybook-nextjs-optimizer-'));
    const nextRequire = createRequire(require.resolve('next/package.json'));
    const logger = createLogger();
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    try {
      await mkdir(join(root, 'node_modules'));
      await writeFile(
        join(root, 'package.json'),
        JSON.stringify({ private: true, type: 'module' })
      );
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
      } else {
        expect(await readdir(join(root, 'node_modules'))).not.toContain('styled-jsx');
      }

      const server = await createServer({
        configFile: false,
        root,
        customLogger: logger,
        plugins: [nextPlugin({ dir: root })],
        optimizeDeps: { force: true, noDiscovery: true, holdUntilCrawlEnd: false },
        server: { middlewareMode: true, watch: null, hmr: false },
      });
      try {
        expect(server.config.plugins.map(({ name }) => name)).toContain(
          'vite-plugin-storybook-nextjs'
        );
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
          'Failed to resolve dependency: styled-jsx'
        );
      } finally {
        await server.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
);
