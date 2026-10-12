import type { IndexEntry } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';
import { logger } from 'storybook/internal/node-logger';

import { createDocgenProvider } from './docgen-worker.ts';
import { loadGenerator } from './component-docgen/source/generator.ts';
import { SourceManager } from './component-docgen/source/source-manager.ts';

const sourceFind = vi.hoisted(() => vi.fn());
const typescript = vi.hoisted(() => ({ sys: {} }));

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
vi.mock('@typescript/typescript6', () => ({ default: typescript }));
vi.mock('./component-docgen/source/generator.ts', () => ({
  loadGenerator: vi.fn(async () => ({}) as Awaited<ReturnType<typeof loadGenerator>>),
}));
vi.mock('./component-docgen/source/source-manager.ts', () => ({
  SourceManager: vi.fn(function SourceManager() {
    return {
      find: sourceFind,
    };
  }),
}));

beforeEach(() => {
  vol.reset();
  vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
  vi.mocked(readFile).mockImplementation(memfs.promises.readFile as typeof readFile);
  vi.mocked(stat).mockImplementation(memfs.promises.stat as typeof stat);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(loadGenerator).mockResolvedValue({} as Awaited<ReturnType<typeof loadGenerator>>);
  vi.mocked(loadGenerator).mockClear();
  vi.mocked(SourceManager).mockClear();
  sourceFind.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const entry: IndexEntry = {
  id: 'fixture--basic',
  name: 'Basic',
  title: 'Fixture',
  type: 'story',
  subtype: 'story',
  importPath: './input.stories.ts',
};

describe('createDocgenProvider', () => {
  it('passes through and warns once when no manifest is configured', async () => {
    const next = vi.fn(async () => ({ id: 'downstream' }));
    const provider = createDocgenProvider({ manifestPaths: [] })(next as never);

    await expect(provider({ entry })).resolves.toEqual({ id: 'downstream' });
    await expect(provider({ entry })).resolves.toEqual({ id: 'downstream' });
    expect(next).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(loadGenerator).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringMatching(/No Custom Elements Manifest was configured/)
    );
  });

  it('loads manifests once and merges its payload over downstream', async () => {
    vol.fromNestedJSON({
      '/workspace/custom-elements.json': JSON.stringify({
        modules: [
          {
            declarations: [
              { name: 'XCard', kind: 'class', customElement: true, tagName: 'x-card' },
            ],
          },
        ],
      }),
      '/workspace/input.stories.ts': "export default { title: 'Fixture', component: 'x-card' };",
    });
    const next = vi.fn(async () => ({ id: 'downstream' }));
    const provider = createDocgenProvider({
      manifestPaths: ['/workspace/custom-elements.json'],
    })(next as never);

    await expect(provider({ entry })).resolves.toMatchObject({
      id: 'fixture',
      name: 'x-card',
      renderer: 'web-components',
    });
    await expect(provider({ entry })).resolves.toMatchObject({
      id: 'fixture',
      name: 'x-card',
      renderer: 'web-components',
    });
    expect(readFile).toHaveBeenCalledTimes(1);
  });

  it('falls back to sources when no manifest declares the tag', async () => {
    sourceFind.mockResolvedValue({
      declaration: {
        name: 'XCard',
        kind: 'class',
        customElement: true,
        tagName: 'x-card',
      },
      manifestPath: 'src/x-card.ts',
    });
    vol.fromNestedJSON({
      '/workspace/input.stories.ts': "export default { title: 'Fixture', component: 'x-card' };",
    });
    const next = vi.fn(async () => ({ id: 'downstream' }));
    const provider = createDocgenProvider({
      manifestPaths: [],
      autoGenerateManifest: true,
      previewFilePath: '/workspace/.storybook/preview.ts',
    })(next as never);

    await expect(provider({ entry })).resolves.toMatchObject({
      id: 'fixture',
      name: 'x-card',
      renderer: 'web-components',
      customElementsManifest: {
        manifestPath: 'src/x-card.ts',
      },
    });
    expect(next).toHaveBeenCalledTimes(1);
    expect(SourceManager).toHaveBeenCalledWith(typescript, {}, '/workspace/.storybook/preview.ts');
    expect(sourceFind).toHaveBeenCalledWith('x-card', {
      storyFilePath: '/workspace/input.stories.ts',
    });
  });
});
