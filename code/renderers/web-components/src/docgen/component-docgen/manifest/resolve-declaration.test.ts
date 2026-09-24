import { describe, expect, it } from 'vitest';

import type { ManifestLoadResult } from './load-manifest.ts';
import { resolveDeclarationForTag } from './resolve-declaration.ts';

const cem = {
  schemaVersion: '1.0.0',
  modules: [
    {
      path: 'first.js',
      declarations: [
        {
          name: 'FirstElement',
          kind: 'class',
          customElement: true,
          tagName: 'first-element',
          description: 'First element.',
        },
        {
          name: 'ExportedElement',
          kind: 'class',
          customElement: true,
          description: 'Exported element.',
        },
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
          kind: 'class',
          customElement: true,
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
          kind: 'class',
          customElement: true,
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
            modules: [
              {
                declarations: [
                  { name: 'First', kind: 'class', customElement: true, tagName: 'same-tag' },
                ],
              },
            ],
          }),
          loaded('/second.json', {
            modules: [
              {
                declarations: [
                  { name: 'Second', kind: 'class', customElement: true, tagName: 'same-tag' },
                ],
              },
            ],
          }),
        ],
        'same-tag'
      )
    ).toMatchInlineSnapshot(`
      {
        "declaration": {
          "customElement": true,
          "kind": "class",
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
              { name: 'First', kind: 'class', customElement: true, tagName: 'same-tag' },
              { name: 'Second', kind: 'class', customElement: true, tagName: 'same-tag' },
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
          {
            declarations: [
              { name: 'First', kind: 'class', customElement: true, tagName: 'same-tag' },
            ],
          },
          {
            declarations: [
              { name: 'Second', kind: 'class', customElement: true, tagName: 'same-tag' },
            ],
          },
        ],
      },
      'First',
    ],
  ])(
    'picks the first of several declarations sharing a tag: %s',
    (_name, manifest, expectedDeclarationName) => {
      expect(resolveDeclarationForTag([loaded('/manifest.json', manifest)], 'same-tag')).toEqual({
        manifestPath: '/manifest.json',
        declaration: {
          name: expectedDeclarationName,
          kind: 'class',
          customElement: true,
          tagName: 'same-tag',
        },
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
                declarations: [
                  {
                    name: 'SlButton',
                    kind: 'class',
                    customElement: true,
                    description: 'Button.',
                  },
                ],
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
      declaration: {
        name: 'SlButton',
        kind: 'class',
        customElement: true,
        description: 'Button.',
      },
    });
  });

  it('prefers a tagName declaration over a custom-element-definition export for the same tag', () => {
    expect(
      resolveDeclarationForTag(
        [
          loaded('/manifest.json', {
            modules: [
              {
                declarations: [
                  { name: 'ByTag', kind: 'class', customElement: true, tagName: 'x-tag' },
                  { name: 'ByExport', kind: 'class', customElement: true },
                ],
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
      declaration: { name: 'ByTag', kind: 'class', customElement: true, tagName: 'x-tag' },
    });
  });

  it('does not resolve a tagName-only class without the customElement flag', () => {
    expect(
      resolveDeclarationForTag(
        [
          loaded('/manifest.json', {
            modules: [{ declarations: [{ name: 'ByTag', kind: 'class', tagName: 'x-tag' }] }],
          }),
        ],
        'x-tag'
      )
    ).toBeUndefined();
  });

  it('returns undefined when no manifest resolves the tag', () => {
    expect(
      resolveDeclarationForTag([loaded('/manifest.json', cem)], 'missing-tag')
    ).toBeUndefined();
  });
});
