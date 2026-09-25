import { describe, expect, it } from 'vitest';

import { buildTagIndex } from './build-tag-index.ts';
import type { ManifestPackage } from './types.ts';

const cem = {
  schemaVersion: '1.0.0',
  modules: [
    {
      kind: 'javascript-module',
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
} satisfies ManifestPackage;

describe('buildTagIndex', () => {
  it.each([
    {
      name: 'finds a declaration by tagName',
      manifest: cem,
      tag: 'first-element',
      expectedDeclarationName: 'FirstElement',
    },
    {
      name: 'finds a declaration through custom-element-definition exports',
      manifest: cem,
      tag: 'exported-element',
      expectedDeclarationName: 'ExportedElement',
    },
    {
      name: 'picks the first declaration in the same module',
      manifest: {
        schemaVersion: '1.0.0',
        modules: [
          {
            kind: 'javascript-module',
            path: 'elements.js',
            declarations: [
              { name: 'First', kind: 'class', customElement: true, tagName: 'same-tag' },
              { name: 'Second', kind: 'class', customElement: true, tagName: 'same-tag' },
            ],
          },
        ],
      },
      tag: 'same-tag',
      expectedDeclarationName: 'First',
    },
    {
      name: 'picks the first declaration across split modules',
      manifest: {
        schemaVersion: '1.0.0',
        modules: [
          {
            kind: 'javascript-module',
            path: 'first.js',
            declarations: [
              { name: 'First', kind: 'class', customElement: true, tagName: 'same-tag' },
            ],
          },
          {
            kind: 'javascript-module',
            path: 'second.js',
            declarations: [
              { name: 'Second', kind: 'class', customElement: true, tagName: 'same-tag' },
            ],
          },
        ],
      },
      tag: 'same-tag',
      expectedDeclarationName: 'First',
    },
    {
      name: 'resolves a custom-element-definition whose declaration lives in another module',
      manifest: {
        schemaVersion: '1.0.0',
        modules: [
          {
            kind: 'javascript-module',
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
            kind: 'javascript-module',
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
      },
      tag: 'sl-button',
      expectedDeclarationName: 'SlButton',
    },
    {
      name: 'prefers a tagName declaration over a custom-element-definition export for the same tag',
      manifest: {
        schemaVersion: '1.0.0',
        modules: [
          {
            kind: 'javascript-module',
            path: 'element.js',
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
      },
      tag: 'x-tag',
      expectedDeclarationName: 'ByTag',
    },
    {
      name: 'does not resolve a tagName-only class without the customElement flag',
      manifest: {
        schemaVersion: '1.0.0',
        modules: [
          {
            kind: 'javascript-module',
            path: 'element.js',
            declarations: [{ name: 'ByTag', kind: 'class', tagName: 'x-tag' }],
          },
        ],
      },
      tag: 'x-tag',
      expectedDeclarationName: undefined,
    },
    {
      name: 'returns undefined when no declaration resolves the tag',
      manifest: cem,
      tag: 'missing-tag',
      expectedDeclarationName: undefined,
    },
  ] satisfies {
    name: string;
    manifest: ManifestPackage;
    tag: string;
    expectedDeclarationName: string | undefined;
  }[])('$name', ({ manifest, tag, expectedDeclarationName }) => {
    expect(buildTagIndex(manifest).get(tag)?.name).toBe(expectedDeclarationName);
  });

  it('skips malformed modules, declarations, and custom-element-definition exports', () => {
    const index = buildTagIndex({
      schemaVersion: '1.0.0',
      modules: [
        null,
        {
          kind: 'javascript-module',
          path: 'bad-declarations.js',
          declarations: 'bad',
        },
        {
          kind: 'javascript-module',
          path: 'bad-export.js',
          exports: [
            {
              kind: 'custom-element-definition',
              name: 'x-broken',
              declaration: null,
            },
          ],
        },
        {
          kind: 'javascript-module',
          path: 'good.js',
          declarations: [
            {
              name: 'GoodElement',
              kind: 'class',
              customElement: true,
              tagName: 'x-good',
            },
          ],
        },
      ],
    } as unknown as ManifestPackage);

    expect([...index.keys()]).toEqual(['x-good']);
    expect(index.get('x-good')?.name).toBe('GoodElement');
  });
});
