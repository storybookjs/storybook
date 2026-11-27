import { globSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { vol } from 'memfs';
import { join } from 'pathe';
import {
  type FSWatcher,
  type ResolvedConfig,
  type ViteDevServer,
  isFileLoadingAllowed,
} from 'vite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getDistFileCandidate,
  isStorybookPackageName,
  storybookDistSourcemapsPlugin,
} from './storybook-dist-sourcemaps-plugin.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('vite', { spy: true });

beforeEach(async () => {
  const memfs = await vi.importActual<typeof import('memfs')>('memfs');
  vol.reset();
  vi.mocked(readFile).mockImplementation(
    memfs.fs.promises.readFile as unknown as typeof import('node:fs/promises').readFile
  );
  vi.mocked(isFileLoadingAllowed).mockReturnValue(true);
});

describe('getDistFileCandidate', () => {
  it.each([
    [
      'npm',
      '/project/node_modules/storybook/dist/preview/runtime.js?v=fe2ef2c1',
      '/project/node_modules/storybook/dist/preview/runtime.js',
      ['/project/node_modules/storybook'],
    ],
    [
      'pnpm',
      '/project/node_modules/.pnpm/@storybook+react@11.0.0_react@19.0.0/node_modules/@storybook/react/dist/entry-preview.js?v=fe2ef2c1',
      '/project/node_modules/.pnpm/@storybook+react@11.0.0_react@19.0.0/node_modules/@storybook/react/dist/entry-preview.js',
      [
        '/project/node_modules/.pnpm/@storybook+react@11.0.0_react@19.0.0/node_modules/@storybook/react',
      ],
    ],
    [
      'Yarn PnP cache',
      '/project/.yarn/cache/storybook-npm-11.0.0-0a1b2c3d4e-5f6a7b8c9d.zip/node_modules/storybook/dist/preview/runtime.js',
      '/project/.yarn/cache/storybook-npm-11.0.0-0a1b2c3d4e-5f6a7b8c9d.zip/node_modules/storybook/dist/preview/runtime.js',
      [
        '/project/.yarn/cache/storybook-npm-11.0.0-0a1b2c3d4e-5f6a7b8c9d.zip/node_modules/storybook',
      ],
    ],
    [
      'Yarn PnP virtual package',
      '/project/.yarn/__virtual__/@storybook-react-virtual-0a1b2c3d4e/0/cache/@storybook-react-npm-11.0.0-0a1b2c3d4e-5f6a7b8c9d.zip/node_modules/@storybook/react/dist/entry-preview.js',
      '/project/.yarn/__virtual__/@storybook-react-virtual-0a1b2c3d4e/0/cache/@storybook-react-npm-11.0.0-0a1b2c3d4e-5f6a7b8c9d.zip/node_modules/@storybook/react/dist/entry-preview.js',
      [
        '/project/.yarn/__virtual__/@storybook-react-virtual-0a1b2c3d4e/0/cache/@storybook-react-npm-11.0.0-0a1b2c3d4e-5f6a7b8c9d.zip/node_modules/@storybook/react',
      ],
    ],
    [
      'Yarn PnP unplugged package',
      '/project/.yarn/unplugged/storybook-npm-11.0.0-0a1b2c3d4e/node_modules/storybook/dist/preview/runtime.js',
      '/project/.yarn/unplugged/storybook-npm-11.0.0-0a1b2c3d4e/node_modules/storybook/dist/preview/runtime.js',
      ['/project/.yarn/unplugged/storybook-npm-11.0.0-0a1b2c3d4e/node_modules/storybook'],
    ],
    [
      'linked package',
      '/home/dev/storybook/code/core/dist/preview/runtime.js',
      '/home/dev/storybook/code/core/dist/preview/runtime.js',
      ['/home/dev/storybook/code/core'],
    ],
    [
      'Windows',
      'C:/project/node_modules/storybook/dist/preview/runtime.js?v=fe2ef2c1',
      'C:/project/node_modules/storybook/dist/preview/runtime.js',
      ['C:/project/node_modules/storybook'],
    ],
    [
      'Windows with backslashes',
      'C:\\project\\node_modules\\storybook\\dist\\preview\\runtime.js',
      'C:/project/node_modules/storybook/dist/preview/runtime.js',
      ['C:/project/node_modules/storybook'],
    ],
    [
      'nested dist folders',
      '/project/dist/node_modules/storybook/dist/preview/runtime.js',
      '/project/dist/node_modules/storybook/dist/preview/runtime.js',
      ['/project/dist/node_modules/storybook', '/project'],
    ],
  ])('finds the package roots of a %s path', (_, id, file, packageRoots) => {
    expect(getDistFileCandidate(id)).toEqual({ file, packageRoots });
  });

  it.each([
    ['a virtual module', '\0virtual:/@storybook/builder-vite/vite-app.js'],
    ['a virtual module without a null byte', 'virtual:dist/vite-app.js'],
    ['a relative id', 'node_modules/storybook/dist/preview/runtime.js'],
    ['a stylesheet', '/project/node_modules/storybook/dist/theming/index.css'],
    ['a JSON file', '/project/node_modules/storybook/dist/manifest.json'],
    ['an `.mjs` file', '/project/node_modules/storybook/dist/preview/runtime.mjs'],
    ['a file outside a `dist` folder', '/project/node_modules/storybook/internal/index.js'],
    ['a project file', '/project/src/dist.js'],
    ['a `raw` query', '/project/node_modules/storybook/dist/preview/runtime.js?raw'],
    ['a `worker` query', '/project/node_modules/storybook/dist/preview/runtime.js?worker'],
    [
      'a version query with another query',
      '/project/node_modules/storybook/dist/preview/runtime.js?v=fe2ef2c1&url',
    ],
  ])('ignores %s', (_, id) => {
    expect(getDistFileCandidate(id)).toBeUndefined();
  });
});

describe('isStorybookPackageName', () => {
  it.each([
    'storybook',
    '@storybook/react',
    '@storybook/addon-docs',
    'storybook-addon-pseudo-states',
    'vite-plugin-storybook-nextjs',
  ])('matches %s', (name) => {
    expect(isStorybookPackageName(name)).toBe(true);
  });

  it.each(['react', 'my-storybook', 'storybook-addon-designs', '@storybookjs/react', undefined])(
    'does not match %s',
    (name) => {
      expect(isStorybookPackageName(name)).toBe(false);
    }
  );

  it('matches every published package of this repository except the ones the preview never loads', () => {
    const repoRoot = join(import.meta.dirname, '../../../../..');
    const { workspaces } = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf-8'));
    const packageJsonFiles = globSync(
      workspaces.packages.map((pattern: string) => `${pattern}/package.json`),
      { cwd: repoRoot }
    );
    const unmatched = packageJsonFiles
      .map((file) => JSON.parse(readFileSync(join(repoRoot, file), 'utf-8')))
      .filter((packageJson) => !packageJson.private && !isStorybookPackageName(packageJson.name))
      .map((packageJson) => packageJson.name);

    expect(unmatched.sort()).toEqual(['create-storybook', 'eslint-plugin-storybook', 'sb']);
  });
});

describe('storybookDistSourcemapsPlugin', () => {
  const runtime = 'export function setup() {}\n';

  function setup() {
    const plugin = storybookDistSourcemapsPlugin();
    const watcher = { add: vi.fn() };
    (plugin.configResolved as (config: ResolvedConfig) => void)({
      root: '/project',
    } as ResolvedConfig);
    (plugin.configureServer as (server: ViteDevServer) => void)({
      watcher: watcher as unknown as FSWatcher,
    } as ViteDevServer);
    const { handler } = plugin.load as { handler: (id: string) => Promise<unknown> };
    return { plugin, watcher, load: (id: string) => handler.call({}, id) };
  }

  it('gives a Storybook package file an empty sourcemap', async () => {
    vol.fromJSON({
      '/project/node_modules/storybook/package.json': JSON.stringify({ name: 'storybook' }),
      '/project/node_modules/storybook/dist/preview/runtime.js': runtime,
    });

    await expect(
      setup().load('/project/node_modules/storybook/dist/preview/runtime.js?v=fe2ef2c1')
    ).resolves.toEqual({ code: runtime, map: { mappings: '' } });
  });

  it('gives a file of a pnpm-installed Storybook package an empty sourcemap', async () => {
    const root =
      '/project/node_modules/.pnpm/@storybook+react@11.0.0/node_modules/@storybook/react';
    vol.fromJSON({
      [`${root}/package.json`]: JSON.stringify({ name: '@storybook/react' }),
      [`${root}/dist/entry-preview.js`]: runtime,
    });

    await expect(setup().load(`${root}/dist/entry-preview.js?v=fe2ef2c1`)).resolves.toEqual({
      code: runtime,
      map: { mappings: '' },
    });
  });

  it('leaves files of other packages to Vite', async () => {
    vol.fromJSON({
      '/project/node_modules/react-dom/package.json': JSON.stringify({ name: 'react-dom' }),
      '/project/node_modules/react-dom/dist/index.js': runtime,
    });

    await expect(
      setup().load('/project/node_modules/react-dom/dist/index.js?v=fe2ef2c1')
    ).resolves.toBeNull();
  });

  it('leaves the dist folder of the project to Vite', async () => {
    vol.fromJSON({
      '/project/package.json': JSON.stringify({ name: 'my-app' }),
      '/project/dist/index.js': runtime,
    });

    await expect(setup().load('/project/dist/index.js')).resolves.toBeNull();
  });

  it('leaves a dist folder without a readable package.json to Vite', async () => {
    vol.fromJSON({
      '/project/vendor/package.json': '{',
      '/project/vendor/dist/index.js': runtime,
      '/project/other/dist/index.js': runtime,
    });
    const { load } = setup();

    await expect(load('/project/vendor/dist/index.js')).resolves.toBeNull();
    await expect(load('/project/other/dist/index.js')).resolves.toBeNull();
  });

  it('leaves a file that links its own sourcemap to Vite', async () => {
    vol.fromJSON({
      '/project/node_modules/storybook/package.json': JSON.stringify({ name: 'storybook' }),
      '/project/node_modules/storybook/dist/preview/runtime.js': `${runtime}//# sourceMappingURL=runtime.js.map\n`,
    });

    await expect(
      setup().load('/project/node_modules/storybook/dist/preview/runtime.js')
    ).resolves.toBeNull();
  });

  it('leaves a file that Vite may not load, or that does not exist, to Vite', async () => {
    vol.fromJSON({
      '/project/node_modules/storybook/package.json': JSON.stringify({ name: 'storybook' }),
      '/project/node_modules/storybook/dist/preview/runtime.js': runtime,
    });
    const { load } = setup();

    vi.mocked(isFileLoadingAllowed).mockReturnValueOnce(false);
    await expect(
      load('/project/node_modules/storybook/dist/preview/runtime.js')
    ).resolves.toBeNull();
    await expect(load('/project/node_modules/storybook/dist/missing.js')).resolves.toBeNull();
  });

  it('watches a file it loads from outside the root, as Vite does for linked packages', async () => {
    vol.fromJSON({
      '/project/node_modules/storybook/package.json': JSON.stringify({ name: 'storybook' }),
      '/project/node_modules/storybook/dist/preview/runtime.js': runtime,
      '/home/dev/storybook/code/core/package.json': JSON.stringify({ name: 'storybook' }),
      '/home/dev/storybook/code/core/dist/preview/runtime.js': runtime,
    });
    const { load, watcher } = setup();

    await load('/project/node_modules/storybook/dist/preview/runtime.js');
    expect(watcher.add).not.toHaveBeenCalled();

    await load('/home/dev/storybook/code/core/dist/preview/runtime.js');
    expect(watcher.add).toHaveBeenCalledWith(
      '/home/dev/storybook/code/core/dist/preview/runtime.js'
    );
  });

  it('applies to the dev server only, and only to modules served to the browser', () => {
    const { plugin } = setup();
    const applyToEnvironment = plugin.applyToEnvironment as (environment: {
      config: { consumer: string };
    }) => boolean;

    expect(plugin.apply).toBe('serve');
    expect(applyToEnvironment({ config: { consumer: 'client' } })).toBe(true);
    expect(applyToEnvironment({ config: { consumer: 'server' } })).toBe(false);
  });
});
