import { TypeSystem } from 'storybook/internal/docs-tools';

import type { VueDocgenInfo } from '../../../../../frameworks/vue3-vite/src';

type TestComponent = { __docgenInfo: VueDocgenInfo<'vue-component-meta'> };

export const referenceTypeProps: TestComponent = {
  __docgenInfo: {
    type: 1,
    props: [
      {
        name: 'bar',
        global: false,
        description: 'description bar is optional number',
        tags: [],
        required: false,
        type: 'number | undefined',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'number | undefined',
          schema: ['undefined', 'number'],
        },
        default: '1',
      },
      {
        name: 'stringArray',
        global: false,
        description: 'description stringArray is string array',
        tags: [],
        required: false,
        type: 'string[] | undefined',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'string[] | undefined',
          schema: [
            'undefined',
            {
              kind: 'array',
              type: 'string[]',
              schema: ['string'],
            },
          ],
        },
        default: '["foo", "bar"]',
      },
      {
        name: 'key',
        global: true,
        description: '',
        tags: [],
        required: false,
        type: 'string | number | symbol | undefined',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'string | number | symbol | undefined',
          schema: ['undefined', 'string', 'number', 'symbol'],
        },
      },
      {
        name: 'ref',
        global: true,
        description: '',
        tags: [],
        required: false,
        type: 'VNodeRef | undefined',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'VNodeRef | undefined',
          schema: [
            'undefined',
            'string',
            'Ref<any>',
            {
              kind: 'event',
              type: '(ref: Element | ComponentPublicInstance<{}, {}, {}, {}, {}, {}, {}, {}, false, ComponentOptionsBase<any, any, any, any, any, any, any, any, any, {}, {}, string, {}>, {}, {}> | null, refs: Record<...>): void',
              schema: [],
            },
          ],
        },
      },
      {
        name: 'ref_for',
        global: true,
        description: '',
        tags: [],
        required: false,
        type: 'boolean | undefined',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'boolean | undefined',
          schema: ['undefined', 'false', 'true'],
        },
      },
      {
        name: 'ref_key',
        global: true,
        description: '',
        tags: [],
        required: false,
        type: 'string | undefined',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'string | undefined',
          schema: ['undefined', 'string'],
        },
      },
      {
        name: 'class',
        global: true,
        description: '',
        tags: [],
        required: false,
        type: 'unknown',
        declarations: [],
        schema: 'unknown',
      },
      {
        name: 'style',
        global: true,
        description: '',
        tags: [],
        required: false,
        type: 'unknown',
        declarations: [],
        schema: 'unknown',
      },
      {
        name: 'foo',
        global: false,
        description: 'string foo',
        tags: [
          {
            name: 'default',
            text: '"rounded"',
          },
          {
            name: 'since',
            text: 'v1.0.0',
          },
          {
            name: 'see',
            text: 'https://vuejs.org/',
          },
          {
            name: 'deprecated',
            text: 'v1.1.0',
          },
        ],
        required: true,
        type: 'string',
        declarations: [],
        schema: 'string',
      },
      {
        name: 'baz',
        global: false,
        description: 'description baz is required boolean',
        tags: [],
        required: true,
        type: 'boolean',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'boolean',
          schema: ['false', 'true'],
        },
      },
      {
        name: 'union',
        global: false,
        description: 'description union is required union type',
        tags: [],
        required: true,
        type: 'string | number',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'string | number',
          schema: ['string', 'number'],
        },
      },
      {
        name: 'unionOptional',
        global: false,
        description: 'description unionOptional is optional union type',
        tags: [],
        required: false,
        type: 'string | number | boolean | undefined',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'string | number | boolean | undefined',
          schema: ['undefined', 'string', 'number', 'false', 'true'],
        },
      },
      {
        name: 'nested',
        global: false,
        description: 'description nested is required nested object',
        tags: [],
        required: true,
        type: 'MyNestedProps',
        declarations: [],
        schema: {
          kind: 'object',
          type: 'MyNestedProps',
          schema: {
            nestedProp: {
              name: 'nestedProp',
              global: false,
              description: 'nested prop documentation',
              tags: [],
              required: true,
              type: 'string',
              declarations: [],
              schema: 'string',
            },
          },
        },
      },
      {
        name: 'nestedIntersection',
        global: false,
        description: 'description required nested object with intersection',
        tags: [],
        required: true,
        type: 'MyNestedProps & { additionalProp: string; }',
        declarations: [],
        schema: {
          kind: 'object',
          type: 'MyNestedProps & { additionalProp: string; }',
          schema: {
            nestedProp: {
              name: 'nestedProp',
              global: false,
              description: 'nested prop documentation',
              tags: [],
              required: true,
              type: 'string',
              declarations: [],
              schema: 'string',
            },
            additionalProp: {
              name: 'additionalProp',
              global: false,
              description: 'description required additional property',
              tags: [],
              required: true,
              type: 'string',
              declarations: [],
              schema: 'string',
            },
          },
        },
      },
      {
        name: 'nestedOptional',
        global: false,
        description: 'description optional nested object',
        tags: [],
        required: false,
        type: 'MyNestedProps | MyIgnoredNestedProps | undefined',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'MyNestedProps | MyIgnoredNestedProps | undefined',
          schema: [
            'undefined',
            {
              kind: 'object',
              type: 'MyNestedProps',
              schema: {
                nestedProp: {
                  name: 'nestedProp',
                  global: false,
                  description: 'nested prop documentation',
                  tags: [],
                  required: true,
                  type: 'string',
                  declarations: [],
                  schema: 'string',
                },
              },
            },
            {
              kind: 'object',
              type: 'MyIgnoredNestedProps',
              schema: {
                nestedProp: {
                  name: 'nestedProp',
                  global: false,
                  description: '',
                  tags: [],
                  required: true,
                  type: 'string',
                  declarations: [],
                  schema: 'string',
                },
              },
            },
          ],
        },
      },
      {
        name: 'array',
        global: false,
        description: 'description required array object',
        tags: [],
        required: true,
        type: 'MyNestedProps[]',
        declarations: [],
        schema: {
          kind: 'array',
          type: 'MyNestedProps[]',
          schema: [
            {
              kind: 'object',
              type: 'MyNestedProps',
              schema: {
                nestedProp: {
                  name: 'nestedProp',
                  global: false,
                  description: 'nested prop documentation',
                  tags: [],
                  required: true,
                  type: 'string',
                  declarations: [],
                  schema: 'string',
                },
              },
            },
          ],
        },
      },
      {
        name: 'arrayOptional',
        global: false,
        description: 'description optional array object',
        tags: [],
        required: false,
        type: 'MyNestedProps[] | undefined',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'MyNestedProps[] | undefined',
          schema: [
            'undefined',
            {
              kind: 'array',
              type: 'MyNestedProps[]',
              schema: [
                {
                  kind: 'object',
                  type: 'MyNestedProps',
                  schema: {
                    nestedProp: {
                      name: 'nestedProp',
                      global: false,
                      description: 'nested prop documentation',
                      tags: [],
                      required: true,
                      type: 'string',
                      declarations: [],
                      schema: 'string',
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      {
        name: 'enumValue',
        global: false,
        description: 'description enum value',
        tags: [],
        required: true,
        type: 'MyEnum',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'MyEnum',
          schema: ['MyEnum.Small', 'MyEnum.Medium', 'MyEnum.Large'],
        },
      },
      {
        name: 'literalFromContext',
        global: false,
        description: 'description literal type alias that require context',
        tags: [],
        required: true,
        type: '"Uncategorized" | "Content" | "Interaction" | "Display" | "Forms" | "Addons"',
        declarations: [],
        schema: {
          kind: 'enum',
          type: '"Uncategorized" | "Content" | "Interaction" | "Display" | "Forms" | "Addons"',
          schema: [
            '"Uncategorized"',
            '"Content"',
            '"Interaction"',
            '"Display"',
            '"Forms"',
            '"Addons"',
          ],
        },
      },
      {
        name: 'inlined',
        global: false,
        description: '',
        tags: [],
        required: true,
        type: '{ foo: string; }',
        declarations: [],
        schema: {
          kind: 'object',
          type: '{ foo: string; }',
          schema: {
            foo: {
              name: 'foo',
              global: false,
              description: '',
              tags: [],
              required: true,
              type: 'string',
              declarations: [],
              schema: 'string',
            },
          },
        },
      },
      {
        name: 'recursive',
        global: false,
        description: '',
        tags: [],
        required: false,
        type: 'MyNestedRecursiveProps | undefined',
        declarations: [],
        schema: {
          kind: 'enum',
          type: 'MyNestedRecursiveProps | undefined',
          schema: [
            'undefined',
            {
              kind: 'object',
              type: 'MyNestedRecursiveProps',
              schema: {
                recursive: {
                  name: 'recursive',
                  global: false,
                  description: '',
                  tags: [],
                  required: true,
                  type: 'MyNestedRecursiveProps',
                  declarations: [],
                  schema: 'MyNestedRecursiveProps',
                },
              },
            },
          ],
        },
      },
    ],
    events: [],
    slots: [],
    exposed: [],
  },
};

export const mockExtractComponentPropsReturn = [
  {
    propDef: {
      name: 'bar',
      type: {},
      required: false,
      description: 'description bar is optional number',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'bar',
      global: false,
      description: 'description bar is optional number',
      tags: [],
      required: false,
      type: 'number | undefined',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'number | undefined',
        schema: ['undefined', 'number'],
      },
      default: '1',
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'stringArray',
      type: {},
      required: false,
      description: 'description stringArray is string array',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'stringArray',
      global: false,
      description: 'description stringArray is string array',
      tags: [],
      required: false,
      type: 'string[] | undefined',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'string[] | undefined',
        schema: [
          'undefined',
          {
            kind: 'array',
            type: 'string[]',
            schema: ['string'],
          },
        ],
      },
      default: '["foo", "bar"]',
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'key',
      type: {},
      required: false,
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'key',
      global: true,
      description: '',
      tags: [],
      required: false,
      type: 'string | number | symbol | undefined',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'string | number | symbol | undefined',
        schema: ['undefined', 'string', 'number', 'symbol'],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'ref',
      type: {},
      required: false,
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'ref',
      global: true,
      description: '',
      tags: [],
      required: false,
      type: 'VNodeRef | undefined',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'VNodeRef | undefined',
        schema: [
          'undefined',
          'string',
          'Ref<any>',
          {
            kind: 'event',
            type: '(ref: Element | ComponentPublicInstance<{}, {}, {}, {}, {}, {}, {}, {}, false, ComponentOptionsBase<any, any, any, any, any, any, any, any, any, {}, {}, string, {}>, {}, {}> | null, refs: Record<...>): void',
            schema: [],
          },
        ],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'ref_for',
      type: {},
      required: false,
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'ref_for',
      global: true,
      description: '',
      tags: [],
      required: false,
      type: 'boolean | undefined',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'boolean | undefined',
        schema: ['undefined', 'false', 'true'],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'ref_key',
      type: {},
      required: false,
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'ref_key',
      global: true,
      description: '',
      tags: [],
      required: false,
      type: 'string | undefined',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'string | undefined',
        schema: ['undefined', 'string'],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'class',
      type: {},
      required: false,
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'class',
      global: true,
      description: '',
      tags: [],
      required: false,
      type: 'unknown',
      declarations: [],
      schema: 'unknown',
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'style',
      type: {},
      required: false,
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'style',
      global: true,
      description: '',
      tags: [],
      required: false,
      type: 'unknown',
      declarations: [],
      schema: 'unknown',
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'foo',
      type: {},
      required: true,
      description: 'string foo',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'foo',
      global: false,
      description: 'string foo',
      tags: [
        {
          name: 'default',
          text: '"rounded"',
        },
        {
          name: 'since',
          text: 'v1.0.0',
        },
        {
          name: 'see',
          text: 'https://vuejs.org/',
        },
        {
          name: 'deprecated',
          text: 'v1.1.0',
        },
      ],
      required: true,
      type: 'string',
      declarations: [],
      schema: 'string',
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'baz',
      type: {},
      required: true,
      description: 'description baz is required boolean',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'baz',
      global: false,
      description: 'description baz is required boolean',
      tags: [],
      required: true,
      type: 'boolean',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'boolean',
        schema: ['false', 'true'],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'union',
      type: {},
      required: true,
      description: 'description union is required union type',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'union',
      global: false,
      description: 'description union is required union type',
      tags: [],
      required: true,
      type: 'string | number',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'string | number',
        schema: ['string', 'number'],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'unionOptional',
      type: {},
      required: false,
      description: 'description unionOptional is optional union type',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'unionOptional',
      global: false,
      description: 'description unionOptional is optional union type',
      tags: [],
      required: false,
      type: 'string | number | boolean | undefined',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'string | number | boolean | undefined',
        schema: ['undefined', 'string', 'number', 'false', 'true'],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'nested',
      type: {},
      required: true,
      description: 'description nested is required nested object',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'nested',
      global: false,
      description: 'description nested is required nested object',
      tags: [],
      required: true,
      type: 'MyNestedProps',
      declarations: [],
      schema: {
        kind: 'object',
        type: 'MyNestedProps',
        schema: {
          nestedProp: {
            name: 'nestedProp',
            global: false,
            description: 'nested prop documentation',
            tags: [],
            required: true,
            type: 'string',
            declarations: [],
            schema: 'string',
          },
        },
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'nestedIntersection',
      type: {},
      required: true,
      description: 'description required nested object with intersection',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'nestedIntersection',
      global: false,
      description: 'description required nested object with intersection',
      tags: [],
      required: true,
      type: 'MyNestedProps & { additionalProp: string; }',
      declarations: [],
      schema: {
        kind: 'object',
        type: 'MyNestedProps & { additionalProp: string; }',
        schema: {
          nestedProp: {
            name: 'nestedProp',
            global: false,
            description: 'nested prop documentation',
            tags: [],
            required: true,
            type: 'string',
            declarations: [],
            schema: 'string',
          },
          additionalProp: {
            name: 'additionalProp',
            global: false,
            description: 'description required additional property',
            tags: [],
            required: true,
            type: 'string',
            declarations: [],
            schema: 'string',
          },
        },
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'nestedOptional',
      type: {},
      required: false,
      description: 'description optional nested object',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'nestedOptional',
      global: false,
      description: 'description optional nested object',
      tags: [],
      required: false,
      type: 'MyNestedProps | MyIgnoredNestedProps | undefined',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'MyNestedProps | MyIgnoredNestedProps | undefined',
        schema: [
          'undefined',
          {
            kind: 'object',
            type: 'MyNestedProps',
            schema: {
              nestedProp: {
                name: 'nestedProp',
                global: false,
                description: 'nested prop documentation',
                tags: [],
                required: true,
                type: 'string',
                declarations: [],
                schema: 'string',
              },
            },
          },
          {
            kind: 'object',
            type: 'MyIgnoredNestedProps',
            schema: {
              nestedProp: {
                name: 'nestedProp',
                global: false,
                description: '',
                tags: [],
                required: true,
                type: 'string',
                declarations: [],
                schema: 'string',
              },
            },
          },
        ],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'array',
      type: {},
      required: true,
      description: 'description required array object',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'array',
      global: false,
      description: 'description required array object',
      tags: [],
      required: true,
      type: 'MyNestedProps[]',
      declarations: [],
      schema: {
        kind: 'array',
        type: 'MyNestedProps[]',
        schema: [
          {
            kind: 'object',
            type: 'MyNestedProps',
            schema: {
              nestedProp: {
                name: 'nestedProp',
                global: false,
                description: 'nested prop documentation',
                tags: [],
                required: true,
                type: 'string',
                declarations: [],
                schema: 'string',
              },
            },
          },
        ],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'arrayOptional',
      type: {},
      required: false,
      description: 'description optional array object',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'arrayOptional',
      global: false,
      description: 'description optional array object',
      tags: [],
      required: false,
      type: 'MyNestedProps[] | undefined',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'MyNestedProps[] | undefined',
        schema: [
          'undefined',
          {
            kind: 'array',
            type: 'MyNestedProps[]',
            schema: [
              {
                kind: 'object',
                type: 'MyNestedProps',
                schema: {
                  nestedProp: {
                    name: 'nestedProp',
                    global: false,
                    description: 'nested prop documentation',
                    tags: [],
                    required: true,
                    type: 'string',
                    declarations: [],
                    schema: 'string',
                  },
                },
              },
            ],
          },
        ],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'enumValue',
      type: {},
      required: true,
      description: 'description enum value',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'enumValue',
      global: false,
      description: 'description enum value',
      tags: [],
      required: true,
      type: 'MyEnum',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'MyEnum',
        schema: ['MyEnum.Small', 'MyEnum.Medium', 'MyEnum.Large'],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'literalFromContext',
      type: {},
      required: true,
      description: 'description literal type alias that require context',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'literalFromContext',
      global: false,
      description: 'description literal type alias that require context',
      tags: [],
      required: true,
      type: '"Uncategorized" | "Content" | "Interaction" | "Display" | "Forms" | "Addons"',
      declarations: [],
      schema: {
        kind: 'enum',
        type: '"Uncategorized" | "Content" | "Interaction" | "Display" | "Forms" | "Addons"',
        schema: [
          '"Uncategorized"',
          '"Content"',
          '"Interaction"',
          '"Display"',
          '"Forms"',
          '"Addons"',
        ],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'inlined',
      type: {},
      required: true,
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'inlined',
      global: false,
      description: '',
      tags: [],
      required: true,
      type: '{ foo: string; }',
      declarations: [],
      schema: {
        kind: 'object',
        type: '{ foo: string; }',
        schema: {
          foo: {
            name: 'foo',
            global: false,
            description: '',
            tags: [],
            required: true,
            type: 'string',
            declarations: [],
            schema: 'string',
          },
        },
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'recursive',
      type: {},
      required: false,
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'recursive',
      global: false,
      description: '',
      tags: [],
      required: false,
      type: 'MyNestedRecursiveProps | undefined',
      declarations: [],
      schema: {
        kind: 'enum',
        type: 'MyNestedRecursiveProps | undefined',
        schema: [
          'undefined',
          {
            kind: 'object',
            type: 'MyNestedRecursiveProps',
            schema: {
              recursive: {
                name: 'recursive',
                global: false,
                description: '',
                tags: [],
                required: true,
                type: 'MyNestedRecursiveProps',
                declarations: [],
                schema: 'MyNestedRecursiveProps',
              },
            },
          },
        ],
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
];

export const referenceTypeEvents: TestComponent = {
  __docgenInfo: {
    type: 1,
    props: [],
    events: [
      {
        name: 'foo',
        description: '',
        tags: [],
        type: '[data?: { foo: string; } | undefined]',
        signature: '(event: "foo", data?: { foo: string; } | undefined): void',
        declarations: [],
        schema: [
          {
            kind: 'enum',
            type: '{ foo: string; } | undefined',
            schema: [
              'undefined',
              {
                kind: 'object',
                type: '{ foo: string; }',
                schema: {
                  foo: {
                    name: 'foo',
                    global: false,
                    description: '',
                    tags: [],
                    required: true,
                    type: 'string',
                    declarations: [],
                    schema: 'string',
                  },
                },
              },
            ],
          },
        ],
      },
      {
        name: 'bar',
        description: '',
        tags: [],
        type: '[value: { year: number; title?: any; }]',
        signature: '(event: "bar", value: { year: number; title?: any; }): void',
        declarations: [],
        schema: [
          {
            kind: 'object',
            type: '{ year: number; title?: any; }',
            schema: {
              year: {
                name: 'year',
                global: false,
                description: '',
                tags: [],
                required: true,
                type: 'number',
                declarations: [],
                schema: 'number',
              },
              title: {
                name: 'title',
                global: false,
                description: '',
                tags: [],
                required: false,
                type: 'any',
                declarations: [],
                schema: 'any',
              },
            },
          },
        ],
      },
      {
        name: 'baz',
        description: '',
        tags: [],
        type: '[]',
        signature: '(event: "baz"): void',
        declarations: [],
        schema: [],
      },
    ],
    slots: [],
    exposed: [],
  },
};

export const mockExtractComponentEventsReturn = [
  {
    propDef: {
      name: 'foo',
      type: {},
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'foo',
      type: '[data?: { foo: string; } | undefined]',
      signature: '(event: "foo", data?: { foo: string; } | undefined): void',
      declarations: [],
      schema: [
        {
          kind: 'enum',
          type: '{ foo: string; } | undefined',
          schema: [
            'undefined',
            {
              kind: 'object',
              type: '{ foo: string; }',
              schema: {
                foo: {
                  name: 'foo',
                  global: false,
                  description: '',
                  tags: [],
                  required: true,
                  type: 'string',
                  declarations: [],
                  schema: 'string',
                },
              },
            },
          ],
        },
      ],
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'bar',
      type: {},
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'bar',
      type: '[value: { year: number; title?: any; }]',
      signature: '(event: "bar", value: { year: number; title?: any; }): void',
      declarations: [],
      schema: [
        {
          kind: 'object',
          type: '{ year: number; title?: any; }',
          schema: {
            year: {
              name: 'year',
              global: false,
              description: '',
              tags: [],
              required: true,
              type: 'number',
              declarations: [],
              schema: 'number',
            },
            title: {
              name: 'title',
              global: false,
              description: '',
              tags: [],
              required: false,
              type: 'any',
              declarations: [],
              schema: 'any',
            },
          },
        },
      ],
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'baz',
      type: {},
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'baz',
      type: '[]',
      signature: '(event: "baz"): void',
      declarations: [],
      schema: [],
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
];

export const templateSlots: TestComponent = {
  __docgenInfo: {
    type: 1,
    props: [],
    events: [],
    slots: [
      {
        name: 'no-bind',
        type: '{}',
        description: '',
        declarations: [],
        schema: {
          kind: 'object',
          type: '{}',
          schema: {},
        },
      },
      {
        name: 'default',
        type: '{ num: number; }',
        description: '',
        declarations: [],
        schema: {
          kind: 'object',
          type: '{ num: number; }',
          schema: {
            num: {
              name: 'num',
              global: false,
              description: '',
              tags: [],
              required: true,
              type: 'number',
              declarations: [],
              schema: 'number',
            },
          },
        },
      },
      {
        name: 'named',
        type: '{ str: string; }',
        description: '',
        declarations: [],
        schema: {
          kind: 'object',
          type: '{ str: string; }',
          schema: {
            str: {
              name: 'str',
              global: false,
              description: '',
              tags: [],
              required: true,
              type: 'string',
              declarations: [],
              schema: 'string',
            },
          },
        },
      },
      {
        name: 'vbind',
        type: '{ num: number; str: string; }',
        description: '',
        declarations: [],
        schema: {
          kind: 'object',
          type: '{ num: number; str: string; }',
          schema: {
            num: {
              name: 'num',
              global: false,
              description: '',
              tags: [],
              required: true,
              type: 'number',
              declarations: [],
              schema: 'number',
            },
            str: {
              name: 'str',
              global: false,
              description: '',
              tags: [],
              required: true,
              type: 'string',
              declarations: [],
              schema: 'string',
            },
          },
        },
      },
    ],
    exposed: [],
  },
};

export const mockExtractComponentSlotsReturn = [
  {
    propDef: {
      name: 'no-bind',
      type: {},
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'no-bind',
      type: '{}',
      description: '',
      declarations: [],
      schema: {
        kind: 'object',
        type: '{}',
        schema: {},
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'default',
      type: {},
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'default',
      type: '{ num: number; }',
      description: '',
      declarations: [],
      schema: {
        kind: 'object',
        type: '{ num: number; }',
        schema: {
          num: {
            name: 'num',
            global: false,
            description: '',
            tags: [],
            required: true,
            type: 'number',
            declarations: [],
            schema: 'number',
          },
        },
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'named',
      type: {},
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'named',
      type: '{ str: string; }',
      description: '',
      declarations: [],
      schema: {
        kind: 'object',
        type: '{ str: string; }',
        schema: {
          str: {
            name: 'str',
            global: false,
            description: '',
            tags: [],
            required: true,
            type: 'string',
            declarations: [],
            schema: 'string',
          },
        },
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
  {
    propDef: {
      name: 'vbind',
      type: {},
      description: '',
      defaultValue: null,
      sbType: {
        name: 'other',
      },
    },
    docgenInfo: {
      name: 'vbind',
      type: '{ num: number; str: string; }',
      description: '',
      declarations: [],
      schema: {
        kind: 'object',
        type: '{ num: number; str: string; }',
        schema: {
          num: {
            name: 'num',
            global: false,
            description: '',
            tags: [],
            required: true,
            type: 'number',
            declarations: [],
            schema: 'number',
          },
          str: {
            name: 'str',
            global: false,
            description: '',
            tags: [],
            required: true,
            type: 'string',
            declarations: [],
            schema: 'string',
          },
        },
      },
    },
    typeSystem: TypeSystem.JAVASCRIPT,
  },
];

export const vueDocgenMocks = {
  props: {
    component: {
      __docgenInfo: {
        description: '',
        tags: {},
        props: [
          {
            name: 'foo',
            description: 'string foo',
            tags: {
              default: [
                {
                  description: '"rounded"',
                  title: 'default',
                },
              ],
              since: [
                {
                  description: 'v1.0.0',
                  title: 'since',
                },
              ],
              see: [
                {
                  description: 'https://vuejs.org/',
                  title: 'see',
                },
              ],
              deprecated: [
                {
                  description: 'v1.1.0',
                  title: 'deprecated',
                },
              ],
            },
            required: true,
            type: {
              name: 'string',
            },
          },
          {
            name: 'bar',
            description: 'description bar is optional number',
            required: false,
            type: {
              name: 'number',
            },
            defaultValue: {
              func: false,
              value: '1',
            },
          },
          {
            name: 'baz',
            description: 'description baz is required boolean',
            required: true,
            type: {
              name: 'boolean',
            },
          },
          {
            name: 'stringArray',
            description: 'description stringArray is string array',
            required: false,
            type: {
              name: 'Array',
              elements: [
                {
                  name: 'string',
                },
              ],
            },
            defaultValue: {
              func: false,
              value: "() => ['foo', 'bar']",
            },
          },
          {
            name: 'union',
            description: 'description union is required union type',
            required: true,
            type: {
              name: 'union',
              elements: [
                {
                  name: 'string',
                },
                {
                  name: 'number',
                },
              ],
            },
          },
          {
            name: 'unionOptional',
            description: 'description unionOptional is optional union type',
            required: false,
            type: {
              name: 'union',
              elements: [
                {
                  name: 'string',
                },
                {
                  name: 'number',
                },
                {
                  name: 'boolean',
                },
              ],
            },
          },
          {
            name: 'nested',
            description: 'description nested is required nested object',
            required: true,
            type: {
              name: 'MyNestedProps',
            },
          },
          {
            name: 'nestedIntersection',
            description: 'description required nested object with intersection',
            required: true,
            type: {
              name: 'intersection',
              elements: [
                {
                  name: 'MyNestedProps',
                },
                {
                  name: '{\n  /**\n   * description required additional property\n   */\n  additionalProp: string;\n}',
                },
              ],
            },
          },
          {
            name: 'nestedOptional',
            description: 'description optional nested object',
            required: false,
            type: {
              name: 'union',
              elements: [
                {
                  name: 'MyNestedProps',
                },
                {
                  name: 'MyIgnoredNestedProps',
                },
              ],
            },
          },
          {
            name: 'array',
            description: 'description required array object',
            required: true,
            type: {
              name: 'Array',
              elements: [
                {
                  name: 'MyNestedProps',
                },
              ],
            },
          },
          {
            name: 'arrayOptional',
            description: 'description optional array object',
            required: false,
            type: {
              name: 'Array',
              elements: [
                {
                  name: 'MyNestedProps',
                },
              ],
            },
          },
          {
            name: 'enumValue',
            description: 'description enum value',
            required: true,
            type: {
              name: 'MyEnum',
            },
          },
          {
            name: 'literalFromContext',
            description: 'description literal type alias that require context',
            required: true,
            type: {
              name: 'MyCategories',
            },
          },
          {
            name: 'inlined',
            required: true,
            type: {
              name: '{ foo: string }',
            },
          },
          {
            name: 'recursive',
            required: false,
            type: {
              name: 'MyNestedRecursiveProps',
            },
          },
        ],
      },
    },
    extractedProps: [
      {
        propDef: {
          name: 'foo',
          type: {
            summary: 'string',
          },
          required: true,
          description: 'string foo',
          defaultValue: null,
          sbType: {
            name: 'string',
          },
        },
        docgenInfo: {
          name: 'foo',
          description: 'string foo',
          tags: {
            default: [
              {
                description: '"rounded"',
                title: 'default',
              },
            ],
            since: [
              {
                description: 'v1.0.0',
                title: 'since',
              },
            ],
            see: [
              {
                description: 'https://vuejs.org/',
                title: 'see',
              },
            ],
            deprecated: [
              {
                description: 'v1.1.0',
                title: 'deprecated',
              },
            ],
          },
          required: true,
          type: {
            name: 'string',
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'bar',
          type: {
            summary: 'number',
          },
          required: false,
          description: 'description bar is optional number',
          defaultValue: {
            summary: '1',
          },
          sbType: {
            name: 'number',
          },
        },
        docgenInfo: {
          name: 'bar',
          description: 'description bar is optional number',
          required: false,
          type: {
            name: 'number',
          },
          defaultValue: {
            func: false,
            value: '1',
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'baz',
          type: {
            summary: 'boolean',
          },
          required: true,
          description: 'description baz is required boolean',
          defaultValue: null,
          sbType: {
            name: 'boolean',
          },
        },
        docgenInfo: {
          name: 'baz',
          description: 'description baz is required boolean',
          required: true,
          type: {
            name: 'boolean',
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'stringArray',
          type: {
            summary: 'Array',
          },
          required: false,
          description: 'description stringArray is string array',
          defaultValue: {
            summary: "() => ['foo', 'bar']",
          },
          sbType: {
            name: 'other',
            value: 'Array([object Object])',
          },
        },
        docgenInfo: {
          name: 'stringArray',
          description: 'description stringArray is string array',
          required: false,
          type: {
            name: 'Array',
            elements: [
              {
                name: 'string',
              },
            ],
            value: [
              {
                name: 'string',
              },
            ],
          },
          defaultValue: {
            func: false,
            value: "() => ['foo', 'bar']",
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'union',
          type: {
            summary: 'union',
          },
          required: true,
          description: 'description union is required union type',
          defaultValue: null,
          sbType: {
            name: 'union',
            value: [
              {
                name: 'string',
              },
              {
                name: 'number',
              },
            ],
          },
        },
        docgenInfo: {
          name: 'union',
          description: 'description union is required union type',
          required: true,
          type: {
            name: 'union',
            elements: [
              {
                name: 'string',
              },
              {
                name: 'number',
              },
            ],
            value: [
              {
                name: 'string',
              },
              {
                name: 'number',
              },
            ],
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'unionOptional',
          type: {
            summary: 'union',
          },
          required: false,
          description: 'description unionOptional is optional union type',
          defaultValue: null,
          sbType: {
            name: 'union',
            value: [
              {
                name: 'string',
              },
              {
                name: 'number',
              },
              {
                name: 'boolean',
              },
            ],
          },
        },
        docgenInfo: {
          name: 'unionOptional',
          description: 'description unionOptional is optional union type',
          required: false,
          type: {
            name: 'union',
            elements: [
              {
                name: 'string',
              },
              {
                name: 'number',
              },
              {
                name: 'boolean',
              },
            ],
            value: [
              {
                name: 'string',
              },
              {
                name: 'number',
              },
              {
                name: 'boolean',
              },
            ],
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'nested',
          type: {
            summary: 'MyNestedProps',
          },
          required: true,
          description: 'description nested is required nested object',
          defaultValue: null,
          sbType: {
            name: 'other',
            value: 'MyNestedProps',
          },
        },
        docgenInfo: {
          name: 'nested',
          description: 'description nested is required nested object',
          required: true,
          type: {
            name: 'MyNestedProps',
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'nestedIntersection',
          type: {
            summary: 'intersection',
          },
          required: true,
          description: 'description required nested object with intersection',
          defaultValue: null,
          sbType: {
            name: 'other',
            value: 'intersection([object Object],[object Object])',
          },
        },
        docgenInfo: {
          name: 'nestedIntersection',
          description: 'description required nested object with intersection',
          required: true,
          type: {
            name: 'intersection',
            elements: [
              {
                name: 'MyNestedProps',
              },
              {
                name: '{\n  /**\n   * description required additional property\n   */\n  additionalProp: string;\n}',
              },
            ],
            value: [
              {
                name: 'MyNestedProps',
              },
              {
                name: '{\n  /**\n   * description required additional property\n   */\n  additionalProp: string;\n}',
              },
            ],
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'nestedOptional',
          type: {
            summary: 'union',
          },
          required: false,
          description: 'description optional nested object',
          defaultValue: null,
          sbType: {
            name: 'union',
            value: [
              {
                name: 'other',
                value: 'MyNestedProps',
              },
              {
                name: 'other',
                value: 'MyIgnoredNestedProps',
              },
            ],
          },
        },
        docgenInfo: {
          name: 'nestedOptional',
          description: 'description optional nested object',
          required: false,
          type: {
            name: 'union',
            elements: [
              {
                name: 'MyNestedProps',
              },
              {
                name: 'MyIgnoredNestedProps',
              },
            ],
            value: [
              {
                name: 'MyNestedProps',
              },
              {
                name: 'MyIgnoredNestedProps',
              },
            ],
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'array',
          type: {
            summary: 'Array',
          },
          required: true,
          description: 'description required array object',
          defaultValue: null,
          sbType: {
            name: 'other',
            value: 'Array([object Object])',
          },
        },
        docgenInfo: {
          name: 'array',
          description: 'description required array object',
          required: true,
          type: {
            name: 'Array',
            elements: [
              {
                name: 'MyNestedProps',
              },
            ],
            value: [
              {
                name: 'MyNestedProps',
              },
            ],
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'arrayOptional',
          type: {
            summary: 'Array',
          },
          required: false,
          description: 'description optional array object',
          defaultValue: null,
          sbType: {
            name: 'other',
            value: 'Array([object Object])',
          },
        },
        docgenInfo: {
          name: 'arrayOptional',
          description: 'description optional array object',
          required: false,
          type: {
            name: 'Array',
            elements: [
              {
                name: 'MyNestedProps',
              },
            ],
            value: [
              {
                name: 'MyNestedProps',
              },
            ],
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'enumValue',
          type: {
            summary: 'MyEnum',
          },
          required: true,
          description: 'description enum value',
          defaultValue: null,
          sbType: {
            name: 'other',
            value: 'MyEnum',
          },
        },
        docgenInfo: {
          name: 'enumValue',
          description: 'description enum value',
          required: true,
          type: {
            name: 'MyEnum',
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'literalFromContext',
          type: {
            summary: 'MyCategories',
          },
          required: true,
          description: 'description literal type alias that require context',
          defaultValue: null,
          sbType: {
            name: 'other',
            value: 'MyCategories',
          },
        },
        docgenInfo: {
          name: 'literalFromContext',
          description: 'description literal type alias that require context',
          required: true,
          type: {
            name: 'MyCategories',
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'inlined',
          type: {
            summary: '{ foo: string }',
          },
          required: true,
          defaultValue: null,
          sbType: {
            name: 'other',
            value: '{ foo: string }',
          },
        },
        docgenInfo: {
          name: 'inlined',
          required: true,
          type: {
            name: '{ foo: string }',
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'recursive',
          type: {
            summary: 'MyNestedRecursiveProps',
          },
          required: false,
          defaultValue: null,
          sbType: {
            name: 'other',
            value: 'MyNestedRecursiveProps',
          },
        },
        docgenInfo: {
          name: 'recursive',
          required: false,
          type: {
            name: 'MyNestedRecursiveProps',
          },
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
    ],
  },
  events: {
    component: {
      __docgenInfo: {
        exportName: 'default',
        displayName: 'component',
        description: '',
        tags: {},
        events: [
          {
            name: 'bar',
            type: {
              names: ['{ year: number; title?: any }'],
            },
            description: 'Test description bar',
          },
          {
            name: 'baz',
            description: 'Test description baz',
          },
        ],
      },
    },
    extractedProps: [
      {
        propDef: {
          name: 'bar',
          type: {},
          description: 'Test description bar',
          defaultValue: null,
          sbType: {
            name: 'other',
          },
        },
        docgenInfo: {
          name: 'bar',
          type: {
            names: ['{ year: number; title?: any }'],
          },
          description: 'Test description bar',
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
      {
        propDef: {
          name: 'baz',
          type: null,
          description: 'Test description baz',
          defaultValue: null,
          sbType: null,
        },
        docgenInfo: {
          name: 'baz',
          description: 'Test description baz',
        },
        typeSystem: TypeSystem.JAVASCRIPT,
      },
    ],
  },
  slots: {
    component: {
      __docgenInfo: {
        displayName: 'component',
        exportName: 'default',
        description: '',
        tags: {},
        slots: [
          {
            name: 'no-bind',
          },
          {
            name: 'default',
            scoped: true,
            bindings: [
              {
                name: 'num',
                title: 'binding',
              },
            ],
          },
          {
            name: 'named',
            scoped: true,
            bindings: [
              {
                name: 'str',
                title: 'binding',
              },
            ],
          },
          {
            name: 'vbind',
            scoped: true,
            bindings: [
              {
                name: 'num',
                title: 'binding',
              },
              {
                name: 'str',
                title: 'binding',
              },
            ],
          },
        ],
      },
    },
    extractedProps: [
      {
        propDef: {
          name: 'no-bind',
          type: {
            summary: 'unknown',
          },
          defaultValue: null,
        },
        docgenInfo: {
          name: 'no-bind',
        },
        typeSystem: TypeSystem.UNKNOWN,
      },
      {
        propDef: {
          name: 'default',
          type: {
            summary: 'unknown',
          },
          defaultValue: null,
        },
        docgenInfo: {
          name: 'default',
          scoped: true,
          bindings: [
            {
              name: 'num',
              title: 'binding',
            },
          ],
        },
        typeSystem: TypeSystem.UNKNOWN,
      },
      {
        propDef: {
          name: 'named',
          type: {
            summary: 'unknown',
          },
          defaultValue: null,
        },
        docgenInfo: {
          name: 'named',
          scoped: true,
          bindings: [
            {
              name: 'str',
              title: 'binding',
            },
          ],
        },
        typeSystem: TypeSystem.UNKNOWN,
      },
      {
        propDef: {
          name: 'vbind',
          type: {
            summary: 'unknown',
          },
          defaultValue: null,
        },
        docgenInfo: {
          name: 'vbind',
          scoped: true,
          bindings: [
            {
              name: 'num',
              title: 'binding',
            },
            {
              name: 'str',
              title: 'binding',
            },
          ],
        },
        typeSystem: TypeSystem.UNKNOWN,
      },
    ],
  },
  expose: {
    component: {
      __docgenInfo: {
        exportName: 'default',
        displayName: 'component',
        description: '',
        tags: {},
        expose: [
          {
            name: 'label',
            description: 'a label string',
          },
          {
            name: 'count',
            description: 'a count number',
          },
        ],
      },
    },
    extractedProps: [
      {
        propDef: {
          name: 'label',
          type: {
            summary: 'unknown',
          },
          description: 'a label string',
          defaultValue: null,
        },
        docgenInfo: {
          name: 'label',
          description: 'a label string',
        },
        typeSystem: TypeSystem.UNKNOWN,
      },
      {
        propDef: {
          name: 'count',
          type: {
            summary: 'unknown',
          },
          description: 'a count number',
          defaultValue: null,
        },
        docgenInfo: {
          name: 'count',
          description: 'a count number',
        },
        typeSystem: TypeSystem.UNKNOWN,
      },
    ],
  },
};
