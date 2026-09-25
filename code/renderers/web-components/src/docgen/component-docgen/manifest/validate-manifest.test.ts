import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import type { ManifestPackage } from './types.ts';
import { validateManifest } from './validate-manifest.ts';

const VALID_MANIFEST = JSON.parse(
  readFileSync(
    'code/lib/docgen-harness/src/web-components/__testfixtures__/lit-events/custom-elements.json',
    'utf8'
  )
) as ManifestPackage;

const LIT_SCHEMA_WARNING_MANIFEST = JSON.parse(
  readFileSync(
    'code/lib/docgen-harness/src/web-components/__testfixtures__/lit-schema-warning/custom-elements.json',
    'utf8'
  )
) as ManifestPackage;

const TWO_VIOLATION_MANIFEST = {
  schemaVersion: '1.0.0',
  modules: [
    {
      kind: 'javascript-module',
      declarations: [
        {
          name: 'XElement',
          kind: 'class',
          customElement: true,
          tagName: 'x-element',
          members: [
            {
              name: 'value',
              kind: 'field',
              type: {},
            },
          ],
        },
      ],
    },
  ],
} as unknown as ManifestPackage;

function wrongKindManifest(): ManifestPackage {
  const manifest = JSON.parse(JSON.stringify(VALID_MANIFEST)) as ManifestPackage;
  const declaration = manifest.modules[0].declarations?.[0];
  if (declaration && 'members' in declaration && declaration.members?.[0]) {
    declaration.members[0].kind = 'bogus' as 'field';
  }
  return manifest;
}

describe('validateManifest', () => {
  it.each([
    'lit-schema-warning fixture',
    'module path and member type text violations',
    'wrong member kind only',
    'valid fixture',
  ])('%s', (name) => {
    if (name === 'lit-schema-warning fixture') {
      expect(validateManifest(LIT_SCHEMA_WARNING_MANIFEST)).toMatchInlineSnapshot(`
        [
          "/modules/0/declarations/0/members/0 must have required property 'kind'",
        ]
      `);
      return;
    }

    if (name === 'module path and member type text violations') {
      expect(validateManifest(TWO_VIOLATION_MANIFEST)).toMatchInlineSnapshot(`
        [
          "/modules/0 must have required property 'path'",
          "/modules/0/declarations/0/members/0/type must have required property 'text'",
        ]
      `);
      return;
    }

    if (name === 'wrong member kind only') {
      expect(validateManifest(wrongKindManifest())).toMatchInlineSnapshot(`
        [
          "/modules/0/declarations/0/members/0/kind must be equal to one of the allowed values",
        ]
      `);
      return;
    }

    expect(validateManifest(VALID_MANIFEST)).toMatchInlineSnapshot(`
        []
      `);
  });
});
