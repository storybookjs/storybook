import * as fs from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { vol } from 'memfs';

import { analyzeReactDomShimWorkspace } from './react-dom-shim-workspace.ts';

vi.mock('node:fs/promises', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(fs.readFile).mockImplementation(vol.promises.readFile as typeof fs.readFile);
  vi.mocked(fs.readdir).mockImplementation(vol.promises.readdir as typeof fs.readdir);
  vi.mocked(fs.lstat).mockImplementation(vol.promises.lstat as typeof fs.lstat);
  vi.mocked(fs.realpath).mockImplementation(vol.promises.realpath as typeof fs.realpath);
  vi.mocked(fs.writeFile).mockImplementation(vol.promises.writeFile as typeof fs.writeFile);
});

afterEach(() => vi.restoreAllMocks());

const packageJson = (dependencies: Record<string, string>) =>
  `${JSON.stringify({ private: true, dependencies }, null, 2)}\n`;

describe('analyzeReactDomShimWorkspace', () => {
  it('plans config and manifest edits, then is idempotent after the plan is applied', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/.storybook/main.ts':
        "export default { addons: ['@storybook/react-dom-shim/preset'] };\n",
      '/project/vite.config.ts':
        "export default { resolve: { alias: { '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-16' } } };\n",
    });

    const result = await analyzeReactDomShimWorkspace('/project/.storybook');

    expect(result).toMatchObject({ kind: 'safe', workspaceRoot: '/project' });
    if (result.kind !== 'safe') throw new Error('expected a safe plan');
    expect(result.edits.map((edit) => edit.replacement)).toMatchInlineSnapshot(`[
  "export default { addons: [] };\n",
  "{\n  \"private\": true,\n  \"dependencies\": {\n    \"react\": \"19.1.1\",\n    \"react-dom\": \"19.1.1\"\n  }\n}\n",
  "export default { resolve: { alias: {} } };\n",
]`);
    for (const edit of result.edits) await fs.writeFile(edit.filePath, edit.replacement);
    expect(await analyzeReactDomShimWorkspace('/project')).toMatchInlineSnapshot(`
      {
        "applicable": false,
        "kind": "none",
        "workspaceRoot": "/project",
      }
    `);
  });

  it('refuses direct consumers and dynamic config without returning partial edits', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ private: true, workspaces: ['packages/*'], dependencies: { react: '19.1.1', 'react-dom': '19.1.1' } })}\n`,
      '/project/packages/consumer/package.json': packageJson({
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/packages/consumer/src/index.ts':
        "import { renderElement } from '@storybook/react-dom-shim';\n",
      '/project/packages/config/package.json': packageJson({}),
      '/project/packages/config/vitest.config.ts':
        "const name = ['@storybook', 'react-dom-shim'].join('/'); export default { resolve: { alias: { [name]: name } } };\n",
    });

    expect(await analyzeReactDomShimWorkspace('/project/packages/consumer')).toMatchInlineSnapshot(`
      {
        "diagnostics": [
          "/project/packages/config/vitest.config.ts: contains computed configuration that cannot be removed safely",
          "/project/packages/consumer/src/index.ts: contains a react-dom-shim import, re-export, or module load",
        ],
        "kind": "manual",
        "manifests": [
          "/project/package.json",
          "/project/packages/config/package.json",
          "/project/packages/consumer/package.json",
        ],
        "sources": [
          "/project/packages/config/vitest.config.ts",
          "/project/packages/consumer/src/index.ts",
        ],
        "workspaceRoot": "/project",
      }
    `);
  });

  it('refuses incomplete scans, nested workspaces, and unsupported React ranges', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ private: true, workspaces: ['packages/*'], dependencies: { react: '17.0.2', 'react-dom': '17.0.2' } })}\n`,
      '/project/packages/app/package.json': packageJson({ '@storybook/react-dom-shim': '10.5.10' }),
      '/project/packages/app/.storybook/main.ts':
        "export default { addons: ['@storybook/react-dom-shim/preset'] };\n",
      '/project/packages/app/nested/package.json': `${JSON.stringify({ workspaces: { packages: ['*'] } })}\n`,
    });

    expect(await analyzeReactDomShimWorkspace('/project/packages/app')).toMatchInlineSnapshot(`
      {
        "diagnostics": [
          "/project/packages/app/.storybook/main.ts: react and react-dom must both support React 18 or later",
          "/project/packages/app/nested/package.json: nested workspace declarations are not supported",
          "/project/packages/app/package.json: react and react-dom must both support React 18 or later",
        ],
        "kind": "manual",
        "manifests": [
          "/project/package.json",
          "/project/packages/app/nested/package.json",
          "/project/packages/app/package.json",
        ],
        "sources": [
          "/project/packages/app/.storybook/main.ts",
        ],
        "workspaceRoot": "/project",
      }
    `);
  });

  it('refuses when the workspace traversal cannot read a directory', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ '@storybook/react-dom-shim': '10.5.10' }),
      '/project/src/index.ts': 'export {};\n',
    });
    vi.mocked(fs.readdir).mockImplementation(async (path, options) => {
      if (path === '/project/src') throw new Error('permission denied');
      return vol.promises.readdir(path, options) as ReturnType<typeof fs.readdir>;
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: ['/project: scan was incomplete'],
    });
  });

  it('refuses shim consumers from package subpaths and user dist files', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/src/require.cjs': "require.resolve('@storybook/react-dom-shim/dist/react-16');\n",
      '/project/dist/consumer.mjs':
        "export { renderElement } from '@storybook/react-dom-shim/dist/react-16';\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/src/require.cjs: contains a react-dom-shim import, re-export, or module load',
        '/project/dist/consumer.mjs: contains a react-dom-shim import, re-export, or module load',
      ]),
    });
  });

  it('refuses an explicit unsupported child React range without falling back to the root', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ private: true, workspaces: ['packages/*'], dependencies: { react: '19.1.1', 'react-dom': '19.1.1' } })}\n`,
      '/project/packages/app/package.json': `${JSON.stringify({ dependencies: { react: '^17.0.2', 'react-dom': '^17.0.2', '@storybook/react-dom-shim': '10.5.10' } })}\n`,
    });

    await expect(analyzeReactDomShimWorkspace('/project/packages/app')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: [
        '/project/packages/app/package.json: react and react-dom must both support React 18 or later',
      ],
    });
  });

  it('refuses invalid child React ranges with file-specific guidance', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ private: true, workspaces: ['packages/*'], dependencies: { react: '19.1.1', 'react-dom': '19.1.1' } })}\n`,
      '/project/packages/app/package.json': `${JSON.stringify({ dependencies: { react: 'not-a-range', 'react-dom': '^19.0.0', '@storybook/react-dom-shim': '10.5.10' } })}\n`,
    });

    await expect(analyzeReactDomShimWorkspace('/project/packages/app')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: [
        '/project/packages/app/package.json: react and react-dom must both support React 18 or later',
      ],
    });
  });

  it('discovers pnpm workspace siblings and MDX consumers', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ react: '19.1.1', 'react-dom': '19.1.1' }),
      '/project/pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
      '/project/packages/app/package.json': packageJson({ '@storybook/react-dom-shim': '10.5.10' }),
      '/project/packages/docs/guide.mdx':
        "import { renderElement } from '@storybook/react-dom-shim/react-16';\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project/packages/app')).resolves.toMatchObject({
      kind: 'manual',
      workspaceRoot: '/project',
      diagnostics: [
        '/project/packages/docs/guide.mdx: contains a react-dom-shim import, re-export, or module load',
      ],
    });
  });

  it('refuses unsupported pnpm workspace declarations', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ react: '19.1.1', 'react-dom': '19.1.1' }),
      '/project/pnpm-workspace.yaml': 'packages: packages/*\n',
      '/project/packages/app/package.json': packageJson({ '@storybook/react-dom-shim': '10.5.10' }),
    });

    await expect(analyzeReactDomShimWorkspace('/project/packages/app')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: ['/project/packages/app: no supported package.json workspace root was found'],
    });
  });

  it('matches workspace double-star patterns without treating nested packages as external', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ private: true, workspaces: ['packages/**'], dependencies: { react: '19.1.1', 'react-dom': '19.1.1' } })}\n`,
      '/project/packages/nested/app/package.json': packageJson({
        '@storybook/react-dom-shim': '10.5.10',
      }),
    });

    await expect(
      analyzeReactDomShimWorkspace('/project/packages/nested/app')
    ).resolves.toMatchObject({ kind: 'safe' });
  });

  it('returns a config-only safe plan when React support is established', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ react: '19.1.1', 'react-dom': '19.1.1' }),
      '/project/.storybook/main.ts':
        "export default { addons: ['@storybook/react-dom-shim/preset'] };\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'safe',
      edits: [
        {
          filePath: '/project/.storybook/main.ts',
          original: "export default { addons: ['@storybook/react-dom-shim/preset'] };\n",
          replacement: 'export default { addons: [] };\n',
        },
      ],
    });
  });

  it('refuses TypeScript external module references and computed require resolution', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/src/external.ts': "import shim = require('@storybook/react-dom-shim');\n",
      '/project/src/resolve.cjs': "require['resolve']('@storybook/react-dom-shim');\n",
      '/project/src/optional.cjs':
        "require['resolve']?.('@storybook/react-dom-shim'); require?.['resolve']('@storybook/react-dom-shim');\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/src/external.ts: contains a react-dom-shim import, re-export, or module load',
        '/project/src/resolve.cjs: contains a react-dom-shim import, re-export, or module load',
        '/project/src/optional.cjs: contains a react-dom-shim import, re-export, or module load',
      ]),
    });
  });

  it('refuses conflicting React ranges from every dependency section', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ devDependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' }, peerDependencies: { react: '^17.0.0', 'react-dom': '^17.0.0', '@storybook/react-dom-shim': '10.5.10' } })}\n`,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: [
        '/project/package.json: react and react-dom must both support React 18 or later',
      ],
    });
  });

  it('returns none for non-React projects without shim usage', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ vue: '^3.5.0' }),
      '/project/.storybook/main.ts': "export default { framework: '@storybook/vue3-vite' };\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchInlineSnapshot(`
      {
        "applicable": false,
        "kind": "none",
        "workspaceRoot": "/project",
      }
    `);
  });

  it('returns none for a Vue project when only unsupported files are present', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ vue: '^3.5.0' }),
      '/project/.gitignore': 'node_modules\n',
      '/project/src/App.vue': '<template><main /></template>\n',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchInlineSnapshot(`
      {
        "applicable": false,
        "kind": "none",
        "workspaceRoot": "/project",
      }
    `);
  });

  it('returns none when pnpm metadata contains an unrelated Storybook package path', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ vue: '^3.5.0' }),
      '/project/pnpm-workspace.yaml': 'packages:\n  - packages/@storybook/*\n',
      '/project/packages/@storybook/plugin/package.json': packageJson({ vue: '^3.5.0' }),
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchInlineSnapshot(`
      {
        "applicable": false,
        "kind": "none",
        "workspaceRoot": "/project",
      }
    `);
  });

  it('refuses a removable config when unrelated code execution blocks its analysis', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ vue: '^3.5.0' }),
      '/project/.storybook/main.ts':
        "const value = eval('1'); export default { addons: ['@storybook/react-dom-shim/preset'], value };\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: ['/project/.storybook/main.ts: contains unresolved code execution'],
    });
  });

  it('refuses a shim consumer in a Vue script block without a shim dependency', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ vue: '^3.5.0' }),
      '/project/src/App.vue':
        "<script setup>\nimport shim from '@storybook/react-dom-shim';\n</script>\n<template><main /></template>\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/src/App.vue: contains a react-dom-shim import, re-export, or module load',
      ]),
    });
  });

  it('refuses a shim consumer in HTML after an unrelated HTML blocker', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ vue: '^3.5.0' }),
      '/project/index.html':
        '<!doctype html><html><head><base href="/"></head><body><script type="module">import "@storybook/react-dom-shim";</script></body></html>\n',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/index.html: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it('returns none when an incomplete scan has no migration signal', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ vue: '^3.5.0' }),
      '/project/readme.txt': 'Vue application\n',
    });
    await vol.promises.symlink('/project/readme.txt', '/project/linked.txt');

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchInlineSnapshot(`
      {
        "applicable": false,
        "kind": "none",
        "workspaceRoot": "/project",
      }
    `);
  });

  it('refuses a direct consumer without a shim dependency after migration becomes applicable', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ vue: '^3.5.0' }),
      '/project/.gitignore': 'node_modules\n',
      '/project/src/consumer.ts': "import shim from '@storybook/react-dom-shim';\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/.gitignore: unsupported file type cannot be scanned safely',
        '/project/src/consumer.ts: contains a react-dom-shim import, re-export, or module load',
      ]),
    });
  });

  it('refuses a direct consumer after an unresolved loader without a shim dependency', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ vue: '^3.5.0' }),
      '/project/src/consumer.cjs':
        "const name = getName(); require(name); require('@storybook/react-dom-shim');\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: [
        '/project/src/consumer.cjs: contains a react-dom-shim import, re-export, or module load',
      ],
    });
  });

  it('does not treat known non-loader require members as module loads', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ vue: '^3.5.0' }),
      '/project/src/require.cjs': "require.hasOwnProperty('resolve');\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({ kind: 'none' });
  });

  it('refuses shim references loaded through createRequire aliases', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/src/load.mjs':
        "import { createRequire } from 'node:module';\nconst load = createRequire(import.meta.url);\nload('@storybook/react-dom-shim');\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/src/load.mjs: contains a react-dom-shim import, re-export, or module load',
      ]),
    });
  });

  it('refuses unresolved arguments passed through CommonJS and ESM loader aliases', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/src/commonjs.cjs':
        "const { createRequire } = require('node:module');\nconst load = createRequire(__filename);\nconst name = ['@storybook', 'react-dom-shim'].join('/');\nload(name);\n",
      '/project/src/assigned.cjs':
        "const load = require;\nconst name = ['@storybook', 'react-dom-shim'].join('/');\nload(name);\n",
      '/project/src/esm.mjs':
        "import { createRequire } from 'node:module';\nconst load = createRequire(import.meta.url);\nconst name = ['@storybook', 'react-dom-shim'].join('/');\nload(name);\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/src/assigned.cjs: contains an unresolved module load',
        '/project/src/commonjs.cjs: contains an unresolved module load',
        '/project/src/esm.mjs: contains an unresolved module load',
      ]),
    });
  });
});
