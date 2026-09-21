import type { Options } from 'storybook/internal/types';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs as memfs, vol } from 'memfs';

import { experimental_docgenProvider, experimental_manifests } from './preset.ts';

vi.mock('node:fs', { spy: true });

beforeEach(() => {
  vol.reset();
  vi.mocked(existsSync).mockImplementation(memfs.existsSync);
  vi.mocked(readFileSync).mockImplementation(memfs.readFileSync as typeof readFileSync);
});

const optionsWith = (
  features: Record<string, unknown>,
  frameworkOptions: Record<string, unknown> = {}
) =>
  ({
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
  }) as unknown as Options;

describe('experimental_docgenProvider', () => {
  it('contributes no descriptor when the docgen server flag is off', async () => {
    expect(await experimental_docgenProvider([], optionsWith({}))).toEqual([]);
  });

  it.each([
    ['a framework option string', 'custom-elements.json', ['/workspace/custom-elements.json']],
    [
      'a framework option array',
      ['one.json', 'two.json'],
      ['/workspace/one.json', '/workspace/two.json'],
    ],
  ])('resolves %s', async (_name, customElementsManifest, expectedManifestPaths) => {
    vol.fromNestedJSON({
      '/workspace/custom-elements.json': '{}',
      '/workspace/one.json': '{}',
      '/workspace/two.json': '{}',
    });

    const result = await experimental_docgenProvider(
      [],
      optionsWith({ experimentalDocgenServer: true }, { customElementsManifest })
    );

    expect(result[0].moduleSpecifier).toContain('docgen-worker');
    expect(result[0].options).toEqual({
      manifestPaths: expectedManifestPaths,
      rootDir: '/workspace',
    });
    expect(JSON.parse(JSON.stringify(result[0].options))).toEqual(result[0].options);
  });

  it('resolves package.json#customElements relative to the package file', async () => {
    vol.fromNestedJSON({
      '/workspace/package.json': JSON.stringify({ customElements: 'dist/custom-elements.json' }),
    });

    expect(
      await experimental_docgenProvider([], optionsWith({ experimentalDocgenServer: true }))
    ).toEqual([
      {
        moduleSpecifier: expect.stringMatching(/docgen-worker\.js$/),
        options: {
          manifestPaths: ['/workspace/dist/custom-elements.json'],
          rootDir: '/workspace',
        },
      },
    ]);
  });

  it('throws when an explicit framework option path does not exist', async () => {
    await expect(
      experimental_docgenProvider(
        [],
        optionsWith({ experimentalDocgenServer: true }, { customElementsManifest: 'missing.json' })
      )
    ).rejects.toThrow(
      'The customElementsManifest framework option points to a file that does not exist: /workspace/missing.json'
    );
  });
});

describe('experimental_manifests', () => {
  it.each([
    ['docgen server flag off', { componentsManifest: true }, false],
    ['components manifest flag off', { experimentalDocgenServer: true }, false],
    ['both flags on', { experimentalDocgenServer: true, componentsManifest: true }, true],
  ])('%s', async (_name, features, contributes) => {
    const result = await experimental_manifests({}, optionsWith(features) as never);

    if (contributes) {
      expect(result).toMatchInlineSnapshot(`
        {
          "components": {
            "components": {},
            "meta": {
              "docgen": "custom-elements-manifest",
              "durationMs": 0,
            },
            "v": 0,
          },
        }
      `);
    } else {
      expect(result).toEqual({});
    }
    expect(Boolean((result as { components?: unknown }).components)).toBe(contributes);
  });
});
