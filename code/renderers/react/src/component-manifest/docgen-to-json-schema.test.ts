import { describe, expect, it } from 'vitest';

import { convertReactDocgenToJSONSchemas } from './docgen-to-json-schema';
import type { DocObj } from './react-docgen';

describe('docgen-to-json-schema', () => {
  it('creates top-level schema with title and required', () => {
    const input: DocObj = {
      description:
        'SmartControl — a polymorphic, accessible, and highly typed component\ndesigned to exercise docgen → JSON Schema conversion.\n\n@remarks\n- Polymorphic `as` prop (default: "button")\n- Discriminated unions: `asKind`, `loading`\n- Generics: `Item<TMeta>`\n- JSDoc schema hints: `@format`, `@minLength`, `@deprecated`, `@default`, `@enum`\n- Index signatures and mapped types\n- Defaults supplied via parameter defaults\n\n@example\n<SmartControl label="Save" onClick={() => {}}>Save</SmartControl>\n\n@example\n<SmartControl as="a" asKind={{ kind: "link", href: "/docs" }} label="Docs">Open</SmartControl>',
      displayName: 'SmartControl',
      actualName: 'SmartControl',
      definedInFile: '/src/Button.tsx',
      methods: [],
      props: {
        as: {
          required: false,
          tsType: {
            name: 'E',
          },
          description: 'The element/component to render as',
        },
        children: {
          required: false,
          tsType: {
            name: 'ReactNode',
          },
          description: 'Visible content inside the control',
        },
        'aria-label': {
          required: false,
          tsType: {
            name: 'string',
          },
          description:
            'Primary label used for accessibility. If omitted, children text should be meaningful.',
        },
        size: {
          required: false,
          tsType: {
            name: 'union',
            raw: '"sm" | "md" | "lg"',
            elements: [
              {
                name: 'literal',
                value: '"sm"',
              },
              {
                name: 'literal',
                value: '"md"',
              },
              {
                name: 'literal',
                value: '"lg"',
              },
            ],
          },
          description: 'Visual size',
          defaultValue: {
            value: '"md"',
            computed: false,
          },
        },
        tone: {
          required: false,
          tsType: {
            name: 'Tone',
          },
          description: 'Semantic tone (maps to style/aria)',
          defaultValue: {
            value: 'Tone.Neutral',
            computed: true,
          },
        },
        style: {
          required: false,
          tsType: {
            name: 'CSSProperties',
          },
          description: 'Inline CSS style passthrough',
        },
        disabled: {
          required: false,
          tsType: {
            name: 'boolean',
          },
          description: 'Whether the control is disabled (affects both UI and events)',
          defaultValue: {
            value: 'false',
            computed: false,
          },
        },
        block: {
          required: false,
          tsType: {
            name: 'boolean',
          },
          description: 'If true, renders a full-width block element',
          defaultValue: {
            value: 'false',
            computed: false,
          },
        },
        tooltip: {
          required: false,
          tsType: {
            name: 'string',
          },
          description: 'Optional tooltip text',
        },
        loading: {
          required: false,
          tsType: {
            name: 'union',
            raw: '| { loading: true; /** Visually hidden label for screen readers */ spinnerLabel: string }\n| { loading: false }',
            elements: [
              {
                name: 'signature',
                type: 'object',
                raw: '{ loading: true; /** Visually hidden label for screen readers */ spinnerLabel: string }',
                signature: {
                  properties: [
                    {
                      key: 'loading',
                      value: {
                        name: 'literal',
                        value: 'true',
                        required: true,
                      },
                    },
                    {
                      key: 'spinnerLabel',
                      value: {
                        name: 'string',
                        required: true,
                      },
                      description: 'Visually hidden label for screen readers',
                    },
                  ],
                },
              },
              {
                name: 'signature',
                type: 'object',
                raw: '{ loading: false }',
                signature: {
                  properties: [
                    {
                      key: 'loading',
                      value: {
                        name: 'literal',
                        value: 'false',
                        required: true,
                      },
                    },
                  ],
                },
              },
            ],
          },
          description: 'Current loading state (discriminated union)',
          defaultValue: {
            value: '{ loading: false }',
            computed: false,
          },
        },
        asKind: {
          required: false,
          tsType: {
            name: 'union',
            raw: '| { kind: "button"; type?: "button" | "submit" | "reset" }\n| { kind: "link"; href: string; target?: "_blank" | "_self" | "_parent" | "_top" }',
            elements: [
              {
                name: 'signature',
                type: 'object',
                raw: '{ kind: "button"; type?: "button" | "submit" | "reset" }',
                signature: {
                  properties: [
                    {
                      key: 'kind',
                      value: {
                        name: 'literal',
                        value: '"button"',
                        required: true,
                      },
                    },
                    {
                      key: 'type',
                      value: {
                        name: 'union',
                        raw: '"button" | "submit" | "reset"',
                        elements: [
                          {
                            name: 'literal',
                            value: '"button"',
                          },
                          {
                            name: 'literal',
                            value: '"submit"',
                          },
                          {
                            name: 'literal',
                            value: '"reset"',
                          },
                        ],
                        required: false,
                      },
                    },
                  ],
                },
              },
              {
                name: 'signature',
                type: 'object',
                raw: '{ kind: "link"; href: string; target?: "_blank" | "_self" | "_parent" | "_top" }',
                signature: {
                  properties: [
                    {
                      key: 'kind',
                      value: {
                        name: 'literal',
                        value: '"link"',
                        required: true,
                      },
                    },
                    {
                      key: 'href',
                      value: {
                        name: 'string',
                        required: true,
                      },
                    },
                    {
                      key: 'target',
                      value: {
                        name: 'union',
                        raw: '"_blank" | "_self" | "_parent" | "_top"',
                        elements: [
                          {
                            name: 'literal',
                            value: '"_blank"',
                          },
                          {
                            name: 'literal',
                            value: '"_self"',
                          },
                          {
                            name: 'literal',
                            value: '"_parent"',
                          },
                          {
                            name: 'literal',
                            value: '"_top"',
                          },
                        ],
                        required: false,
                      },
                    },
                  ],
                },
              },
            ],
          },
          description: 'Choice of behavior: native button vs. link (discriminated union)',
          defaultValue: {
            value: '{ kind: "button", type: "button" }',
            computed: false,
          },
        },
        icon: {
          required: false,
          tsType: {
            name: 'union',
            raw: 'string | null',
            elements: [
              {
                name: 'string',
              },
              {
                name: 'null',
              },
            ],
          },
          description: 'Optional icon name; empty string disables reserved space',
          defaultValue: {
            value: 'null',
            computed: false,
          },
        },
        priority: {
          required: false,
          tsType: {
            name: 'union',
            raw: '0 | 1 | 2 | 3',
            elements: [
              {
                name: 'literal',
                value: '0',
              },
              {
                name: 'literal',
                value: '1',
              },
              {
                name: 'literal',
                value: '2',
              },
              {
                name: 'literal',
                value: '3',
              },
            ],
          },
          description: 'Numeric priority; higher = more prominent',
          defaultValue: {
            value: '0',
            computed: false,
          },
        },
        tags: {
          required: false,
          tsType: {
            name: 'Array',
            elements: [
              {
                name: 'string',
              },
            ],
            raw: 'string[]',
          },
          description: 'Array example',
          defaultValue: {
            value: '[]',
            computed: false,
          },
        },
        anchor: {
          required: false,
          tsType: {
            name: 'tuple',
            raw: '[x: number, y: number]',
            elements: [
              {
                name: 'unknown',
              },
              {
                name: 'unknown',
              },
            ],
          },
          description: 'Tuple example',
        },
        items: {
          required: false,
          tsType: {
            name: 'Array',
            elements: [
              {
                name: 'Item',
                elements: [
                  {
                    name: 'TMeta',
                  },
                ],
                raw: 'Item<TMeta>',
              },
            ],
            raw: 'Item<TMeta>[]',
          },
          description: 'Items list with generic meta',
          defaultValue: {
            value: '[]',
            computed: false,
          },
        },
        selectedId: {
          required: false,
          tsType: {
            name: 'string',
          },
          description: 'Selected item id (must exist in items, if provided)',
        },
        config: {
          required: false,
          tsType: {
            name: 'Record',
            elements: [
              {
                name: 'string',
              },
              {
                name: 'union',
                raw: 'string | number | boolean',
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
            ],
            raw: 'Record<string, string | number | boolean>',
          },
          description: 'Key/value config blob',
        },
        validation: {
          required: false,
          tsType: {
            name: 'ValidationSchema',
          },
          description: 'Validation schema object with index signature',
        },
        features: {
          required: false,
          tsType: {
            name: 'Record',
            elements: [
              {
                name: 'string',
              },
              {
                name: 'boolean',
              },
            ],
            raw: 'Record<string, boolean>',
          },
          description: 'Feature flag bag (mapped type)',
        },
        onClick: {
          required: false,
          tsType: {
            name: 'signature',
            type: 'function',
            raw: '(ev: MouseEvent) => void',
            signature: {
              arguments: [
                {
                  type: {
                    name: 'MouseEvent',
                  },
                  name: 'ev',
                },
              ],
              return: {
                name: 'void',
              },
            },
          },
          description: 'Click handler example',
        },
        onChangeSelected: {
          required: false,
          tsType: {
            name: 'signature',
            type: 'function',
            raw: '(nextId: string | null) => void',
            signature: {
              arguments: [
                {
                  type: {
                    name: 'union',
                    raw: 'string | null',
                    elements: [
                      {
                        name: 'string',
                      },
                      {
                        name: 'null',
                      },
                    ],
                  },
                  name: 'nextId',
                },
              ],
              return: {
                name: 'void',
              },
            },
          },
          description: 'Called when selection changes',
        },
        auditEmail: {
          required: false,
          tsType: {
            name: 'string',
          },
          description: 'Email used for audit or attribution.\n@format email\n@minLength 5',
        },
        variant: {
          required: false,
          tsType: {
            name: 'union',
            raw: '"primary" | "secondary"',
            elements: [
              {
                name: 'literal',
                value: '"primary"',
              },
              {
                name: 'literal',
                value: '"secondary"',
              },
            ],
          },
          description:
            'Deprecated prop kept for backward compatibility.\n@deprecated Use `tone="neutral"` + `priority` instead.',
        },
        __internalId: {
          required: false,
          tsType: {
            name: 'string',
          },
          description: 'Hidden/internal prop you might want your converter to skip.\n@internal',
        },
        label: {
          required: false,
          tsType: {
            name: 'string',
          },
          description:
            'Required example with literal default in implementation.\n@default "Smart control"',
          defaultValue: {
            value: '"Smart control"',
            computed: false,
          },
        },
        appearance: {
          required: false,
          tsType: {
            name: 'string',
          },
          description:
            'Runtime constraint example (string with limited set at runtime)\nUseful to see how you map runtime doc to schema.\n@enum {"solid" | "outline" | "ghost"}',
          defaultValue: {
            value: '"solid"',
            computed: false,
          },
        },
      },
    };

    const schema = convertReactDocgenToJSONSchemas(input);

    expect(schema).toMatchInlineSnapshot(`
      {
        "properties": {
          "anchor": {
            "description": "Tuple example",
            "maxItems": 2,
            "minItems": 2,
            "prefixItems": [
              {},
              {},
            ],
            "type": "array",
          },
          "appearance": {
            "default": "solid",
            "description": "Runtime constraint example (string with limited set at runtime)
      Useful to see how you map runtime doc to schema.",
            "enum": [
              "solid",
              "outline",
              "ghost",
            ],
            "type": "string",
          },
          "aria-label": {
            "description": "Primary label used for accessibility. If omitted, children text should be meaningful.",
            "type": "string",
          },
          "as": {
            "description": "The element/component to render as",
          },
          "asKind": {
            "default": "{ kind: "button", type: "button" }",
            "description": "Choice of behavior: native button vs. link (discriminated union)",
            "discriminator": {
              "propertyName": "kind",
            },
            "oneOf": [
              {
                "additionalProperties": true,
                "properties": {
                  "kind": {
                    "const": "button",
                    "enum": [
                      "button",
                    ],
                    "type": "string",
                  },
                  "type": {
                    "enum": [
                      "button",
                      "submit",
                      "reset",
                    ],
                    "type": "string",
                  },
                },
                "required": [
                  "kind",
                ],
                "type": "object",
              },
              {
                "additionalProperties": true,
                "properties": {
                  "href": {
                    "type": "string",
                  },
                  "kind": {
                    "const": "link",
                    "enum": [
                      "link",
                    ],
                    "type": "string",
                  },
                  "target": {
                    "enum": [
                      "_blank",
                      "_self",
                      "_parent",
                      "_top",
                    ],
                    "type": "string",
                  },
                },
                "required": [
                  "kind",
                  "href",
                ],
                "type": "object",
              },
            ],
          },
          "auditEmail": {
            "description": "Email used for audit or attribution.",
            "format": "email",
            "minLength": 5,
            "type": "string",
          },
          "block": {
            "default": false,
            "description": "If true, renders a full-width block element",
            "type": "boolean",
          },
          "children": {
            "description": "Visible content inside the control",
          },
          "config": {
            "additionalProperties": {
              "type": [
                "string",
                "number",
                "boolean",
              ],
            },
            "description": "Key/value config blob",
            "type": "object",
          },
          "disabled": {
            "default": false,
            "description": "Whether the control is disabled (affects both UI and events)",
            "type": "boolean",
          },
          "features": {
            "additionalProperties": {
              "type": "boolean",
            },
            "description": "Feature flag bag (mapped type)",
            "type": "object",
          },
          "icon": {
            "default": null,
            "description": "Optional icon name; empty string disables reserved space",
            "type": [
              "string",
              "null",
            ],
          },
          "items": {
            "default": [],
            "description": "Items list with generic meta",
            "items": {
              "type": "object",
            },
            "type": "array",
          },
          "label": {
            "default": "Smart control",
            "description": "Required example with literal default in implementation.",
            "type": "string",
          },
          "loading": {
            "default": "{ loading: false }",
            "description": "Current loading state (discriminated union)",
            "discriminator": {
              "propertyName": "loading",
            },
            "oneOf": [
              {
                "additionalProperties": true,
                "properties": {
                  "loading": {
                    "const": true,
                    "enum": [
                      true,
                    ],
                    "type": "boolean",
                  },
                  "spinnerLabel": {
                    "type": "string",
                  },
                },
                "required": [
                  "loading",
                  "spinnerLabel",
                ],
                "type": "object",
              },
              {
                "additionalProperties": true,
                "properties": {
                  "loading": {
                    "const": false,
                    "enum": [
                      false,
                    ],
                    "type": "boolean",
                  },
                },
                "required": [
                  "loading",
                ],
                "type": "object",
              },
            ],
          },
          "onChangeSelected": {
            "description": "Called when selection changes",
            "type": "string",
          },
          "onClick": {
            "description": "Click handler example",
            "type": "string",
          },
          "priority": {
            "default": 0,
            "description": "Numeric priority; higher = more prominent",
            "enum": [
              0,
              1,
              2,
              3,
            ],
            "type": "integer",
          },
          "selectedId": {
            "description": "Selected item id (must exist in items, if provided)",
            "type": "string",
          },
          "size": {
            "default": "md",
            "description": "Visual size",
            "enum": [
              "sm",
              "md",
              "lg",
            ],
            "type": "string",
          },
          "style": {
            "additionalProperties": {
              "anyOf": [
                {
                  "type": "string",
                },
                {
                  "type": "number",
                },
              ],
            },
            "description": "Inline CSS style passthrough",
            "type": "object",
          },
          "tags": {
            "default": [],
            "description": "Array example",
            "items": {
              "type": "string",
            },
            "type": "array",
          },
          "tone": {
            "default": "Tone.Neutral",
            "description": "Semantic tone (maps to style/aria)",
            "type": "string",
          },
          "tooltip": {
            "description": "Optional tooltip text",
            "type": "string",
          },
          "validation": {
            "additionalProperties": true,
            "description": "Validation schema object with index signature",
            "properties": {
              "minLength": {
                "type": "number",
              },
              "pattern": {
                "type": "string",
              },
            },
            "type": "object",
          },
          "variant": {
            "deprecated": true,
            "description": "Deprecated prop kept for backward compatibility.",
            "enum": [
              "primary",
              "secondary",
            ],
            "type": "string",
            "x-deprecationMessage": "Use \`tone="neutral"\` + \`priority\` instead.",
          },
        },
        "type": "object",
      }
    `);
  });
});
