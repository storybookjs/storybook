import type { IndexEntry } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';
import { logger } from 'storybook/internal/node-logger';

import { createDocgenProvider } from './docgen-worker.ts';

vi.mock('node:fs', { spy: true });
vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/node-logger', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.spyOn(process, 'cwd').mockReturnValue('/workspace');
  vi.mocked(readFile).mockImplementation(memfs.promises.readFile as typeof readFile);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
  vi.mocked(logger.warn).mockImplementation(() => {});
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
    const provider = createDocgenProvider({ manifestPaths: [], typeProperty: 'parsedType' })(
      next as never
    );

    await expect(provider({ entry })).resolves.toEqual({ id: 'downstream' });
    await expect(provider({ entry })).resolves.toEqual({ id: 'downstream' });
    expect(next).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledTimes(1);
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
      typeProperty: 'parsedType',
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
});
