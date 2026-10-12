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
const generator = { generate: vi.fn() };

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });
// A factory, not `spy: true`: the real module cannot load once `node:fs` reads from memfs.
vi.mock('@typescript/typescript6', () => ({ default: typescript }));
vi.mock('./component-docgen/source/generator.ts', { spy: true });
vi.mock('./component-docgen/source/source-manager.ts', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
  vi.mocked(readFile).mockImplementation(memfs.promises.readFile as typeof readFile);
  vi.mocked(stat).mockImplementation(memfs.promises.stat as typeof stat);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
  vi.mocked(logger.warn).mockImplementation(() => {});
  vi.mocked(loadGenerator).mockReset().mockResolvedValue(generator);
  vi.mocked(SourceManager)
    .mockReset()
    .mockImplementation(function SourceManager() {
      return { find: sourceFind } as unknown as SourceManager;
    });
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

  it('prefers a manifest declaration over sources when both are configured', async () => {
    vol.fromNestedJSON({
      '/workspace/custom-elements.json': JSON.stringify({
        modules: [
          {
            path: 'src/x-card.js',
            declarations: [
              { name: 'XCard', kind: 'class', customElement: true, tagName: 'x-card' },
            ],
          },
        ],
      }),
      '/workspace/input.stories.ts': "export default { title: 'Fixture', component: 'x-card' };",
    });
    const provider = createDocgenProvider({
      manifestPaths: ['/workspace/custom-elements.json'],
    })(async () => undefined);

    await expect(provider({ entry })).resolves.toMatchObject({
      name: 'x-card',
      customElementsManifest: { manifestPath: 'custom-elements.json' },
    });
    expect(sourceFind).not.toHaveBeenCalled();
  });

  it('generates from sources when no manifest is configured', async () => {
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
    expect(SourceManager).toHaveBeenCalledWith(
      typescript,
      generator,
      '/workspace/.storybook/preview.ts'
    );
    expect(sourceFind).toHaveBeenCalledWith('x-card', {
      storyFilePath: '/workspace/input.stories.ts',
    });
  });
  it('keeps manifest docgen when the source tools fail to load', async () => {
    vi.mocked(loadGenerator).mockRejectedValue(new Error('broken install'));
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
    const provider = createDocgenProvider({
      manifestPaths: ['/workspace/custom-elements.json'],
      typeProperty: 'parsedType',
    })(async () => undefined);

    await expect(provider({ entry })).resolves.toMatchObject({ name: 'x-card' });
    expect(logger.warn).toHaveBeenCalledWith(
      'Web components docgen cannot generate declarations from sources: broken install'
    );
  });

  it('passes through when the source tools fail to load and no manifest is configured', async () => {
    vi.mocked(loadGenerator).mockRejectedValue(new Error('broken install'));
    const next = vi.fn(async () => ({ id: 'downstream' }));
    const provider = createDocgenProvider({ manifestPaths: [], typeProperty: 'parsedType' })(
      next as never
    );

    await expect(provider({ entry })).resolves.toEqual({ id: 'downstream' });
  });
});
