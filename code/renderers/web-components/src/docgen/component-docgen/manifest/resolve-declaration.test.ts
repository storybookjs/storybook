import { describe, expect, it } from 'vitest';

import type { ManifestLoadResult } from './load-manifest.ts';
import { resolveDeclarationForTag } from './resolve-declaration.ts';

const cem = {
  schemaVersion: '1.0.0',
  modules: [
    {
      path: 'first.js',
      declarations: [
        { name: 'FirstElement', tagName: 'first-element', description: 'First element.' },
        { name: 'ExportedElement', description: 'Exported element.' },
      ],
      exports: [
        {
          kind: 'custom-element-definition',
          name: 'exported-element',
          declaration: { name: 'ExportedElement' },
        },
      ],
    },
  ],
};

const loaded = (path: string, manifest: unknown): ManifestLoadResult =>
  ({ path, manifest }) as ManifestLoadResult;

describe('resolveDeclarationForTag', () => {
  it.each([
    [
      'finds a declaration by tagName',
      'first-element',
      {
        manifestPath: '/manifest.json',
        declaration: {
          name: 'FirstElement',
          tagName: 'first-element',
          description: 'First element.',
        },
      },
    ],
    [
      'finds a declaration through custom-element-definition exports',
      'exported-element',
      {
        manifestPath: '/manifest.json',
        declaration: {
          name: 'ExportedElement',
          description: 'Exported element.',
        },
      },
    ],
  ])('%s', (_name, tag, expected) => {
    expect(resolveDeclarationForTag([loaded('/manifest.json', cem)], tag)).toEqual(expected);
  });

  it('lets the first manifest that resolves a tag win', () => {
    expect(
      resolveDeclarationForTag(
        [
          loaded('/first.json', {
            modules: [{ declarations: [{ name: 'First', tagName: 'same-tag' }] }],
          }),
          loaded('/second.json', {
            modules: [{ declarations: [{ name: 'Second', tagName: 'same-tag' }] }],
          }),
        ],
        'same-tag'
      )
    ).toMatchInlineSnapshot(`
      {
        "declaration": {
          "name": "First",
          "tagName": "same-tag",
        },
        "manifestPath": "/first.json",
      }
    `);
  });

  it('returns undefined when no manifest resolves the tag', () => {
    expect(
      resolveDeclarationForTag([loaded('/manifest.json', cem)], 'missing-tag')
    ).toBeUndefined();
  });
});
