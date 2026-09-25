import type { Options } from 'storybook/internal/types';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import { findFilesUp } from 'storybook/internal/common';

import { experimental_docgenProvider, experimental_manifests } from './preset.ts';

vi.mock('node:fs', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(findFilesUp).mockReturnValue([]);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
});

const optionsWith = (
  features: Record<string, unknown>,
  frameworkOptions: Record<string, unknown> = {}
) => {
  const options = {
    configDir: resolve('/workspace/.storybook'),
    presets: {
      apply: async (key: string) => {
        if (key === 'features') {
          return features;
        }
        if (key === 'frameworkOptions') {
          return frameworkOptions;
        }
        return undefined;
      },
    },
  } as Options;
  return options;
};

describe('experimental_docgenProvider', () => {
  it('contributes no descriptor when the docgen server flag is off', async () => {
    expect(await experimental_docgenProvider([], optionsWith({}))).toEqual([]);
  });

  it('contributes the docgen worker descriptor', async () => {
    vol.fromNestedJSON({
      '/workspace/package.json': JSON.stringify({ customElements: 'dist/custom-elements.json' }),
    });
    vi.mocked(findFilesUp).mockReturnValue(['/workspace/package.json']);

    expect(
      await experimental_docgenProvider([], optionsWith({ experimentalDocgenServer: true }))
    ).toEqual([
      {
        moduleSpecifier: expect.stringMatching(/docgen-worker\.js$/),
        options: {
          manifestPaths: [resolve('/workspace/dist/custom-elements.json')],
        },
      },
    ]);
  });
});

describe('experimental_manifests', () => {
  it.each([
    ['docgen server flag off', { componentsManifest: true }, {}],
    ['components manifest flag off', { experimentalDocgenServer: true }, {}],
    [
      'both flags on',
      { experimentalDocgenServer: true, componentsManifest: true },
      {
        components: {
          v: 0,
          components: {},
          meta: { docgen: 'custom-elements-manifest', durationMs: 0 },
        },
      },
    ],
  ])('%s', async (_name, features, expected) => {
    const result = await experimental_manifests({}, optionsWith(features) as never);

    expect(result).toEqual(expected);
  });
});
