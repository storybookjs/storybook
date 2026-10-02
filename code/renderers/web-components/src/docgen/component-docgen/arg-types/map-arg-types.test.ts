import { describe, expect, it } from 'vitest';

import type {
  ManifestAttribute,
  ManifestClassField,
  ManifestCssCustomProperty,
  ManifestDeclaration,
  ManifestEvent,
} from '../manifest/types.ts';
import { mapArgTypes } from './map-arg-types.ts';

const TYPE_PROPERTY = 'parsedType';

const declaration = (value: Partial<ManifestDeclaration>): ManifestDeclaration => ({
  customElement: true,
  kind: 'class',
  name: 'XCard',
  tagName: 'x-card',
  ...value,
});

type MapArgTypesCase = {
  name: string;
  declaration: ManifestDeclaration;
  typeProperty?: string;
  expected: Record<string, unknown>;
};

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) {
    return [items];
  }

  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((rest) => [
      item,
      ...rest,
    ])
  );
}

function orderInvariantCases(): MapArgTypesCase[] {
  const attributesForOneField: ManifestAttribute[] = [
    { name: 'v', fieldName: 'v' },
    { name: 'value', fieldName: 'v' },
  ];
  const collidingFields: ManifestClassField[] = [
    { kind: 'field', name: 'a', type: { text: 'boolean' } },
    { kind: 'field', name: 'b', type: { text: 'number' } },
  ];
  return [
    ...permutations(attributesForOneField).map(
      (attributes, index): MapArgTypesCase => ({
        name: `two attributes on one field are order-independent ${index + 1}`,
        declaration: declaration({
          attributes,
          members: [{ kind: 'field', name: 'v', type: { text: 'string' } }],
        }),
        expected: {
          v: {
            name: 'v',
            description: undefined,
            type: { name: 'string' },
            table: {
              category: 'attributes',
              type: { summary: 'string' },
              defaultValue: { summary: undefined },
            },
          },
          value: {
            name: 'value',
            description: undefined,
            type: { name: 'string' },
            table: {
              category: 'attributes',
              type: { summary: 'string' },
              defaultValue: { summary: undefined },
            },
          },
        },
      })
    ),
    ...permutations(collidingFields).map(
      (members, index): MapArgTypesCase => ({
        name: `attribute key wins over same-name field ${index + 1}`,
        declaration: declaration({
          attributes: [{ name: 'b', fieldName: 'a' }],
          members,
        }),
        expected: {
          a: {
            name: 'a',
            description: undefined,
            type: { name: 'boolean' },
            table: {
              category: 'properties',
              type: { summary: 'boolean' },
              defaultValue: { summary: undefined },
            },
          },
          b: {
            name: 'b',
            description: undefined,
            type: { name: 'boolean' },
            table: {
              category: 'attributes',
              type: { summary: 'boolean' },
              defaultValue: { summary: undefined },
            },
          },
        },
      })
    ),
  ];
}

describe('mapArgTypes', () => {
  it.each([
    ...orderInvariantCases(),
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
      name: 'field description wins over attribute summary',
      declaration: declaration({
        attributes: [{ name: 'label', fieldName: 'label', summary: 'attr summary' }],
        members: [{ kind: 'field', name: 'label', description: 'field description' }],
      }),
      expected: {
        label: {
          name: 'label',
          description: 'field description',
          type: { name: 'string' },
          table: {
            category: 'attributes',
            type: { summary: undefined },
            defaultValue: { summary: undefined },
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
      name: 'attribute fallback for non-string type text',
      declaration: declaration({
        attributes: [
          { name: 'count', type: { text: 5 } } as ManifestAttribute & {
            type: { text: number };
          },
        ],
      }),
      expected: {
        count: {
          name: 'count',
          description: undefined,
          type: { name: 'string' },
          table: {
            category: 'attributes',
            type: { summary: undefined },
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
      name: 'attribute and same-name slot use distinct keys',
      declaration: declaration({
        attributes: [{ name: 'label', type: { text: 'number' }, default: '42' }],
        slots: [{ name: 'label', description: 'Label slot.' }],
      }),
      expected: {
        label: {
          name: 'label',
          description: undefined,
          type: { name: 'number' },
          table: {
            category: 'attributes',
            type: { summary: 'number' },
            defaultValue: { summary: '42' },
          },
        },
        'label-slot': {
          name: 'label',
          description: 'Label slot.',
          type: { name: 'string' },
          table: {
            category: 'slots',
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
      name: 'attribute data is used for an untyped backed field',
      declaration: declaration({
        attributes: [
          {
            name: 'size',
            fieldName: 'sizeValue',
            type: { text: 'Size' },
            parsedType: { text: "'s' | 'm'" },
            description: 'Size.',
            default: "'s'",
          } as ManifestAttribute & { parsedType: { text: string } },
        ],
        members: [{ kind: 'field', name: 'sizeValue' }],
      }),
      expected: {
        sizeValue: {
          name: 'sizeValue',
          description: 'Size.',
          type: { name: 'enum', value: ['s', 'm'] },
          table: {
            category: 'properties',
            type: { summary: 'Size' },
            defaultValue: { summary: "'s'" },
          },
        },
        size: {
          name: 'size',
          description: 'Size.',
          type: { name: 'enum', value: ['s', 'm'] },
          table: {
            category: 'attributes',
            type: { summary: 'Size' },
            defaultValue: { summary: "'s'" },
          },
        },
      },
    },
    {
      name: 'attribute deprecated tag is not masked by field deprecated false',
      declaration: declaration({
        attributes: [
          {
            name: 'tone',
            fieldName: 'tone',
            deprecated: 'Use variant.',
            type: { text: 'string' },
          },
        ],
        members: [{ kind: 'field', name: 'tone', deprecated: false, type: { text: 'string' } }],
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
            jsDocTags: { deprecated: 'Use variant.' },
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
      name: 'blank alt type falls back to raw type text',
      declaration: declaration({
        members: [
          {
            kind: 'field',
            name: 'tone',
            type: { text: "'a' | 'b'" },
            parsedType: { text: '' },
          } as ManifestClassField & { parsedType: { text: string } },
        ],
      }),
      expected: {
        tone: {
          name: 'tone',
          description: undefined,
          type: { name: 'enum', value: ['a', 'b'] },
          table: {
            category: 'properties',
            type: { summary: "'a' | 'b'" },
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
      name: 'typed event',
      declaration: declaration({
        events: [
          {
            name: 'my-change',
            description: 'Change description.',
            type: { text: 'CustomEvent<{ value: string }>' },
          },
        ],
      }),
      expected: {
        'my-change-event': {
          name: 'my-change',
          description: 'Change description.',
          type: { name: 'other', value: 'CustomEvent<{ value: string }>' },
          control: false,
          table: {
            category: 'events',
            type: { summary: 'CustomEvent<{ value: string }>' },
          },
        },
      },
    },
    {
      name: 'property wins event action twin',
      declaration: declaration({
        members: [{ kind: 'field', name: 'onMyChange', type: { text: 'string' } }],
        events: [{ name: 'my-change', type: { text: 'CustomEvent<{ value: string }>' } }],
      }),
      expected: {
        'my-change-event': {
          name: 'my-change',
          description: undefined,
          type: { name: 'other', value: 'CustomEvent<{ value: string }>' },
          control: false,
          table: {
            category: 'events',
            type: { summary: 'CustomEvent<{ value: string }>' },
          },
        },
        onMyChange: {
          name: 'onMyChange',
          description: undefined,
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
      name: 'untyped event falls back to CustomEvent',
      declaration: declaration({
        events: [{ name: 'ready' } as ManifestEvent],
      }),
      expected: {
        'ready-event': {
          name: 'ready',
          description: undefined,
          type: { name: 'other', value: 'CustomEvent' },
          control: false,
          table: {
            category: 'events',
            type: { summary: 'CustomEvent' },
          },
        },
      },
    },
    {
      name: 'deprecated event',
      declaration: declaration({
        events: [
          {
            name: 'my-close',
            deprecated: 'Use my-dismiss instead.',
            type: { text: 'CustomEvent<void>' },
          },
        ],
      }),
      expected: {
        'my-close-event': {
          name: 'my-close',
          description: undefined,
          type: { name: 'other', value: 'CustomEvent<void>' },
          control: false,
          table: {
            category: 'events',
            type: { summary: 'CustomEvent<void>' },
            jsDocTags: { deprecated: 'Use my-dismiss instead.' },
          },
        },
      },
    },
    {
      name: 'event reads the custom type property',
      declaration: declaration({
        events: [
          {
            name: 'value-change',
            type: { text: 'ValueChangeEvent' },
            resolvedType: { text: 'CustomEvent<{ value: number }>' },
          } as ManifestEvent & { resolvedType: { text: string } },
        ],
      }),
      typeProperty: 'resolvedType',
      expected: {
        'value-change-event': {
          name: 'value-change',
          description: undefined,
          type: { name: 'other', value: 'CustomEvent<{ value: number }>' },
          control: false,
          table: {
            category: 'events',
            type: { summary: 'CustomEvent<{ value: number }>' },
          },
        },
      },
    },
    {
      name: 'public method with optional and default parameters',
      declaration: declaration({
        members: [
          {
            kind: 'method',
            name: 'focusItem',
            description: 'Focuses one item.',
            parameters: [
              { name: 'index', type: { text: 'number' } },
              {
                name: 'options',
                optional: true,
                type: { text: '{ smooth: boolean }' },
                default: '{ smooth: true }',
              },
            ],
            return: { type: { text: 'boolean' } },
          },
        ],
      }),
      expected: {
        'focusItem-method': {
          name: 'focusItem',
          description: 'Focuses one item.',
          type: { name: 'function' },
          table: {
            category: 'methods',
            type: {
              summary:
                '(index: number, options?: { smooth: boolean } = { smooth: true }) => boolean',
            },
          },
        },
      },
    },
    {
      name: 'public method without return type',
      declaration: declaration({
        members: [
          {
            kind: 'method',
            name: 'show',
            description: 'Shows the component.',
            parameters: [{ name: 'to', optional: true, type: { text: 'number' }, default: '0' }],
          },
        ],
      }),
      expected: {
        'show-method': {
          name: 'show',
          description: 'Shows the component.',
          type: { name: 'function' },
          table: {
            category: 'methods',
            type: { summary: '(to?: number = 0)' },
          },
        },
      },
    },
    {
      name: 'whitespace-only deprecated is dropped on every category',
      declaration: declaration({
        events: [{ name: 'ready', deprecated: '   ' } as ManifestEvent],
        slots: [{ name: 'actions', description: 'Actions slot.', deprecated: '   ' }],
      }),
      expected: {
        'ready-event': {
          name: 'ready',
          description: undefined,
          type: { name: 'other', value: 'CustomEvent' },
          control: false,
          table: {
            category: 'events',
            type: { summary: 'CustomEvent' },
          },
        },
        'actions-slot': {
          name: 'actions',
          description: 'Actions slot.',
          type: { name: 'string' },
          table: {
            category: 'slots',
          },
        },
      },
    },
    {
      name: 'private static protected and hash methods skipped',
      declaration: declaration({
        members: [
          { kind: 'method', name: 'secret', privacy: 'private' },
          { kind: 'method', name: 'hidden', privacy: 'protected' },
          { kind: 'method', name: 'global', static: true },
          { kind: 'method', name: '#focus' },
        ],
      }),
      expected: {},
    },
    {
      name: 'default and named slots',
      declaration: declaration({
        slots: [
          { name: '', description: 'Default content.' },
          { name: 'actions', summary: 'Action controls.' },
        ],
      }),
      expected: {
        'default-slot': {
          name: 'default',
          description: 'Default content.',
          type: { name: 'string' },
          table: {
            category: 'slots',
          },
        },
        'actions-slot': {
          name: 'actions',
          description: 'Action controls.',
          type: { name: 'string' },
          table: {
            category: 'slots',
          },
        },
      },
    },
    {
      name: 'css custom properties',
      declaration: declaration({
        cssProperties: [
          {
            name: '--accent',
            description: 'Accent color.',
            syntax: '<color>',
            default: 'red',
          },
          {
            name: '--border-colour',
            description: 'Border colour.',
          },
          {
            name: '--columns',
            type: { text: '<integer>' },
          } as ManifestCssCustomProperty & { type: { text: string } },
          {
            name: '--spacing',
          },
        ],
      }),
      expected: {
        '--accent': {
          name: '--accent',
          description: 'Accent color.',
          type: { name: 'string' },
          control: { type: 'color' },
          table: {
            category: 'css custom properties',
            type: { summary: '<color>' },
            defaultValue: { summary: 'red' },
          },
        },
        '--border-colour': {
          name: '--border-colour',
          description: 'Border colour.',
          type: { name: 'string' },
          table: {
            category: 'css custom properties',
            type: { summary: undefined },
            defaultValue: { summary: undefined },
          },
        },
        '--columns': {
          name: '--columns',
          description: undefined,
          type: { name: 'number' },
          table: {
            category: 'css custom properties',
            type: { summary: '<integer>' },
            defaultValue: { summary: undefined },
          },
        },
        '--spacing': {
          name: '--spacing',
          description: undefined,
          type: { name: 'string' },
          table: {
            category: 'css custom properties',
            type: { summary: undefined },
            defaultValue: { summary: undefined },
          },
        },
      },
    },
    {
      name: 'css part',
      declaration: declaration({
        cssParts: [{ name: 'button', description: 'Button part.' }],
      }),
      expected: {
        'button-part': {
          name: 'button',
          description: 'Button part.',
          type: { name: 'string' },
          table: {
            category: 'css shadow parts',
          },
        },
      },
    },
    {
      name: 'css state',
      declaration: declaration({
        cssStates: [{ name: 'open', description: 'Set while open.' }],
      }),
      expected: {
        'open-state': {
          name: 'open',
          description: 'Set while open.',
          type: { name: 'string' },
          table: {
            category: 'css states',
          },
        },
      },
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
