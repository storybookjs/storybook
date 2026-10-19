import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

import type { Options } from 'storybook/internal/types';

import { dirname, join } from 'pathe';
import { createBuilder, createServer, type InlineConfig, type Rollup } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('storybook/internal/preview/globals', { spy: true });

import { previewRuntimePath } from '../utils/preview-runtime-path.ts';
import { bundlerOptionsKey } from '../utils/vite-features.ts';
import {
  ensurePreviewRuntimePrecedesGlobals,
  rewriteImport,
  storybookExternalGlobalsPlugin,
} from './storybook-external-globals-plugin.ts';

const packageName = '@storybook/package';
const globals = { [packageName]: '_STORYBOOK_PACKAGE_' };

const cases = [
  {
    globals,
    packageName,
    input: `import { Rain, Jour as Day, Nuit as Night, Sun } from "${packageName}"`,
    output: `const { Rain, Jour: Day, Nuit: Night, Sun } = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import {
      Rain,
      Jour as Day,
      Nuit as Night,
      Sun
    } from "${packageName}"`,
    output: `const {
      Rain,
      Jour: Day,
      Nuit: Night,
      Sun
    } = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import * as Foo from "${packageName}"`,
    output: `const Foo = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import Foo from "${packageName}"`,
    output: `const {default: Foo} = ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import {} from "${packageName}"`,
    output: `void ${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `import {} from "${packageName}";`,
    output: `void ${globals[packageName]};`,
  },
  {
    globals,
    packageName,
    input: `import '${packageName}';`,
    output: `void ${globals[packageName]};`,
  },
  {
    globals,
    packageName,
    input: `import{Rain,Jour as Day,Nuit as Night,Sun}from'${packageName}'`,
    output: `const {Rain,Jour: Day,Nuit: Night,Sun} =${globals[packageName]}`,
  },
  {
    globals,
    packageName,
    input: `const { Afternoon } = await import('${packageName}')`,
    output: `const { Afternoon } = ${globals[packageName]}`,
  },
];

it('calls preview setup before a rewritten global', () => {
  const code = ensurePreviewRuntimePrecedesGlobals(
    'const { Channel } = __STORYBOOK_MODULE_CHANNELS__;',
    '/proj/src/preview.ts'
  );

  expect(code).toContain('dist/preview/runtime.js');
  expect(code.indexOf('__sbInitializePreviewGlobals();')).toBeLessThan(
    code.indexOf('__STORYBOOK_MODULE_CHANNELS__')
  );
});

it('does not import the runtime from the bundled preview runtime', () => {
  const code = 'const { Channel } = __STORYBOOK_MODULE_CHANNELS__;';
  expect(
    ensurePreviewRuntimePrecedesGlobals(code, '/pkg/dist/preview/_chunks/runtime-abc.js')
  ).toBe(code);
  expect(
    ensurePreviewRuntimePrecedesGlobals(code, 'C:\\pkg\\dist\\preview\\_chunks\\runtime-abc.js?v=1')
  ).toBe(code);
});

it('rewriteImport', () => {
  cases.forEach(({ input, output, globals: caseGlobals, packageName: casePackage }) => {
    expect(rewriteImport(input, caseGlobals, casePackage)).toStrictEqual(output);
  });
});

describe('environments', () => {
  const options = { presets: { apply: async () => undefined } } as unknown as Options;
  const storybookPath = dirname(createRequire(import.meta.url).resolve('storybook/package.json'));
  let root: string;

  beforeAll(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'sb-external-globals-')));
    await mkdir(join(root, 'node_modules/dependency'), { recursive: true });
    await symlink(storybookPath, join(root, 'node_modules/storybook'), 'junction');
    await writeFile(
      join(root, 'node_modules/dependency/package.json'),
      JSON.stringify({ name: 'dependency', version: '1.0.0', type: 'module', main: 'index.js' })
    );
    await writeFile(
      join(root, 'node_modules/dependency/index.js'),
      `import { expect } from 'storybook/test';\nexport { expect };\n`
    );
    await writeFile(
      join(root, 'story.js'),
      `import { expect } from 'storybook/test';\nexport { expect };\n`
    );
    await writeFile(join(root, 'dependent.js'), `export { expect } from 'dependency';\n`);
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  const config = async (): Promise<InlineConfig> => ({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [await storybookExternalGlobalsPlugin(options)],
    // A second browser environment, as a plugin may add
    environments: {
      client: {},
      other: { consumer: 'client', optimizeDeps: { noDiscovery: true } },
    },
  });

  it("in dev, resolves the preview environment's imports to the globals, and no other", async () => {
    const server = await createServer({
      ...(await config()),
      appType: 'custom',
      cacheDir: join(root, 'node_modules/.vite'),
      server: { middlewareMode: true, ws: false },
      optimizeDeps: { noDiscovery: true, include: ['dependency'] },
    });
    try {
      const { client, other } = server.environments;
      const importer = join(root, 'story.js');

      const stub = await client.pluginContainer.resolveId('storybook/test', importer);
      expect(stub?.id).toMatch(/sb-vite-plugin-externals[/\\]storybook[/\\]test\.js(\?|$)/);
      const story = await client.transformRequest('/story.js');
      expect(story?.code).toContain('__STORYBOOK_MODULE_TEST__');
      expect(story?.code).toContain('preview/runtime.js');

      // The optimizer pre-bundles a dependency with the stub, not with the package
      const dependent = await client.transformRequest('/dependent.js');
      const [, optimized] =
        dependent?.code.match(/from "([^"]*\.vite\/deps\/dependency\.js[^"]*)"/) ?? [];
      expect(optimized).toBeDefined();
      const dependency = await client.transformRequest(optimized);
      expect(dependency?.code).toContain('module.exports = __STORYBOOK_MODULE_TEST__');

      const resolved = await other.pluginContainer.resolveId('storybook/test', importer);
      expect(resolved?.id).toBe(join(storybookPath, 'dist/test/index.js'));
      const otherStory = await other.transformRequest('/story.js');
      expect(otherStory?.code).not.toContain('__STORYBOOK_MODULE_TEST__');
      expect(otherStory?.code).not.toContain('preview/runtime.js');
    } finally {
      await server.close();
    }
  });

  it("in a build, rewrites the preview environment's imports to the globals, and no other", async () => {
    const builder = await createBuilder({
      ...(await config()),
      build: {
        write: false,
        [bundlerOptionsKey]: {
          input: join(root, 'story.js'),
          external: ['storybook/test', previewRuntimePath],
        },
      },
    });
    const code = async (name: 'client' | 'other') => {
      const output = (await builder.build(builder.environments[name])) as Rollup.RollupOutput;
      return output.output[0].code;
    };

    const client = await code('client');
    expect(client).toContain('__STORYBOOK_MODULE_TEST__');
    expect(client).toContain(previewRuntimePath);
    const other = await code('other');
    expect(other).not.toContain('__STORYBOOK_MODULE_TEST__');
    expect(other).not.toContain(previewRuntimePath);
    expect(other).toContain('storybook/test');
  });
});
