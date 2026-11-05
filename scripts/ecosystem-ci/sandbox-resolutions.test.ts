import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as memfs from 'memfs';
import { vol } from 'memfs';

import { readRootOverrides, toSandboxResolutions } from './sandbox-resolutions.ts';

vi.mock('node:fs/promises', { spy: true });

const ROOT = resolve('repo');

beforeEach(async () => {
  vol.reset();
  const fsp = await import('node:fs/promises');
  vi.mocked(fsp.readFile).mockImplementation(memfs.fs.promises.readFile as never);
});

describe('readRootOverrides', () => {
  it('reads overrides from pnpm-workspace.yaml and the package.json fields pnpm honours', async () => {
    vol.fromJSON({
      [resolve(ROOT, 'pnpm-workspace.yaml')]:
        'packages:\n  - code\noverrides:\n  react: ^18.2.0\n  vite: file:/eco/vite\n',
      [resolve(ROOT, 'package.json')]: JSON.stringify({
        resolutions: { svelte: '5.0.0' },
        pnpm: { overrides: { rolldown: '1.0.0' } },
      }),
    });

    expect(await readRootOverrides(ROOT)).toEqual({
      react: '^18.2.0',
      vite: 'file:/eco/vite',
      svelte: '5.0.0',
      rolldown: '1.0.0',
    });
  });
});

describe('toSandboxResolutions', () => {
  it('keeps only the overrides Storybook does not maintain itself', () => {
    expect(
      toSandboxResolutions({
        react: '^18.2.0',
        'react-joyride>type-fest': '~2.19',
        vite: 'file:/eco/vite',
      })
    ).toEqual({ vite: 'file:/eco/vite' });
  });

  it('rewrites pnpm parent selectors to Yarn resolution keys', () => {
    expect(
      toSandboxResolutions({
        'vite-plugin>vite': '1.0.0',
        '@scope/parent@1.0.0>@scope/child': '1.0.0',
        'vitest@<3.2.0>vite': '^6.3.5',
        'rollup@>=4.0.0': '4.50.0',
      })
    ).toEqual({
      'vite-plugin/vite': '1.0.0',
      '@scope/parent@1.0.0/@scope/child': '1.0.0',
      'vitest@<3.2.0/vite': '^6.3.5',
      'rollup@>=4.0.0': '4.50.0',
    });
  });
});
