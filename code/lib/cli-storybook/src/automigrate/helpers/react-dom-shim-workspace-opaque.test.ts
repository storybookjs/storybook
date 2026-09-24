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

describe('analyzeReactDomShimWorkspace opaque files', () => {
  it('returns a manifest-only plan when ordinary opaque files contain no migration signal', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/.browserslistrc': 'defaults\n',
      '/project/.circleci/config.yml': 'version: 2.1\njobs: {}\n',
      '/project/.toolrc': '@storybook/addon-a11y\n',
      '/project/scripts/check.sh': '#!/bin/sh\necho ready\n',
      '/project/docs/guide.mdx': '# Guide\n<Component answer={40 + 2} />\n',
      '/project/docs/broken.mdx': '# Guide\n<Component answer={\n',
      '/project/public/logo.svg': '<svg><path d="M0 0h10v10z" /></svg>\n',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchInlineSnapshot(`
{
  "edits": [
    {
      "filePath": "/project/package.json",
      "original": "{\n  \"private\": true,\n  \"dependencies\": {\n    \"react\": \"19.1.1\",\n    \"react-dom\": \"19.1.1\",\n    \"@storybook/react-dom-shim\": \"10.5.10\"\n  }\n}\n",
      "replacement": "{\n  \"private\": true,\n  \"dependencies\": {\n    \"react\": \"19.1.1\",\n    \"react-dom\": \"19.1.1\"\n  }\n}\n",
    },
  ],
  "kind": "safe",
  "workspaceRoot": "/project",
}
`);
  });

  it('returns non-proving none for the same no-signal files without a migration trigger', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({ react: '19.1.1', 'react-dom': '19.1.1' }),
      '/project/.browserslistrc': 'defaults\n',
      '/project/.circleci/config.yml': 'version: 2.1\njobs: {}\n',
      '/project/scripts/check.sh': '#!/bin/sh\necho ready\n',
      '/project/docs/guide.mdx': '# Guide\n<Component answer={40 + 2} />\n',
      '/project/public/logo.svg': '<svg><path d="M0 0h10v10z" /></svg>\n',
    });

    await expect(analyzeReactDomShimWorkspace('/project')).resolves.toMatchInlineSnapshot(`
      {
        "applicable": false,
        "kind": "none",
        "workspaceRoot": "/project",
      }
    `);
  });

  it('returns no edits when opaque consumers require manual migration', async () => {
    vol.fromNestedJSON({
      '/project/package.json': packageJson({
        react: '19.1.1',
        'react-dom': '19.1.1',
        '@storybook/react-dom-shim': '10.5.10',
      }),
      '/project/docs/guide.mdx': 'const load = import(packageName);\n',
      '/project/scripts/check.sh': 'name="@storybook/react-dom-\\x73him"\n',
      '/project/public/logo.svg': '<svg onload="run()"></svg>\n',
    });

    const result = await analyzeReactDomShimWorkspace('/project');

    expect(result).toMatchObject({
      kind: 'manual',
      diagnostics: [
        '/project/docs/guide.mdx: contains a possible react-dom-shim consumer that cannot be removed safely',
        '/project/public/logo.svg: contains a possible react-dom-shim consumer that cannot be removed safely',
        '/project/scripts/check.sh: contains a possible react-dom-shim consumer that cannot be removed safely',
      ],
    });
    expect('edits' in result).toBe(false);
  });
});
