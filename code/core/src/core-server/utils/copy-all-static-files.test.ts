import { existsSync, statSync } from 'node:fs';
import { cp } from 'node:fs/promises';

import * as memfs from 'memfs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { copyAllStaticFilesRelativeToMain } from './copy-all-static-files.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', () => ({ logger: { info: vi.fn() } }));

const configDir = '/project/.storybook';
const outputDir = '/project/storybook-static';

beforeEach(async () => {
  memfs.vol.reset();
  vi.mocked(existsSync).mockImplementation(memfs.fs.existsSync);
  vi.mocked(statSync).mockImplementation(memfs.fs.statSync);
  vi.mocked(cp).mockImplementation(memfs.fs.promises.cp as typeof cp);
  vi.spyOn(process, 'cwd').mockReturnValue('/project');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('copyAllStaticFilesRelativeToMain', () => {
  it('copies static dirs to the output dir, later entries overriding earlier ones', async () => {
    memfs.vol.fromNestedJSON({
      '/project/public': {
        'asset.txt': 'public',
        'shared.txt': 'public',
      },
      '/project/.storybook/static': {
        'shared.txt': 'storybook',
      },
      [outputDir]: {},
    });

    await copyAllStaticFilesRelativeToMain(['../public', './static'], outputDir, configDir);

    expect(memfs.vol.toJSON(outputDir, {}, true)).toEqual({
      'asset.txt': 'public',
      'shared.txt': 'storybook',
    });
  });

  it('never replaces the files Storybook writes to the output dir', async () => {
    memfs.vol.fromNestedJSON({
      '/project/public': {
        'index.html': 'public',
        'iframe.html': 'public',
        'index.json': 'public',
        'project.json': 'public',
        'asset.txt': 'public',
      },
      [outputDir]: {
        'index.html': 'storybook',
        'iframe.html': 'storybook',
        'index.json': 'storybook',
        'project.json': 'storybook',
      },
    });

    await copyAllStaticFilesRelativeToMain(['../public'], outputDir, configDir);

    expect(memfs.vol.toJSON(outputDir, {}, true)).toEqual({
      'index.html': 'storybook',
      'iframe.html': 'storybook',
      'index.json': 'storybook',
      'project.json': 'storybook',
      'asset.txt': 'public',
    });
  });

  it('copies absolute static dirs', async () => {
    memfs.vol.fromNestedJSON({
      '/elsewhere/public': { 'asset.txt': 'public' },
      [outputDir]: {},
    });

    await copyAllStaticFilesRelativeToMain(
      [{ from: '/elsewhere/public', to: '/' }],
      outputDir,
      configDir
    );

    expect(memfs.vol.toJSON(outputDir, {}, true)).toEqual({ 'asset.txt': 'public' });
  });
});
