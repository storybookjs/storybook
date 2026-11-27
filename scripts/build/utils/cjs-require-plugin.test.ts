import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

import * as esbuild from 'esbuild';
import { join } from 'pathe';
import { describe, expect, it } from 'vitest';

import { addCjsRequire } from './cjs-require-plugin.ts';

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
  const requiresPath = `module.exports = require('node:path').posix.sep;`;

  it('runs bundled CommonJS once require is added', async () => {
    const code = addCjsRequire(await bundleForNode(requiresPath), 'test');
    await expect(runModule(code!)).resolves.toBe('/');
  });

  it('keeps a hashbang on the first line', async () => {
    const code = addCjsRequire(
      await bundleForNode(`#!/usr/bin/env node\n${requiresPath}`),
      'test'
    );
    expect(code!.split('\n')[0]).toBe('#!/usr/bin/env node');
    await expect(runModule(code!)).resolves.toBe('/');
  });

  it('leaves output alone when require only appears in comments and strings', async () => {
    const code = await bundleForNode(
      `// require('node:os')\nexport default "require.resolve('x')";`
    );
    expect(addCjsRequire(code, 'test')).toBeUndefined();
  });
});
