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
    });
    vi.mocked(fs.readdir).mockRejectedValueOnce(new Error('permission denied'));

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
        "kind": "none",
        "workspaceRoot": "/project",
      }
    `);
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

  it('refuses shim aliases in unsupported webpack configuration', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/webpack.config.js':
        "module.exports = { resolve: { alias: { '@storybook/react-dom-shim': '@storybook/react-dom-shim/dist/react-16' } } };\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/webpack.config.js: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it('refuses concatenated shim references and manifest import maps', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ dependencies: { react: '19.1.1', 'react-dom': '19.1.1', '@storybook/react-dom-shim': '10.5.10' }, imports: { '#shim': '@storybook/react-dom-shim/react-16' } })}\n`,
      '/project/src/load.mjs':
        "import { createRequire } from 'node:module';\nconst load = createRequire(import.meta.url);\nload('@storybook/' + 'react-dom-shim');\n",
      '/project/.storybook/main.ts':
        "export default { addons: ['@storybook/' + 'react-dom-shim/preset'] };\n",
      '/project/tsconfig.json': `${JSON.stringify({ compilerOptions: { paths: { '@storybook/react-dom-shim': ['@storybook/react-dom-shim/dist/react-16'] } } })}\n`,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/package.json: contains a react-dom-shim reference that cannot be removed safely',
        '/project/.storybook/main.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/src/load.mjs: contains a react-dom-shim import, re-export, or module load',
        '/project/tsconfig.json: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it('refuses shim references in manifest keys, dependency aliases, and static config expressions', async () => {
    vol.fromNestedJSON({
      '/project/package.json': `${JSON.stringify({ dependencies: { react: '19.1.1', 'react-dom': '19.1.1', '@storybook/react-dom-shim': '10.5.10', legacyShim: 'npm:@storybook/react-dom-shim@10.5.10' }, browser: { '@storybook/react-dom-shim': false } })}\n`,
      '/project/webpack.config.js':
        "module.exports = { resolve: { alias: { shim: '@storybook/' + 'react-dom-shim' } } };\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/package.json: contains a react-dom-shim reference that cannot be removed safely',
        '/project/webpack.config.js: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it('refuses residual static shim expressions in configs and source without partial edits', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/.storybook/main.ts':
        "export default { addons: ['@storybook/react-dom-shim/preset'], resolve: { alias: { shim: '@storybook/' + 'react-dom-shim' } } };\n",
      '/project/vite.config.ts':
        "export default { resolve: { alias: { '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-16', shim: `@storybook/react-dom-shim` } } };\n",
      '/project/vitest.config.ts':
        "export default { resolve: { alias: { shim: '@storybook/' + 'react-dom-shim' } } };\n",
      '/project/src/shim.ts': "export const shim = '@storybook/' + 'react-dom-shim';\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/.storybook/main.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/vite.config.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/vitest.config.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/src/shim.ts: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it('refuses static template shim references in source and config without partial edits', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/src/loader.ts': "export const shim = `${'@storybook/'}react-dom-shim`;\n",
      '/project/vite.config.ts':
        "export default { resolve: { alias: { shim: `${'@storybook/'}react-dom-shim` } } };\n",
      '/project/.storybook/main.ts':
        "export default { addons: ['@storybook/react-dom-shim/preset'], shim: `${'@storybook/'}react-dom-shim` };\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        '/project/src/loader.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/vite.config.ts: contains a react-dom-shim reference that cannot be removed safely',
        '/project/.storybook/main.ts: contains a react-dom-shim reference that cannot be removed safely',
      ]),
    });
  });

  it.each([
    ['tsconfig.json', '{"compilerOptions":{"paths":{"\\u0040storybook/react-dom-shim":["shim"]}}}'],
    [
      'tsconfig.json',
      '{\n  // Compatibility alias\n  "compilerOptions": { "paths": { "shim": ["\\u0040storybook/react-dom-shim"] } }\n}',
    ],
    [
      'tsconfig.jsonc',
      '{\n  // Compatibility alias\n  "compilerOptions": { "paths": { "shim": ["@storybook/react-dom-shim"] } }\n}',
    ],
    ['tsconfig.json', '{"__proto__":{"alias":"\\u0040storybook/react-dom-shim"}}'],
  ])('refuses decoded shim aliases in %s', async (fileName, config) => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      [`/project/${fileName}`]: config,
      '/project/src/index.ts': "import { renderElement } from 'shim';\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: expect.arrayContaining([
        `/project/${fileName}: contains a react-dom-shim reference that cannot be removed safely`,
      ]),
    });
  });

  it('refuses malformed JSONC data files', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/tsconfig.jsonc': '{"compilerOptions": 0x10}',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: [
        '/project/tsconfig.jsonc: cannot parse data configuration during workspace scan',
      ],
    });
  });

  it('refuses duplicate JSON keys when an earlier value references the shim', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/tsconfig.json': '{"alias":"@storybook/react-dom-shim","alias":"other"}',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      diagnostics: [
        '/project/tsconfig.json: contains a react-dom-shim reference that cannot be removed safely',
      ],
    });
  });

  it('does not reject valid JSON data arrays without shim references', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/data.json': '[]',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'safe',
    });
  });

  it('supports ordinary Vite HTML while scanning executable HTML positions', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/index.html': '<!doctype html><div id="root"></div><script type="module" src="/src/main.ts"></script>\n',
      '/project/src/main.ts': "export const name = 'app';\n",
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'safe',
    });
  });

  it.each([
    ['external module entry', '<script type="module" src="@storybook/react-dom-shim/react-16"></script>'],
    ['inline module import', '<script type="module">import shim from \'@storybook/react-dom-shim\';</script>'],
    ['inline dynamic load', '<script>import(\'@storybook/react-dom-shim\')</script>'],
    ['import map value', '<script type="importmap">{"imports":{"shim":"@storybook/react-dom-shim"}}</script>'],
    ['templated executable value', '<script type="module" src="%VITE_ENTRY%"></script>'],
    ['malformed inline JavaScript', '<script type="module">import {</script>'],
  ])('refuses %s in HTML', async (_name, html) => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/index.html': html,
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      sources: expect.arrayContaining(['/project/index.html']),
      diagnostics: expect.arrayContaining([expect.stringContaining('/project/index.html:')]),
    });
  });

  it('refuses Astro files without trying to extract frontmatter', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/src/Canvas.astro': '---\nconst name = \'canvas\';\n---\n<div>{name}</div>\n',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchObject({
      kind: 'manual',
      sources: expect.arrayContaining(['/project/src/Canvas.astro']),
      diagnostics: [
        '/project/src/Canvas.astro: cannot prove absence in Astro source during workspace scan',
      ],
    });
  });
});
