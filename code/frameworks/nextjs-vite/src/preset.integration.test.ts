import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

import { afterAll, expect, it, onTestFinished, vi } from 'vitest';

import { basename, dirname, join } from 'pathe';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);

// The plugin captures VITEST on import; exercise the Storybook browser configuration.
vi.stubEnv('VITEST', 'false');
const { optimizeViteDeps, viteFinal } = await import('./preset.ts');

afterAll(() => vi.unstubAllEnvs());

// Cold Next.js/Vite startup must finish before the optimizer assertions time out.
it('prebundles styled-jsx before transforming the first styled story', async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), 'storybook-nextjs-preset-'));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'node_modules'));
  await writeFile(join(root, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  for (const dependency of ['@storybook/nextjs-vite', 'next', 'react', 'react-dom']) {
    const target = join(root, 'node_modules', dependency);
    await mkdir(dirname(target), { recursive: true });
    await symlink(dirname(require.resolve(`${dependency}/package.json`)), target, 'junction');
  }
  await writeFile(
    join(root, 'story.tsx'),
    'export default () => <p>Styled story<style jsx>{`p { color: red; }`}</style></p>;'
  );
  const config = await viteFinal!(
    {
      configFile: false,
      root,
      optimizeDeps: { entries: [join(root, 'story.tsx')], include: optimizeViteDeps },
      server: { middlewareMode: true, watch: null, ws: false },
    },
    {
      presets: {
        apply: async (name: string) =>
          name === 'features'
            ? { docgenServer: true }
            : { nextConfigPath: join(root, 'next.config.js') },
      },
    } as Parameters<NonNullable<typeof viteFinal>>[1]
  );
  const server = await createServer(config);
  onTestFinished(() => server.close());
  const optimizer = server.environments.client.depsOptimizer!;
  await optimizer.scanProcessing;
  await expect
    .poll(() => Object.keys(optimizer.metadata.optimized).length, { timeout: 5000 })
    .toBeGreaterThan(0);
  const optimized = optimizer.metadata.optimized;
  expect(optimized['styled-jsx']).toBeDefined();
  expect(optimized['styled-jsx/style']).toBeDefined();
  const send = vi.spyOn(server.environments.client.hot, 'send');
  const transformed = await server.transformRequest('/story.tsx');
  expect(transformed?.code).toContain(basename(optimized['styled-jsx/style'].file));
  expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'full-reload' }));
}, 30_000);
