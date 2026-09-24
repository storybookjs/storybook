import { describe, expect, it } from 'vitest';

import type { ManifestClassField, ManifestDeclaration } from '../manifest/types.ts';
import { mapArgTypes } from './map-arg-types.ts';

const TYPE_PROPERTY = 'parsedType';

const declaration = (value: Partial<ManifestDeclaration>): ManifestDeclaration => ({
  customElement: true,
  kind: 'class',
  name: 'XCard',
  tagName: 'x-card',
  ...value,
});

describe('mapArgTypes', () => {
  it.each([
    {
      name: 'attribute + field with the same name',
      declaration: declaration({
        attributes: [{ name: 'label', fieldName: 'label', type: { text: 'string' } }],
        members: [
          {
            kind: 'field',
            name: 'label',
            description: 'Label description.',
            type: { text: 'string' },
            default: '"Label"',
          },
        ],
      }),
      expected: {
        label: {
          name: 'label',
          description: 'Label description.',
          type: { name: 'string' },
          table: {
            category: 'attributes',
            type: { summary: 'string' },
            defaultValue: { summary: '"Label"' },
          },
        },
      },
    },
    {
      name: 'attribute + field with different names',
      declaration: declaration({
        attributes: [{ name: 'is-open', fieldName: 'isOpen', type: { text: 'boolean' } }],
        members: [
          {
            kind: 'field',
            name: 'isOpen',
            description: 'Whether it is open.',
            type: { text: 'boolean' },
          },
        ],
      }),
      expected: {
        'is-open': {
          name: 'is-open',
          description: 'Whether it is open.',
          type: { name: 'boolean' },
          table: {
            category: 'attributes',
            type: { summary: 'boolean' },
            defaultValue: { summary: undefined },
          },
        },
        isOpen: {
          name: 'isOpen',
          description: 'Whether it is open.',
          type: { name: 'boolean' },
          table: {
            category: 'properties',
            type: { summary: 'boolean' },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'property-only field',
      declaration: declaration({
        members: [{ kind: 'field', name: 'items', type: { text: 'string[]' } }],
      }),
      expected: {
        items: {
          name: 'items',
          description: undefined,
          type: { name: 'array', value: { name: 'string' } },
          table: {
            category: 'properties',
            type: { summary: 'string[]' },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'attribute fallback for empty type text',
      declaration: declaration({
        attributes: [{ name: 'label', type: { text: '' } }],
      }),
      expected: {
        label: {
          name: 'label',
          description: undefined,
          type: { name: 'string' },
          table: {
            category: 'attributes',
            type: { summary: '' },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'property fallback for empty type text',
      declaration: declaration({
        members: [{ kind: 'field', name: 'label', type: { text: '' } }],
      }),
      expected: {
        label: {
          name: 'label',
          description: undefined,
          type: { name: 'other', value: '' },
          control: false,
          table: {
            category: 'properties',
            type: { summary: '' },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'readonly field',
      declaration: declaration({
        members: [{ kind: 'field', name: 'count', readonly: true, type: { text: 'number' } }],
      }),
      expected: {
        count: {
          name: 'count',
          description: undefined,
          type: { name: 'number' },
          control: false,
          table: {
            category: 'properties',
            type: { summary: 'number' },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'private protected static and hash fields skipped with attributes',
      declaration: declaration({
        attributes: [
          { name: 'secret', fieldName: 'secret', type: { text: 'string' } },
          { name: 'hidden', fieldName: 'hidden', type: { text: 'string' } },
          { name: 'global', fieldName: 'global', type: { text: 'string' } },
          { name: 'hash-secret', fieldName: '#hashSecret', type: { text: 'string' } },
        ],
        members: [
          { kind: 'field', name: 'secret', privacy: 'private', type: { text: 'string' } },
          { kind: 'field', name: 'hidden', privacy: 'protected', type: { text: 'string' } },
          { kind: 'field', name: 'global', static: true, type: { text: 'string' } },
          { kind: 'field', name: '#hashSecret', type: { text: 'string' } },
        ],
      }),
      expected: {},
    },
    {
      name: 'attribute without field kept',
      declaration: declaration({
        attributes: [{ name: 'tone', type: { text: "'neutral' | 'brand'" } }],
      }),
      expected: {
        tone: {
          name: 'tone',
          description: undefined,
          type: { name: 'enum', value: ['neutral', 'brand'] },
          table: {
            category: 'attributes',
            type: { summary: "'neutral' | 'brand'" },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'deprecated string',
      declaration: declaration({
        members: [
          {
            kind: 'field',
            name: 'tone',
            deprecated: 'Use variant instead.',
            type: { text: 'string' },
          },
        ],
      }),
      expected: {
        tone: {
          name: 'tone',
          description: undefined,
          type: { name: 'string' },
          table: {
            category: 'properties',
            type: { summary: 'string' },
            defaultValue: { summary: undefined },
            jsDocTags: { deprecated: 'Use variant instead.' },
          },
        },
      },
    },
    {
      name: 'deprecated boolean',
      declaration: declaration({
        attributes: [{ name: 'tone', deprecated: true, type: { text: 'string' } }],
      }),
      expected: {
        tone: {
          name: 'tone',
          description: undefined,
          type: { name: 'string' },
          table: {
            category: 'attributes',
            type: { summary: 'string' },
            defaultValue: { summary: undefined },
            jsDocTags: { deprecated: 'deprecated' },
          },
        },
      },
    },
    {
      name: 'summary preferred over description',
      declaration: declaration({
        members: [
          {
            kind: 'field',
            name: 'tone',
            summary: 'Tone summary.',
            description: 'Tone description.',
            type: { text: 'string' },
          },
        ],
      }),
      expected: {
        tone: {
          name: 'tone',
          description: 'Tone summary.',
          type: { name: 'string' },
          table: {
            category: 'properties',
            type: { summary: 'string' },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'alt type wins for SBType while raw type is preserved',
      declaration: declaration({
        members: [
          {
            kind: 'field',
            name: 'size',
            type: { text: 'Size' },
            parsedType: { text: "'small' | 'large'" },
          } as ManifestClassField & { parsedType: { text: string } },
        ],
      }),
      expected: {
        size: {
          name: 'size',
          description: undefined,
          type: { name: 'enum', value: ['small', 'large'] },
          table: {
            category: 'properties',
            type: { summary: 'Size' },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'custom type property',
      declaration: declaration({
        members: [
          {
            kind: 'field',
            name: 'size',
            type: { text: 'Size' },
            resolvedType: { text: "'small' | 'large'" },
          } as ManifestClassField & { resolvedType: { text: string } },
        ],
      }),
      typeProperty: 'resolvedType',
      expected: {
        size: {
          name: 'size',
          description: undefined,
          type: { name: 'enum', value: ['small', 'large'] },
          table: {
            category: 'properties',
            type: { summary: 'Size' },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'legacy parity groups',
      declaration: declaration({
        events: [
          {
            name: 'my-change',
            description: 'Change description.',
            type: { text: 'CustomEvent' },
          },
        ],
        slots: [{ name: 'label', description: 'Label slot.' }],
        cssProperties: [{ name: '--accent', description: 'Accent color.', default: 'red' }],
        cssParts: [{ name: 'button', description: 'Button part.' }],
      }),
      expected: {
        onMyChange: {
          name: 'onMyChange',
          action: { name: 'my-change' },
          table: { disable: true },
        },
        'my-change': {
          name: 'my-change',
          required: false,
          description: 'Change description.',
          type: { name: 'void' },
          table: {
            category: 'events',
            type: { summary: 'CustomEvent' },
            defaultValue: { summary: undefined },
          },
        },
        label: {
          name: 'label',
          required: false,
          description: 'Label slot.',
          type: { name: 'string' },
          table: {
            category: 'slots',
            type: { summary: undefined },
            defaultValue: { summary: undefined },
          },
        },
        '--accent': {
          name: '--accent',
          required: false,
          description: 'Accent color.',
          type: { name: 'void' },
          table: {
            category: 'css custom properties',
            type: { summary: undefined },
            defaultValue: { summary: 'red' },
          },
        },
        button: {
          name: 'button',
          required: false,
          description: 'Button part.',
          type: { name: 'void' },
          table: {
            category: 'css shadow parts',
            type: { summary: undefined },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'method skipped',
      declaration: declaration({
        members: [
          {
            kind: 'method',
            name: 'focus',
            parameters: [],
            return: { type: { text: 'void' } },
          },
        ],
      }),
      expected: {},
    },
  ] satisfies {
    name: string;
    declaration: ManifestDeclaration;
    typeProperty?: string;
    expected: Record<string, unknown>;
  }[])('$name', ({ declaration, typeProperty, expected }) => {
    expect(mapArgTypes(declaration, typeProperty ?? TYPE_PROPERTY)).toEqual(expected);
  });
});
