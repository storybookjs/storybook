import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { importModule } from '../../shared/utils/module.ts';
import { getPreviewBuilder } from './get-builders.ts';

let root: string;

// Package resolution follows real node_modules and package.json exports, which memfs cannot serve.
const createBuilderPackage = () => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'storybook-builder-')));
  const dir = join(root, 'node_modules', 'fake-builder');
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: 'fake-builder', type: 'module', exports: { '.': './dist/index.js' } })
  );
  writeFileSync(join(dir, 'dist', 'index.js'), 'export const start = () => {};');
  return dir;
};

describe('getPreviewBuilder', () => {
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('imports the entry point of a builder given as its package directory', async () => {
    const dir = createBuilderPackage();

    await getPreviewBuilder(dir);

    expect(vi.mocked(importModule)).toHaveBeenCalledWith(
      join(dir, 'dist', 'index.js').replace(/\\/g, '/')
    );
  });

  it('imports any other builder reference as given', async () => {
    createBuilderPackage();

    await getPreviewBuilder('@storybook/builder-vite');

    expect(vi.mocked(importModule)).toHaveBeenCalledWith('@storybook/builder-vite');
  });
});
