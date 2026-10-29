import * as fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fs as memoryFs, vol } from 'memfs';
import { join, resolve } from 'pathe';
import { build } from 'esbuild';
import type { BuildOptions, BuildResult } from 'esbuild';

import type { ServerApp } from '@storybook/core/internal/types';

import { createStorybook, defineAddon, type Storybook } from 'storybook/internal/instance';
import { createManagerHost } from '@storybook/manager/internal/deep/builder-manager/host';

import { builtInAddons } from '../../features/index.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('esbuild', { spy: true });
vi.mock('sirv', () => ({ default: vi.fn(() => vi.fn()) }));

const INSTANCES: Storybook[] = [];

beforeEach(() => {
  vol.reset();
  vi.spyOn(fs, 'mkdir').mockImplementation(memoryFs.promises.mkdir as typeof fs.mkdir);
  vi.spyOn(fs, 'writeFile').mockImplementation(memoryFs.promises.writeFile as typeof fs.writeFile);
  vi.spyOn(fs, 'rm').mockImplementation(memoryFs.promises.rm as typeof fs.rm);
  vi.spyOn(fs, 'cp').mockResolvedValue(undefined);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline manager host test.')));
});

afterEach(async () => {
  await Promise.all(INSTANCES.splice(0).map((instance) => instance.close()));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('isolates two dev managers, including their entries, output files, hooks, and cancellation', async () => {
  const configs: BuildOptions[] = [];
  const compile = (config: BuildOptions): BuildResult => ({
    errors: [],
    warnings: [],
    metafile: {
      inputs: {},
      outputs: Object.fromEntries(
        (config.entryPoints as string[]).map((entry, index) => [
          join(config.outdir!, index === 0 ? 'manager.js' : `entry-${index}.js`),
          { bytes: 0, inputs: {}, imports: [], exports: [], entryPoint: entry },
        ])
      ),
    },
    mangleCache: undefined,
    outputFiles: (config.entryPoints as string[]).map((_, index) => ({
      path: join(config.outdir!, index === 0 ? 'manager.js' : `entry-${index}.js`),
      contents: new TextEncoder().encode(config.outdir!),
      hash: '',
      text: config.outdir!,
    })),
  });
  let finishSecond: () => void = () => {};
  vi.mocked(build).mockImplementation(async (config) => {
    configs.push(config);
    if (configs.length === 2) {
      await new Promise<void>((resolve) => {
        finishSecond = resolve;
      });
    }
    return compile(config);
  });
  const create = async (fixture: string): Promise<Storybook> => {
    const configDir = fileURLToPath(
      new URL(`../../../../../core/src/instance/__fixtures__/${fixture}`, import.meta.url)
    );
    const main = (await import(`../../../../../core/src/instance/__fixtures__/${fixture}/main.ts`))
      .default;
    const instance = await createStorybook({
      configDir,
      mode: 'dev',
      cliOptions: { outputDir: resolve(`manager-${fixture}`), quiet: true },
      main: {
        ...main,
        addons: [
          defineAddon(() => ({
            meta: { name: `manager-${fixture}` },
            manager: join(configDir, 'addon-manager.ts'),
            setup(storybook): void {
              storybook.hook('manager:title:extend', () => fixture);
              storybook.hook(
                'manager:head:extend',
                () => `<meta name="owner" content="${fixture}">`
              );
              storybook.hook('manager:refs:extend', () => ({}));
              storybook.hook('core:env:extend', (env) => ({ ...env, MANAGER_OWNER: fixture }));
            },
          }))(),
        ],
      },
    });
    INSTANCES.push(instance);
    return instance;
  };
  const [first, second] = await Promise.all([create('first'), create('second')]);
  const firstManager = createManagerHost(first);
  const secondManager = createManagerHost(second);
  const firstRouter = { use: vi.fn() };
  const secondRouter = { use: vi.fn() };
  const host = (router: { use: ReturnType<typeof vi.fn> }) => ({
    router: router as unknown as ServerApp,
    server: {} as Parameters<ReturnType<typeof createManagerHost>['dev']>[0]['server'],
    startTime: process.hrtime(),
  });
  await firstManager.dev(host(firstRouter));
  const secondRun = secondManager.dev(host(secondRouter));
  await vi.waitFor(() => expect(configs).toHaveLength(2));
  const firstBail = firstManager.bail();
  finishSecond();
  const [, secondResult] = await Promise.all([firstBail, secondRun]);
  expect(secondResult).toMatchObject({ bail: expect.any(Function), stats: expect.anything() });

  for (const [index, instance] of [first, second].entries()) {
    const config = configs[index];
    const entries = config.entryPoints as string[];
    const sourceEntries = await Promise.all(
      entries.map((entry) => memoryFs.promises.readFile(entry, 'utf8'))
    );
    expect(sourceEntries.at(-1)).toBe(`import '${join(instance.configDir, 'addon-manager.ts')}';`);
    // One entry per built-in manager, then the configured addon's.
    expect(sourceEntries).toHaveLength(builtInAddons.filter((addon) => addon.manager).length + 1);
    expect(config.outdir).toBe(join(instance.options.outputDir!, 'sb-addons'));
    expect(config.define?.['process.env']).toContain(
      `"MANAGER_OWNER":"${index === 0 ? 'first' : 'second'}"`
    );
    expect(memoryFs.readFileSync(join(config.outdir!, 'manager.js'), 'utf8')).toBe(config.outdir);
  }
  expect(configs[0].entryPoints).not.toEqual(configs[1].entryPoints);
  expect(configs[0].outdir).not.toEqual(configs[1].outdir);

  const response = { setHeader: vi.fn(), write: vi.fn(), end: vi.fn(), statusCode: 0 };
  const root = secondRouter.use.mock.calls.find(([route]) => route === '/');
  root![1]({ url: '/' }, response, vi.fn());
  expect(response.write).toHaveBeenCalledWith(expect.stringContaining('second - Storybook'));
  expect(response.write).toHaveBeenCalledWith(expect.stringContaining('content="second"'));
  await secondManager.dev(host(secondRouter));
  expect(configs).toHaveLength(3);
  await secondManager.build({ startTime: process.hrtime() });
  expect(configs.at(-1)).toMatchObject({ outdir: configs[1].outdir, minify: true });
  expect(memoryFs.readFileSync(join(second.options.outputDir!, 'index.html'), 'utf8')).toContain(
    'second - Storybook'
  );
  await secondManager.bail();
});
