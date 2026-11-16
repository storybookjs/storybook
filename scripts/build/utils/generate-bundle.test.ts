import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

import * as esbuild from 'esbuild';
import { join } from 'pathe';
import { rolldown } from 'rolldown';
import { describe, expect, it } from 'vitest';

import {
  addCjsRequire,
  esbuildNoDynamicRequireGuard,
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

// Bundles `contents` like a node entry: CommonJS `require` calls become esbuild's `__require`.
const bundleForNode = async (contents: string) => {
  const result = await esbuild.build({
    stdin: { contents, loader: 'js', sourcefile: 'entry.js' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
  });
  return result.outputFiles[0].text;
};

// Runs in a separate node process: Vitest's module runner provides a `require` that plain ESM lacks.
const runModule = async (code: string) => {
  const dir = await mkdtemp(join(tmpdir(), 'cjs-require-'));
  try {
    await writeFile(join(dir, 'entry.mjs'), code);
    // A file, not `node -e`, which puts `require` on globalThis.
    const runner = join(dir, 'run.mjs');
    await writeFile(
      runner,
      `const m = await import('./entry.mjs'); process.stdout.write(JSON.stringify(m.default));`
    );
    const { stdout } = await promisify(execFile)(process.execPath, [runner]);
    return JSON.parse(stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

describe('require in node output', () => {
  const requiresOs = `module.exports = require('node:os').EOL;`;

  it('fails to run bundled CommonJS without a require', async () => {
    await expect(runModule(await bundleForNode(requiresOs))).rejects.toThrow(
      'Dynamic require of "node:os" is not supported'
    );
  });

  it('runs bundled CommonJS once require is added', async () => {
    const code = addCjsRequire(await bundleForNode(requiresOs), 'test');
    await expect(runModule(code!)).resolves.toBe('\n');
  });

  it('keeps a hashbang on the first line', async () => {
    const code = addCjsRequire(
      await bundleForNode(`#!/usr/bin/env node\n${requiresOs}`),
      'test'
    );
    expect(code!.split('\n')[0]).toBe('#!/usr/bin/env node');
    await expect(runModule(code!)).resolves.toBe('\n');
  });

  it('leaves output alone when require only appears in comments and strings', async () => {
    const code = await bundleForNode(
      `// require('node:os')\nexport default "require.resolve('x')";`
    );
    expect(addCjsRequire(code, 'test')).toBeUndefined();
  });

  it('leaves ESM output alone', async () => {
    expect(addCjsRequire(await bundleForNode(`export { EOL } from 'node:os';`), 'test')).toBeUndefined();
  });
});
