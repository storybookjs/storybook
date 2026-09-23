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

  it.each([
    [
      'same module',
      {
        modules: [
          {
            declarations: [
              { name: 'First', tagName: 'same-tag' },
              { name: 'Second', tagName: 'same-tag' },
            ],
          },
        ],
      },
      'First',
    ],
    [
      'split modules',
      {
        modules: [
          { declarations: [{ name: 'First', tagName: 'same-tag' }] },
          { declarations: [{ name: 'Second', tagName: 'same-tag' }] },
        ],
      },
      'First',
    ],
  ])(
    'picks the first of several declarations sharing a tag: %s',
    (_name, manifest, expectedDeclarationName) => {
      expect(resolveDeclarationForTag([loaded('/manifest.json', manifest)], 'same-tag')).toEqual({
        manifestPath: '/manifest.json',
        declaration: { name: expectedDeclarationName, tagName: 'same-tag' },
      });
    }
  );

  it('resolves a custom-element-definition whose declaration lives in another module', () => {
    expect(
      resolveDeclarationForTag(
        [
          loaded('/manifest.json', {
            modules: [
              {
                path: 'components/button/button.component.js',
                declarations: [{ name: 'SlButton', description: 'Button.' }],
              },
              {
                path: 'components/button/button.js',
                exports: [
                  {
                    kind: 'custom-element-definition',
                    name: 'sl-button',
                    declaration: {
                      name: 'SlButton',
                      module: 'components/button/button.component.js',
                    },
                  },
                ],
              },
            ],
          }),
        ],
        'sl-button'
      )
    ).toEqual({
      manifestPath: '/manifest.json',
      declaration: { name: 'SlButton', description: 'Button.' },
    });
  });

  it('prefers a tagName declaration over a custom-element-definition export for the same tag', () => {
    expect(
      resolveDeclarationForTag(
        [
          loaded('/manifest.json', {
            modules: [
              {
                declarations: [{ name: 'ByTag', tagName: 'x-tag' }, { name: 'ByExport' }],
                exports: [
                  {
                    kind: 'custom-element-definition',
                    name: 'x-tag',
                    declaration: { name: 'ByExport' },
                  },
                ],
              },
            ],
          }),
        ],
        'x-tag'
      )
    ).toEqual({
      manifestPath: '/manifest.json',
      declaration: { name: 'ByTag', tagName: 'x-tag' },
    });
  });

  it('returns undefined when no manifest resolves the tag', () => {
    expect(
      resolveDeclarationForTag([loaded('/manifest.json', cem)], 'missing-tag')
    ).toBeUndefined();
  });
});
