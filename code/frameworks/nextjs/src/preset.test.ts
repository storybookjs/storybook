import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { getProjectRoot } from 'storybook/internal/common';

import type { TransformOptions } from '@babel/core';

import nextBabelPreset from './babel/preset.ts';
import { babel } from './preset.ts';

// The global test setup stubs package resolution; the preset reads the real Next.js version.
vi.mock('../../../core/src/shared/utils/module.ts', async (importOriginal) => importOriginal());

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  getProjectRoot: vi.fn(),
}));

let projectRoot: string;

beforeEach(async () => {
  projectRoot = await mkdtemp(join(tmpdir(), 'sb-nextjs-preset-'));
  // Let the project config resolve `next/babel` the way a real Next.js project would.
  const nextDir = dirname(fileURLToPath(import.meta.resolve('next/package.json')));
  await mkdir(join(projectRoot, 'node_modules'));
  await symlink(nextDir, join(projectRoot, 'node_modules', 'next'), 'dir');
  vi.mocked(getProjectRoot).mockReturnValue(projectRoot);
  // Babel looks up `babel.config.*` in the current working directory, the project root
  vi.spyOn(process, 'cwd').mockReturnValue(projectRoot);
});

afterEach(async () => {
  vi.mocked(process.cwd).mockRestore();
  await rm(projectRoot, { recursive: true, force: true });
});

it('loads an ESM babel.config.mjs and keeps the user plugins', async () => {
  await writeFile(
    join(projectRoot, 'noop-plugin.cjs'),
    "module.exports = () => ({ name: 'noop-plugin', visitor: {} });"
  );
  await writeFile(
    join(projectRoot, 'babel.config.mjs'),
    "export default { presets: ['next/babel'], plugins: ['./noop-plugin.cjs'] };"
  );

  const config = (await (babel as (config: TransformOptions) => Promise<TransformOptions>)(
    {}
  )) as TransformOptions;

  expect(config.babelrc).toBe(false);
  expect(config.configFile).toBe(false);
  expect(config.plugins).toContainEqual(
    expect.objectContaining({ file: expect.objectContaining({ request: './noop-plugin.cjs' }) })
  );
  // `next/babel` is replaced by Storybook's copy of the Next.js preset
  const presetNames = config.presets?.map((preset) => (Array.isArray(preset) ? preset[0] : preset));
  expect(presetNames).toEqual([nextBabelPreset]);
});
