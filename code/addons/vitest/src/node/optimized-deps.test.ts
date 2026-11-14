import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TestProject, TestSpecification } from 'vitest/node';

import { dirname, join } from 'pathe';
import { type ViteDevServer, createServer } from 'vite';

import { optimizeTestDependencies, watchOptimizedDeps } from './optimized-deps.ts';

// Vite does not pre-bundle what files inside node_modules import, so the fixture lives outside the
// repository and links the two packages it uses.
let root: string;
const require = createRequire(import.meta.url);
const packageDir = (name: string) => dirname(require.resolve(`${name}/package.json`));

const servers: ViteDevServer[] = [];

/** A Vite server like the one Vitest's browser mode starts for a project. */
async function startServer() {
  const server = await createServer({
    root,
    configFile: false,
    cacheDir: join(root, '.vite'),
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null },
    // Scanning for dependencies only happens with a cold cache, so keep it off for both servers:
    // the tests below care about what happens with a warm cache.
    optimizeDeps: { entries: [] },
  });
  servers.push(server);
  return server;
}

const projectOf = (server: ViteDevServer) =>
  ({
    config: { setupFiles: [] },
    browser: { vite: server },
  }) as unknown as TestProject;

const specificationOf = (project: TestProject, file: string) =>
  ({ project, moduleId: join(root, file) }) as TestSpecification;

const optimizerOf = (server: ViteDevServer) => server.environments.client.depsOptimizer!;

/** Waits until Vite has crawled what was requested and pre-bundled what it found. */
async function settle(server: ViteDevServer) {
  const environment = server.environments.client;
  await environment.waitForRequestsIdle();
  await Promise.all(
    Object.values(optimizerOf(server).metadata.discovered).map((dep) => dep.processing)
  );
}

describe('optimizeTestDependencies', () => {
  beforeEach(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'sb-optimized-deps-')));
    await mkdir(join(root, 'node_modules'));
    for (const name of ['react', 'react-dom']) {
      await symlink(packageDir(name), join(root, 'node_modules', name), 'junction');
    }
    await writeFile(join(root, 'existing.stories.js'), `import 'react';\n`);
    await writeFile(join(root, 'Card.js'), `import 'react-dom';\n`);
    await writeFile(join(root, 'Card.stories.js'), `import './Card.js';\n`);

    // An earlier run, before Card.stories.js existed: the cache holds only `react`.
    const earlier = await startServer();
    await optimizeTestDependencies([specificationOf(projectOf(earlier), 'existing.stories.js')]);
    expect(Object.keys(optimizerOf(earlier).metadata.optimized)).toEqual(['react']);
    await earlier.close();
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    await rm(root, { recursive: true, force: true });
  });

  it('without it, a new story file makes Vite re-bundle dependencies the browser already loaded', async () => {
    const server = await startServer();
    const reoptimized = watchOptimizedDeps([projectOf(server)]);

    // The browser loads the new story file during the run.
    await server.environments.client.warmupRequest('/Card.stories.js');
    await settle(server);

    expect(optimizerOf(server).metadata.optimized).toHaveProperty('react-dom');
    expect(reoptimized()).toBe(true);
  });

  it('pre-bundles what a new story file imports before the tests run', async () => {
    const server = await startServer();
    const project = projectOf(server);

    await optimizeTestDependencies([specificationOf(project, 'Card.stories.js')]);
    expect(optimizerOf(server).metadata.optimized).toHaveProperty('react-dom');

    // The run itself then finds nothing new.
    const reoptimized = watchOptimizedDeps([project]);
    await server.environments.client.warmupRequest('/Card.stories.js');
    await settle(server);
    expect(reoptimized()).toBe(false);
  });

  it('pre-bundles what a new story file imports on a server that already ran tests', async () => {
    // Storybook keeps Vitest, and its Vite server, running between runs. Vite's own wait for
    // requests to settle only covers the first crawl after the server starts.
    const server = await startServer();
    const project = projectOf(server);
    await optimizeTestDependencies([specificationOf(project, 'existing.stories.js')]);
    await server.environments.client.waitForRequestsIdle();

    await optimizeTestDependencies([specificationOf(project, 'Card.stories.js')]);

    expect(optimizerOf(server).metadata.optimized).toHaveProperty('react-dom');
  });

  it('follows dynamic imports', async () => {
    await writeFile(
      join(root, 'Lazy.stories.js'),
      `export const load = () => import('./Card.js');\n`
    );
    const server = await startServer();

    await optimizeTestDependencies([specificationOf(projectOf(server), 'Lazy.stories.js')]);

    expect(optimizerOf(server).metadata.optimized).toHaveProperty('react-dom');
  });

  it('includes the setup files', async () => {
    const server = await startServer();
    const project = projectOf(server);
    project.config.setupFiles = [join(root, 'Card.js')];

    await optimizeTestDependencies([specificationOf(project, 'existing.stories.js')]);

    expect(optimizerOf(server).metadata.optimized).toHaveProperty('react-dom');
  });

  it('does nothing for a project without a browser server', async () => {
    const project = { config: { setupFiles: [] } } as unknown as TestProject;

    await expect(
      optimizeTestDependencies([specificationOf(project, 'Card.stories.js')])
    ).resolves.toBeUndefined();
    expect(watchOptimizedDeps([project])()).toBe(false);
  });
});
