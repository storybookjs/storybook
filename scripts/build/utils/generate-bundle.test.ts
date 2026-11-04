import * as esbuild from 'esbuild';
import { rolldown } from 'rolldown';
import { describe, expect, it } from 'vitest';

import { esbuildNoDynamicRequireGuard, rolldownNoDynamicRequireGuard } from './generate-bundle.ts';

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
    metafile: true,
    logLevel: 'silent',
    plugins: [esbuildNoDynamicRequireGuard],
  });

const bundleWithRolldown = async (code: string, modules: Record<string, string> = {}) => {
  const sources: Record<string, string> = { entry: code, ...modules };
  const build = await rolldown({
    input: 'entry',
    platform: 'browser',
    external: ['react'],
    logLevel: 'silent',
    plugins: [
      {
        name: 'entry',
        resolveId: (id) => (id in sources ? id : null),
        load: (id) => sources[id] ?? null,
      },
      rolldownNoDynamicRequireGuard,
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
    await expect(bundleWithRolldown(requiresReact)).rejects.toThrow(
      'calls require("react") on an external'
    );
  });

  it('fails a rolldown build whose require helper got renamed', async () => {
    // A bundled module that defines its own `__require` makes rolldown name its helper `__require$1`.
    const modules = {
      own: `export function __require() { return 1; }`,
      cjs: requiresReact,
    };
    await expect(
      bundleWithRolldown(
        `import { __require } from 'own'; import value from 'cjs'; export default [__require(), value];`,
        modules
      )
    ).rejects.toThrow('calls require("react") on an external');
  });

  it('passes a rolldown build that imports an external', async () => {
    await expect(bundleWithRolldown(importsReact)).resolves.toBeDefined();
  });
});
