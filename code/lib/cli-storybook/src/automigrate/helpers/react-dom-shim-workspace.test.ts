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
      '/project/.storybook/main.ts': "export default { addons: ['@storybook/react-dom-shim/preset'] };\n",
      '/project/vite.config.ts': "export default { resolve: { alias: { '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-16' } } };\n",
    });

    const result = await analyzeReactDomShimWorkspace('/project/.storybook');

    expect(result).toMatchInlineSnapshot(`
      {
        "edits": [
          {
            "filePath": "/project/.storybook/main.ts",
            "original": "export default { addons: ['@storybook/react-dom-shim/preset'] };\n",
            "replacement": "export default { addons: [] };\n",
          },
          {
            "filePath": "/project/package.json",
            "original": "{\n  \\"private\\": true,\n  \\"dependencies\\": {\n    \\"react\\": \\"19.1.1\\",\n    \\"react-dom\\": \\"19.1.1\\",\n    \\"@storybook/react-dom-shim\\": \\"10.5.10\\"\n  }\n}\n",
            "replacement": "{\n  \\"private\\": true,\n  \\"dependencies\\": {\n    \\"react\\": \\"19.1.1\\",\n    \\"react-dom\\": \\"19.1.1\\"\n  }\n}\n",
          },
          {
            "filePath": "/project/vite.config.ts",
            "original": "export default { resolve: { alias: { '@storybook/react-dom-shim': '@storybook/react-dom-shim/react-16' } } };\n",
            "replacement": "export default {\n  resolve: {\n    alias: {}\n  }\n};\n",
          },
        ],
        "kind": "safe",
        "workspaceRoot": "/project",
      }
    `);
    if (result.kind !== 'safe') throw new Error('expected a safe plan');
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
      '/project/packages/consumer/package.json': packageJson({ '@storybook/react-dom-shim': '10.5.10' }),
      '/project/packages/consumer/src/index.ts': "import { renderElement } from '@storybook/react-dom-shim';\n",
      '/project/packages/config/package.json': packageJson({}),
      '/project/packages/config/vitest.config.ts': "const name = ['@storybook', 'react-dom-shim'].join('/'); export default { resolve: { alias: { [name]: name } } };\n",
    });

    expect(await analyzeReactDomShimWorkspace('/project/packages/consumer')).toMatchInlineSnapshot(`
      {
        "diagnostics": [
          "/project/packages/config/vitest.config.ts: contains a react-dom-shim reference that cannot be removed safely",
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
      '/project/packages/app/.storybook/main.ts': "export default { addons: ['@storybook/react-dom-shim/preset'] };\n",
      '/project/packages/app/nested/package.json': `${JSON.stringify({ workspaces: { packages: ['*'] } })}\n`,
    });

    expect(await analyzeReactDomShimWorkspace('/project/packages/app')).toMatchInlineSnapshot(`
      {
        "diagnostics": [
          "/project/packages/app/package.json: react and react-dom must both support React 18 or later",
          "/project/packages/app/nested/package.json: nested workspace declarations are not supported",
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
});
