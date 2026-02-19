import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { parseWithReactDocgenTypescript } from './reactDocgenTypescript';

const fixture = (name: string) => join(__dirname, '__testfixtures__', name);

// Strip absolute paths so snapshots are portable across machines and CI environments
function normalize(results: any[]) {
  return JSON.parse(
    JSON.stringify(results, (key, value) => {
      if ((key === 'filePath' || key === 'fileName') && typeof value === 'string') {
        return value
          .replace(/.*__testfixtures__[\\/]/, '')
          .replace(/.*node_modules[\\/]/, 'node_modules/');
      }
      return value;
    })
  );
}

describe('parseFile', () => {
  test('Button', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('Button.ts')))).toMatchInlineSnapshot(`
      [
        {
          "description": "",
          "displayName": "Button",
          "exportName": "Button",
          "filePath": "Button.ts",
          "methods": [],
          "props": {
            "disabled": {
              "declarations": [
                {
                  "fileName": "Button.ts",
                  "name": "ButtonProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "disabled",
              "parent": {
                "fileName": "Button.ts",
                "name": "ButtonProps",
              },
              "required": false,
              "type": {
                "name": "boolean",
              },
            },
            "label": {
              "declarations": [
                {
                  "fileName": "Button.ts",
                  "name": "ButtonProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "label",
              "parent": {
                "fileName": "Button.ts",
                "name": "ButtonProps",
              },
              "required": true,
              "type": {
                "name": "string",
              },
            },
          },
          "tags": {},
        },
      ]
    `);
  });

  test('Arrow', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('Arrow.ts')))).toMatchInlineSnapshot(`
      [
        {
          "description": "",
          "displayName": "Card",
          "exportName": "Card",
          "filePath": "Arrow.ts",
          "methods": [],
          "props": {
            "title": {
              "declarations": [
                {
                  "fileName": "Arrow.ts",
                  "name": "CardProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "title",
              "parent": {
                "fileName": "Arrow.ts",
                "name": "CardProps",
              },
              "required": true,
              "type": {
                "name": "string",
              },
            },
          },
          "tags": {},
        },
      ]
    `);
  });

  test('DefaultExport', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('DefaultExport.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "Icon",
            "exportName": "default",
            "filePath": "DefaultExport.ts",
            "methods": [],
            "props": {
              "name": {
                "declarations": [
                  {
                    "fileName": "DefaultExport.ts",
                    "name": "IconProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "name",
                "parent": {
                  "fileName": "DefaultExport.ts",
                  "name": "IconProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "size": {
                "declarations": [
                  {
                    "fileName": "DefaultExport.ts",
                    "name": "IconProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "size",
                "parent": {
                  "fileName": "DefaultExport.ts",
                  "name": "IconProps",
                },
                "required": false,
                "type": {
                  "name": "number",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('MultipleExports', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('MultipleExports.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "Input",
            "exportName": "Input",
            "filePath": "MultipleExports.ts",
            "methods": [],
            "props": {
              "placeholder": {
                "declarations": [
                  {
                    "fileName": "MultipleExports.ts",
                    "name": "InputProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "placeholder",
                "parent": {
                  "fileName": "MultipleExports.ts",
                  "name": "InputProps",
                },
                "required": false,
                "type": {
                  "name": "string",
                },
              },
            },
            "tags": {},
          },
          {
            "description": "",
            "displayName": "MultipleExports",
            "exportName": "default",
            "filePath": "MultipleExports.ts",
            "methods": [],
            "props": {
              "text": {
                "declarations": [
                  {
                    "fileName": "MultipleExports.ts",
                    "name": "LabelProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "text",
                "parent": {
                  "fileName": "MultipleExports.ts",
                  "name": "LabelProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('UnionProps', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('UnionProps.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "Tag",
            "exportName": "Tag",
            "filePath": "UnionProps.ts",
            "methods": [],
            "props": {
              "size": {
                "declarations": [
                  {
                    "fileName": "UnionProps.ts",
                    "name": "TagProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "size",
                "parent": {
                  "fileName": "UnionProps.ts",
                  "name": "TagProps",
                },
                "required": false,
                "type": {
                  "name": "enum",
                  "raw": ""small" | "large"",
                  "value": [
                    {
                      "value": ""small"",
                    },
                    {
                      "value": ""large"",
                    },
                  ],
                },
              },
              "variant": {
                "declarations": [
                  {
                    "fileName": "UnionProps.ts",
                    "name": "TagProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "variant",
                "parent": {
                  "fileName": "UnionProps.ts",
                  "name": "TagProps",
                },
                "required": true,
                "type": {
                  "name": "enum",
                  "raw": ""primary" | "secondary" | "danger"",
                  "value": [
                    {
                      "value": ""primary"",
                    },
                    {
                      "value": ""secondary"",
                    },
                    {
                      "value": ""danger"",
                    },
                  ],
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('FunctionProps', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('FunctionProps.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "Callback",
            "exportName": "Callback",
            "filePath": "FunctionProps.ts",
            "methods": [],
            "props": {
              "onClick": {
                "declarations": [
                  {
                    "fileName": "FunctionProps.ts",
                    "name": "CallbackProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onClick",
                "parent": {
                  "fileName": "FunctionProps.ts",
                  "name": "CallbackProps",
                },
                "required": false,
                "type": {
                  "name": "((id: string) => void)",
                },
              },
              "onSubmit": {
                "declarations": [
                  {
                    "fileName": "FunctionProps.ts",
                    "name": "CallbackProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onSubmit",
                "parent": {
                  "fileName": "FunctionProps.ts",
                  "name": "CallbackProps",
                },
                "required": true,
                "type": {
                  "name": "() => boolean",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('DefaultValues', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('DefaultValues.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "Alert",
            "exportName": "Alert",
            "filePath": "DefaultValues.ts",
            "methods": [],
            "props": {
              "message": {
                "declarations": [
                  {
                    "fileName": "DefaultValues.ts",
                    "name": "AlertProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "message",
                "parent": {
                  "fileName": "DefaultValues.ts",
                  "name": "AlertProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "severity": {
                "declarations": [
                  {
                    "fileName": "DefaultValues.ts",
                    "name": "AlertProps",
                  },
                ],
                "defaultValue": {
                  "value": "info",
                },
                "description": "",
                "name": "severity",
                "parent": {
                  "fileName": "DefaultValues.ts",
                  "name": "AlertProps",
                },
                "required": false,
                "type": {
                  "name": "string",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('Documented', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('Documented.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "A tooltip component.",
            "displayName": "Tooltip",
            "exportName": "Tooltip",
            "filePath": "Documented.ts",
            "methods": [],
            "props": {
              "content": {
                "declarations": [
                  {
                    "fileName": "Documented.ts",
                    "name": "TooltipProps",
                  },
                ],
                "defaultValue": null,
                "description": "The content to display",
                "name": "content",
                "parent": {
                  "fileName": "Documented.ts",
                  "name": "TooltipProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('NoComponents', () => {
    expect(
      normalize(parseWithReactDocgenTypescript(fixture('NoComponents.ts')))
    ).toMatchInlineSnapshot(`[]`);
  });

  test('ImportedProps (extends + imported types from another file)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('ImportedProps.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "Badge",
            "exportName": "Badge",
            "filePath": "ImportedProps.ts",
            "methods": [],
            "props": {
              "className": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "SharedProps",
                  },
                ],
                "defaultValue": null,
                "description": "Optional CSS class name",
                "name": "className",
                "parent": {
                  "fileName": "types.ts",
                  "name": "SharedProps",
                },
                "required": false,
                "type": {
                  "name": "string",
                },
              },
              "count": {
                "declarations": [
                  {
                    "fileName": "ImportedProps.ts",
                    "name": "BadgeProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "count",
                "parent": {
                  "fileName": "ImportedProps.ts",
                  "name": "BadgeProps",
                },
                "required": false,
                "type": {
                  "name": "number",
                },
              },
              "disabled": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "ClickableProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "disabled",
                "parent": {
                  "fileName": "types.ts",
                  "name": "ClickableProps",
                },
                "required": false,
                "type": {
                  "name": "boolean",
                },
              },
              "id": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "SharedProps",
                  },
                ],
                "defaultValue": null,
                "description": "Unique identifier",
                "name": "id",
                "parent": {
                  "fileName": "types.ts",
                  "name": "SharedProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "label": {
                "declarations": [
                  {
                    "fileName": "ImportedProps.ts",
                    "name": "BadgeProps",
                  },
                ],
                "defaultValue": null,
                "description": "The badge label",
                "name": "label",
                "parent": {
                  "fileName": "ImportedProps.ts",
                  "name": "BadgeProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "onClick": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "ClickableProps",
                  },
                ],
                "defaultValue": null,
                "description": "Click handler",
                "name": "onClick",
                "parent": {
                  "fileName": "types.ts",
                  "name": "ClickableProps",
                },
                "required": false,
                "type": {
                  "name": "((event: { target: string; }) => void)",
                },
              },
              "variant": {
                "declarations": [
                  {
                    "fileName": "ImportedProps.ts",
                    "name": "BadgeProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "variant",
                "parent": {
                  "fileName": "ImportedProps.ts",
                  "name": "BadgeProps",
                },
                "required": true,
                "type": {
                  "name": "enum",
                  "raw": "Variant",
                  "value": [
                    {
                      "value": ""primary"",
                    },
                    {
                      "value": ""secondary"",
                    },
                    {
                      "value": ""danger"",
                    },
                  ],
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('PickOmit (Pick/Omit utility types on imported interfaces)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('PickOmit.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "Card",
            "exportName": "Card",
            "filePath": "PickOmit.ts",
            "methods": [],
            "props": {
              "id": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "SharedProps",
                  },
                ],
                "defaultValue": null,
                "description": "Unique identifier",
                "name": "id",
                "parent": {
                  "fileName": "types.ts",
                  "name": "SharedProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "onClick": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "ClickableProps",
                  },
                ],
                "defaultValue": null,
                "description": "Click handler",
                "name": "onClick",
                "parent": {
                  "fileName": "types.ts",
                  "name": "ClickableProps",
                },
                "required": false,
                "type": {
                  "name": "((event: { target: string; }) => void)",
                },
              },
              "subtitle": {
                "declarations": [
                  {
                    "fileName": "PickOmit.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "subtitle",
                "required": false,
                "type": {
                  "name": "string",
                },
              },
              "title": {
                "declarations": [
                  {
                    "fileName": "PickOmit.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "title",
                "required": true,
                "type": {
                  "name": "string",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('Generic (generic type parameters resolved to concrete types)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('Generic.ts')))).toMatchInlineSnapshot(`
      [
        {
          "description": "",
          "displayName": "StringList",
          "exportName": "StringList",
          "filePath": "Generic.ts",
          "methods": [],
          "props": {
            "emptyMessage": {
              "declarations": [
                {
                  "fileName": "Generic.ts",
                  "name": "ListProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "emptyMessage",
              "parent": {
                "fileName": "Generic.ts",
                "name": "ListProps",
              },
              "required": false,
              "type": {
                "name": "string",
              },
            },
            "items": {
              "declarations": [
                {
                  "fileName": "Generic.ts",
                  "name": "ListProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "items",
              "parent": {
                "fileName": "Generic.ts",
                "name": "ListProps",
              },
              "required": true,
              "type": {
                "name": "string[]",
              },
            },
            "renderItem": {
              "declarations": [
                {
                  "fileName": "Generic.ts",
                  "name": "ListProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "renderItem",
              "parent": {
                "fileName": "Generic.ts",
                "name": "ListProps",
              },
              "required": true,
              "type": {
                "name": "(item: string) => string",
              },
            },
          },
          "tags": {},
        },
        {
          "description": "",
          "displayName": "NumberList",
          "exportName": "NumberList",
          "filePath": "Generic.ts",
          "methods": [],
          "props": {
            "emptyMessage": {
              "declarations": [
                {
                  "fileName": "Generic.ts",
                  "name": "ListProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "emptyMessage",
              "parent": {
                "fileName": "Generic.ts",
                "name": "ListProps",
              },
              "required": false,
              "type": {
                "name": "string",
              },
            },
            "items": {
              "declarations": [
                {
                  "fileName": "Generic.ts",
                  "name": "ListProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "items",
              "parent": {
                "fileName": "Generic.ts",
                "name": "ListProps",
              },
              "required": true,
              "type": {
                "name": "number[]",
              },
            },
            "renderItem": {
              "declarations": [
                {
                  "fileName": "Generic.ts",
                  "name": "ListProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "renderItem",
              "parent": {
                "fileName": "Generic.ts",
                "name": "ListProps",
              },
              "required": true,
              "type": {
                "name": "(item: number) => string",
              },
            },
          },
          "tags": {},
        },
      ]
    `);
  });

  test('ReExport (re-exported components from other files)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('ReExport.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "Badge",
            "exportName": "Badge",
            "filePath": "ReExport.ts",
            "methods": [],
            "props": {
              "className": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "SharedProps",
                  },
                ],
                "defaultValue": null,
                "description": "Optional CSS class name",
                "name": "className",
                "parent": {
                  "fileName": "types.ts",
                  "name": "SharedProps",
                },
                "required": false,
                "type": {
                  "name": "string",
                },
              },
              "count": {
                "declarations": [
                  {
                    "fileName": "ImportedProps.ts",
                    "name": "BadgeProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "count",
                "parent": {
                  "fileName": "ImportedProps.ts",
                  "name": "BadgeProps",
                },
                "required": false,
                "type": {
                  "name": "number",
                },
              },
              "disabled": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "ClickableProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "disabled",
                "parent": {
                  "fileName": "types.ts",
                  "name": "ClickableProps",
                },
                "required": false,
                "type": {
                  "name": "boolean",
                },
              },
              "id": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "SharedProps",
                  },
                ],
                "defaultValue": null,
                "description": "Unique identifier",
                "name": "id",
                "parent": {
                  "fileName": "types.ts",
                  "name": "SharedProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "label": {
                "declarations": [
                  {
                    "fileName": "ImportedProps.ts",
                    "name": "BadgeProps",
                  },
                ],
                "defaultValue": null,
                "description": "The badge label",
                "name": "label",
                "parent": {
                  "fileName": "ImportedProps.ts",
                  "name": "BadgeProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "onClick": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "ClickableProps",
                  },
                ],
                "defaultValue": null,
                "description": "Click handler",
                "name": "onClick",
                "parent": {
                  "fileName": "types.ts",
                  "name": "ClickableProps",
                },
                "required": false,
                "type": {
                  "name": "((event: { target: string; }) => void)",
                },
              },
              "variant": {
                "declarations": [
                  {
                    "fileName": "ImportedProps.ts",
                    "name": "BadgeProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "variant",
                "parent": {
                  "fileName": "ImportedProps.ts",
                  "name": "BadgeProps",
                },
                "required": true,
                "type": {
                  "name": "enum",
                  "raw": "Variant",
                  "value": [
                    {
                      "value": ""primary"",
                    },
                    {
                      "value": ""secondary"",
                    },
                    {
                      "value": ""danger"",
                    },
                  ],
                },
              },
            },
            "tags": {},
          },
          {
            "description": "",
            "displayName": "Card",
            "exportName": "RenamedCard",
            "filePath": "ReExport.ts",
            "methods": [],
            "props": {
              "id": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "SharedProps",
                  },
                ],
                "defaultValue": null,
                "description": "Unique identifier",
                "name": "id",
                "parent": {
                  "fileName": "types.ts",
                  "name": "SharedProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "onClick": {
                "declarations": [
                  {
                    "fileName": "types.ts",
                    "name": "ClickableProps",
                  },
                ],
                "defaultValue": null,
                "description": "Click handler",
                "name": "onClick",
                "parent": {
                  "fileName": "types.ts",
                  "name": "ClickableProps",
                },
                "required": false,
                "type": {
                  "name": "((event: { target: string; }) => void)",
                },
              },
              "subtitle": {
                "declarations": [
                  {
                    "fileName": "PickOmit.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "subtitle",
                "required": false,
                "type": {
                  "name": "string",
                },
              },
              "title": {
                "declarations": [
                  {
                    "fileName": "PickOmit.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "title",
                "required": true,
                "type": {
                  "name": "string",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('Intersection (intersection of multiple type aliases)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('Intersection.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "Item",
            "exportName": "Item",
            "filePath": "Intersection.ts",
            "methods": [],
            "props": {
              "archived": {
                "declarations": [
                  {
                    "fileName": "Intersection.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "archived",
                "required": false,
                "type": {
                  "name": "boolean",
                },
              },
              "createdAt": {
                "declarations": [
                  {
                    "fileName": "Intersection.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "createdAt",
                "required": true,
                "type": {
                  "name": "Date",
                },
              },
              "id": {
                "declarations": [
                  {
                    "fileName": "Intersection.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "id",
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "onSave": {
                "declarations": [
                  {
                    "fileName": "Intersection.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onSave",
                "required": true,
                "type": {
                  "name": "() => Promise<void>",
                },
              },
              "tags": {
                "declarations": [
                  {
                    "fileName": "Intersection.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "tags",
                "required": true,
                "type": {
                  "name": "string[]",
                },
              },
              "title": {
                "declarations": [
                  {
                    "fileName": "Intersection.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "title",
                "required": true,
                "type": {
                  "name": "string",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('DtsComponent (extends React.ButtonHTMLAttributes from .d.ts)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('DtsComponent.tsx'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "HtmlButton",
            "exportName": "HtmlButton",
            "filePath": "DtsComponent.tsx",
            "methods": [],
            "props": {
              "inert": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/experimental.d.ts",
                    "name": "HTMLAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "@see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/inert",
                "name": "inert",
                "parent": {
                  "fileName": "node_modules/@types/react/experimental.d.ts",
                  "name": "HTMLAttributes",
                },
                "required": false,
                "type": {
                  "name": "boolean",
                },
              },
              "onBeforeToggle": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "HTMLAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onBeforeToggle",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "HTMLAttributes",
                },
                "required": false,
                "type": {
                  "name": "ToggleEventHandler<HTMLButtonElement>",
                },
              },
              "onToggle": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "HTMLAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onToggle",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "HTMLAttributes",
                },
                "required": false,
                "type": {
                  "name": "ToggleEventHandler<HTMLButtonElement>",
                },
              },
              "onTransitionCancel": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "DOMAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onTransitionCancel",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "DOMAttributes",
                },
                "required": false,
                "type": {
                  "name": "TransitionEventHandler<HTMLButtonElement>",
                },
              },
              "onTransitionCancelCapture": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "DOMAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onTransitionCancelCapture",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "DOMAttributes",
                },
                "required": false,
                "type": {
                  "name": "TransitionEventHandler<HTMLButtonElement>",
                },
              },
              "onTransitionRun": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "DOMAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onTransitionRun",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "DOMAttributes",
                },
                "required": false,
                "type": {
                  "name": "TransitionEventHandler<HTMLButtonElement>",
                },
              },
              "onTransitionRunCapture": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "DOMAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onTransitionRunCapture",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "DOMAttributes",
                },
                "required": false,
                "type": {
                  "name": "TransitionEventHandler<HTMLButtonElement>",
                },
              },
              "onTransitionStart": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "DOMAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onTransitionStart",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "DOMAttributes",
                },
                "required": false,
                "type": {
                  "name": "TransitionEventHandler<HTMLButtonElement>",
                },
              },
              "onTransitionStartCapture": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "DOMAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onTransitionStartCapture",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "DOMAttributes",
                },
                "required": false,
                "type": {
                  "name": "TransitionEventHandler<HTMLButtonElement>",
                },
              },
              "popover": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "HTMLAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "popover",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "HTMLAttributes",
                },
                "required": false,
                "type": {
                  "name": "enum",
                  "raw": """ | "auto" | "manual" | "hint"",
                  "value": [
                    {
                      "value": """",
                    },
                    {
                      "value": ""auto"",
                    },
                    {
                      "value": ""manual"",
                    },
                    {
                      "value": ""hint"",
                    },
                  ],
                },
              },
              "popoverTarget": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "HTMLAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "popoverTarget",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "HTMLAttributes",
                },
                "required": false,
                "type": {
                  "name": "string",
                },
              },
              "popoverTargetAction": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/canary.d.ts",
                    "name": "HTMLAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "popoverTargetAction",
                "parent": {
                  "fileName": "node_modules/@types/react/canary.d.ts",
                  "name": "HTMLAttributes",
                },
                "required": false,
                "type": {
                  "name": "enum",
                  "raw": ""toggle" | "show" | "hide"",
                  "value": [
                    {
                      "value": ""toggle"",
                    },
                    {
                      "value": ""show"",
                    },
                    {
                      "value": ""hide"",
                    },
                  ],
                },
              },
              "tw": {
                "declarations": [
                  {
                    "fileName": "node_modules/next/dist/compiled/@vercel/og/types.d.ts",
                    "name": "HTMLAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "Specify styles using Tailwind CSS classes. This feature is currently experimental.
        If \`style\` prop is also specified, styles generated with \`tw\` prop will be overridden.

        Example:
        - \`tw='w-full h-full bg-blue-200'\`
        - \`tw='text-9xl'\`
        - \`tw='text-[80px]'\`",
                "name": "tw",
                "parent": {
                  "fileName": "node_modules/next/dist/compiled/@vercel/og/types.d.ts",
                  "name": "HTMLAttributes",
                },
                "required": false,
                "type": {
                  "name": "{string}",
                },
              },
              "variant": {
                "declarations": [
                  {
                    "fileName": "DtsComponent.tsx",
                    "name": "HtmlButtonProps",
                  },
                ],
                "defaultValue": null,
                "description": "The button variant",
                "name": "variant",
                "parent": {
                  "fileName": "DtsComponent.tsx",
                  "name": "HtmlButtonProps",
                },
                "required": false,
                "type": {
                  "name": "enum",
                  "raw": ""solid" | "outline"",
                  "value": [
                    {
                      "value": ""solid"",
                    },
                    {
                      "value": ""outline"",
                    },
                  ],
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('StyledComponent', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('StyledComponent.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "StyledButton",
            "exportName": "StyledButton",
            "filePath": "StyledComponent.ts",
            "methods": [],
            "props": {
              "as": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "as",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
              "forwardedAs": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "forwardedAs",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
              "style": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "style",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
              "theme": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "theme",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
            },
            "tags": {},
          },
          {
            "description": "",
            "displayName": "StyledCard",
            "exportName": "StyledCard",
            "filePath": "StyledComponent.ts",
            "methods": [],
            "props": {
              "as": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "as",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
              "forwardedAs": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "forwardedAs",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
              "style": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "style",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
              "theme": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "theme",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
            },
            "tags": {},
          },
          {
            "description": "",
            "displayName": "StyledInput",
            "exportName": "StyledInput",
            "filePath": "StyledComponent.ts",
            "methods": [],
            "props": {
              "as": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "as",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
              "forwardedAs": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "forwardedAs",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
              "style": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "style",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
              "theme": {
                "declarations": [
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                  {
                    "fileName": "node_modules/styled-components/dist/types.d.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "theme",
                "required": false,
                "type": {
                  "name": "any",
                },
              },
            },
            "tags": {},
          },
          {
            "description": "",
            "displayName": "PlainExport",
            "exportName": "PlainExport",
            "filePath": "StyledComponent.ts",
            "methods": [],
            "props": {
              "label": {
                "declarations": [
                  {
                    "fileName": "StyledComponent.ts",
                    "name": "TypeLiteral",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "label",
                "required": true,
                "type": {
                  "name": "string",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('ForwardRef', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('ForwardRef.tsx'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "TextInput",
            "exportName": "TextInput",
            "filePath": "ForwardRef.tsx",
            "methods": [],
            "props": {
              "key": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/index.d.ts",
                    "name": "Attributes",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "key",
                "parent": {
                  "fileName": "node_modules/@types/react/index.d.ts",
                  "name": "Attributes",
                },
                "required": false,
                "type": {
                  "name": "Key | null",
                },
              },
              "label": {
                "declarations": [
                  {
                    "fileName": "ForwardRef.tsx",
                    "name": "TextInputProps",
                  },
                ],
                "defaultValue": null,
                "description": "Input label",
                "name": "label",
                "parent": {
                  "fileName": "ForwardRef.tsx",
                  "name": "TextInputProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "onChange": {
                "declarations": [
                  {
                    "fileName": "ForwardRef.tsx",
                    "name": "TextInputProps",
                  },
                ],
                "defaultValue": null,
                "description": "Change handler",
                "name": "onChange",
                "parent": {
                  "fileName": "ForwardRef.tsx",
                  "name": "TextInputProps",
                },
                "required": false,
                "type": {
                  "name": "((value: string) => void)",
                },
              },
              "placeholder": {
                "declarations": [
                  {
                    "fileName": "ForwardRef.tsx",
                    "name": "TextInputProps",
                  },
                ],
                "defaultValue": null,
                "description": "Placeholder text",
                "name": "placeholder",
                "parent": {
                  "fileName": "ForwardRef.tsx",
                  "name": "TextInputProps",
                },
                "required": false,
                "type": {
                  "name": "string",
                },
              },
              "ref": {
                "declarations": [
                  {
                    "fileName": "node_modules/@types/react/index.d.ts",
                    "name": "RefAttributes",
                  },
                ],
                "defaultValue": null,
                "description": "Allows getting a ref to the component instance.
        Once the component unmounts, React will set \`ref.current\` to \`null\`
        (or call the ref with \`null\` if you passed a callback ref).
        @see {@link https://react.dev/learn/referencing-values-with-refs#refs-and-the-dom React Docs}",
                "name": "ref",
                "parent": {
                  "fileName": "node_modules/@types/react/index.d.ts",
                  "name": "RefAttributes",
                },
                "required": false,
                "type": {
                  "name": "LegacyRef<HTMLInputElement>",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });

  test('RenamedExport (export { Foo as Bar } — displayName differs from exportName)', () => {
    const result = normalize(parseWithReactDocgenTypescript(fixture('RenamedExport.ts')));
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "description": "",
          "displayName": "Alert",
          "exportName": "NotificationBanner",
          "filePath": "RenamedExport.ts",
          "methods": [],
          "props": {
            "message": {
              "declarations": [
                {
                  "fileName": "RenamedExport.ts",
                  "name": "AlertProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "message",
              "parent": {
                "fileName": "RenamedExport.ts",
                "name": "AlertProps",
              },
              "required": true,
              "type": {
                "name": "string",
              },
            },
            "severity": {
              "declarations": [
                {
                  "fileName": "RenamedExport.ts",
                  "name": "AlertProps",
                },
              ],
              "defaultValue": null,
              "description": "",
              "name": "severity",
              "parent": {
                "fileName": "RenamedExport.ts",
                "name": "AlertProps",
              },
              "required": false,
              "type": {
                "name": "enum",
                "raw": ""info" | "warning" | "error"",
                "value": [
                  {
                    "value": ""info"",
                  },
                  {
                    "value": ""warning"",
                  },
                  {
                    "value": ""error"",
                  },
                ],
              },
            },
          },
          "tags": {},
        },
      ]
    `);
    // Key assertion: displayName is the internal name, exportName is what consumers import
    expect(result[0].displayName).toBe('Alert');
    expect(result[0].exportName).toBe('NotificationBanner');
  });

  test('DisplayNameOverride (component.displayName set explicitly)', () => {
    const result = normalize(parseWithReactDocgenTypescript(fixture('DisplayNameOverride.ts')));
    // The export name should be "Modal" (the export alias), not "InternalModal" or "FancyModal"
    expect(result[0].exportName).toBe('Modal');
    expect(result[0].props).toHaveProperty('title');
    expect(result[0].props).toHaveProperty('open');
  });

  test('Barrel (export * from barrel index)', () => {
    expect(normalize(parseWithReactDocgenTypescript(fixture('barrel/index.ts'))))
      .toMatchInlineSnapshot(`
        [
          {
            "description": "",
            "displayName": "Button",
            "exportName": "Button",
            "filePath": "barrel/index.ts",
            "methods": [],
            "props": {
              "label": {
                "declarations": [
                  {
                    "fileName": "barrel/Button.ts",
                    "name": "ButtonProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "label",
                "parent": {
                  "fileName": "barrel/Button.ts",
                  "name": "ButtonProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
              "size": {
                "declarations": [
                  {
                    "fileName": "barrel/Button.ts",
                    "name": "ButtonProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "size",
                "parent": {
                  "fileName": "barrel/Button.ts",
                  "name": "ButtonProps",
                },
                "required": false,
                "type": {
                  "name": "enum",
                  "raw": ""sm" | "md" | "lg"",
                  "value": [
                    {
                      "value": ""sm"",
                    },
                    {
                      "value": ""md"",
                    },
                    {
                      "value": ""lg"",
                    },
                  ],
                },
              },
            },
            "tags": {},
          },
          {
            "description": "",
            "displayName": "Input",
            "exportName": "Input",
            "filePath": "barrel/index.ts",
            "methods": [],
            "props": {
              "onChange": {
                "declarations": [
                  {
                    "fileName": "barrel/Input.ts",
                    "name": "InputProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "onChange",
                "parent": {
                  "fileName": "barrel/Input.ts",
                  "name": "InputProps",
                },
                "required": true,
                "type": {
                  "name": "(value: string) => void",
                },
              },
              "value": {
                "declarations": [
                  {
                    "fileName": "barrel/Input.ts",
                    "name": "InputProps",
                  },
                ],
                "defaultValue": null,
                "description": "",
                "name": "value",
                "parent": {
                  "fileName": "barrel/Input.ts",
                  "name": "InputProps",
                },
                "required": true,
                "type": {
                  "name": "string",
                },
              },
            },
            "tags": {},
          },
        ]
      `);
  });
});
