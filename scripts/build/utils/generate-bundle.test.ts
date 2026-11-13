import * as esbuild from 'esbuild';
import { rolldown } from 'rolldown';
import { describe, expect, it } from 'vitest';

import {
  esbuildNoDynamicRequireGuard,
  getNodeBanner,
  rolldownNoDynamicRequireGuard,
} from './generate-bundle.ts';

const requiresReact = `module.exports = require('react');`;
const importsReact = `export { useState } from 'react';`;

const bundleWithEsbuild = (contents: string) =>
  esbuild.build({
    stdin: { contents, loader: 'js', sourcefile: 'entry.js' },
    bundle: true,
    format: 'esm',
    platform: 'browser',
    external: ['react'],
    write: false,
    logLevel: 'silent',
    plugins: [esbuildNoDynamicRequireGuard],
  });

// Like the production config, this has no `external` option: a plugin marks `react` external.
const bundleWithRolldown = async (sources: Record<string, string>) => {
  const build = await rolldown({
    input: 'entry',
    platform: 'browser',
    logLevel: 'silent',
    plugins: [
      rolldownNoDynamicRequireGuard,
      {
        name: 'virtual-modules',
        resolveId: (id) =>
          id === 'react' ? { id, external: true } : id in sources ? id : null,
        load: (id) => sources[id] ?? null,
      },
    ],
  });
  try {
    return await build.generate({ format: 'es' });
  } finally {
    await build.close();
  }
};

describe('no dynamic require in browser output', () => {
  it('fails an esbuild build that requires an external', async () => {
    await expect(bundleWithEsbuild(requiresReact)).rejects.toThrow(
      'calls require("react") on an external'
    );
  });

  it('passes an esbuild build that imports an external', async () => {
    await expect(bundleWithEsbuild(importsReact)).resolves.toBeDefined();
  });

  it('fails a rolldown build that requires an external', async () => {
    await expect(bundleWithRolldown({ entry: requiresReact })).rejects.toThrow(
      'calls require("react") on an external'
    );
  });

  it('fails a rolldown build that requires a module it cannot resolve', async () => {
    await expect(
      bundleWithRolldown({ entry: `module.exports = require('not-installed');` })
    ).rejects.toThrow('calls require("not-installed") on an external');
  });

  it('passes a rolldown build that requires a bundled module', async () => {
    await expect(
      bundleWithRolldown({
        entry: `module.exports = require('cjs');`,
        cjs: `module.exports = 1;`,
      })
    ).resolves.toBeDefined();
  });

  it('passes a rolldown build that imports an external', async () => {
    await expect(bundleWithRolldown({ entry: importsReact })).resolves.toBeDefined();
  });

  it('passes a rolldown build that only mentions require in a string', async () => {
    await expect(
      bundleWithRolldown({ entry: 'export const help = `__require("react")`;' })
    ).resolves.toBeDefined();
  });
});

describe('node CJS compatibility banner', () => {
  it('reads import.meta.url by default', () => {
    expect(getNodeBanner({}, 'abc')?.js).toContain(
      'var __filename = CJS_COMPAT_NODE_URL_abc.fileURLToPath(import.meta.url);'
    );
  });

  it('is left out when the package opts out', () => {
    expect(getNodeBanner({ cjsCompatBanner: false }, 'abc')).toBeUndefined();
  });
});
