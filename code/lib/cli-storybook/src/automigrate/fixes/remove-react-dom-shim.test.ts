import * as fsp from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  formatFileContent,
  JsPackageManagerFactory,
  PackageManagerName,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { vol } from 'memfs';

import { allFixes } from './index.ts';
import { removeReactDomShim } from './remove-react-dom-shim.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

const packageManager = JsPackageManagerFactory.getPackageManager({
  force: PackageManagerName.NPM,
});

const check = () =>
  removeReactDomShim.check({
    packageManager,
    configDir: '/project/.storybook',
    mainConfig: { stories: [] },
    storybookVersion: '11.0.0',
    storiesPaths: [],
    hasCsfFactoryPreview: false,
  });

const run = (result: NonNullable<Awaited<ReturnType<typeof check>>>, dryRun: boolean) => {
  const migration = removeReactDomShim.run;
  if (!migration) throw new Error('Expected an automatic migration');
  return migration({
    packageManager,
    result,
    dryRun,
    mainConfigPath: '/project/.storybook/main.ts',
    mainConfig: { stories: [] },
    configDir: '/project/.storybook',
    storybookVersion: '11.0.0',
    storiesPaths: [],
  });
};

beforeEach(() => {
  vol.reset();
  vi.mocked(formatFileContent).mockImplementation(async (_filePath, source) => source);
  vi.mocked(fsp.readFile).mockImplementation(vol.promises.readFile as typeof fsp.readFile);
  vi.mocked(fsp.readdir).mockImplementation(vol.promises.readdir as typeof fsp.readdir);
  vi.mocked(fsp.writeFile).mockImplementation(vol.promises.writeFile as typeof fsp.writeFile);
});

afterEach(() => vi.restoreAllMocks());

describe('removeReactDomShim', () => {
  it('is registered for upgrades', () => {
    expect(allFixes).toContain(removeReactDomShim);
  });

  it('removes the package and its literal preset after analyzing the complete workspace', async () => {
    vol.fromNestedJSON({
      '/project': {
        'package.json': JSON.stringify({
          dependencies: {
            '@storybook/react-dom-shim': '^10.0.0',
            react: '^18.3.1',
            'react-dom': '^18.3.1',
          },
        }),
        '.storybook': {
          'main.ts': `export default { addons: ['@storybook/react-dom-shim/preset', '@storybook/addon-essentials'] };`,
        },
        'package-lock.json': JSON.stringify({
          packages: { 'node_modules/@storybook/react-dom-shim': { version: '10.5.10' } },
        }),
      },
    });

    const result = await check();

    expect(result).toMatchObject({ kind: 'safe', workspaceRoot: '/project' });
    if (!result) throw new Error('Expected a migration');

    await run(result, false);

    expect(vol.toJSON()).toMatchInlineSnapshot(`
{
  "/project/.storybook/main.ts": "export default { addons: ['@storybook/addon-essentials'] };",
  "/project/package-lock.json": "{\"packages\":{\"node_modules/@storybook/react-dom-shim\":{\"version\":\"10.5.10\"}}}",
  "/project/package.json": "{\n  \"dependencies\": {\n    \"react\": \"^18.3.1\",\n    \"react-dom\": \"^18.3.1\"\n  }\n}\n",
}
`);
  });

  it('does not write during a dry run', async () => {
    const manifest = JSON.stringify({
      dependencies: {
        '@storybook/react-dom-shim': '^10.0.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
      },
    });
    vol.fromNestedJSON({ '/project/package.json': manifest });
    const result = await check();
    if (!result) throw new Error('Expected a migration');

    await run(result, true);

    await expect(fsp.readFile('/project/package.json', 'utf8')).resolves.toBe(manifest);
  });

  it('refuses direct consumers before writing files', async () => {
    vol.fromNestedJSON({
      '/project': {
        'package.json': JSON.stringify({
          dependencies: {
            '@storybook/react-dom-shim': '^10.0.0',
            react: '^19.0.0',
            'react-dom': '^19.0.0',
          },
        }),
        'src/index.ts': `import { renderElement } from '@storybook/react-dom-shim';`,
      },
    });

    const result = await check();

    expect(result).toMatchObject({ kind: 'manual' });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        '/project/src/index.ts: contains a react-dom-shim import, re-export, or module load'
      )
    );
    expect(fsp.writeFile).not.toHaveBeenCalled();
  });

  it('does not run when the workspace does not use the shim', async () => {
    vol.fromNestedJSON({
      '/project/package.json': JSON.stringify({
        dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
      }),
    });

    await expect(check()).resolves.toBeNull();
  });
});
