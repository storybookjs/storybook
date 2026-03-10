import { describe, expect, it } from 'vitest';

import { extractComponentProps } from 'storybook/internal/docs-tools';

import { extractProps } from '../../extractProps';

// TODO: Norbert figure this out thank you
describe('extractArgTypesFromDocgenTypescript', () => {
  it('should extract arg types from a simple component', async () => {
    const tsDocgenData = {
      name: {
        defaultValue: null,
        description: '',
        name: 'name',
        declarations: [],
        required: false,
        type: {
          name: 'string',
        },
      },
      strength: {
        defaultValue: null,
        description: '',
        name: 'strength',
        declarations: [],
        required: false,
        type: {
          name: 'string | number',
        },
      },
      image: {
        defaultValue: null,
        description: '',
        name: 'image',
        declarations: [],
        required: true,
        type: {
          name: 'enum',
          raw: '"image/foo.png" | "image/bar.jpg"',
          value: [
            {
              value: '"image/foo.png"',
            },
            {
              value: '"image/bar.jpg"',
            },
          ],
        },
      },
      background: {
        defaultValue: null,
        description: '',
        name: 'background',
        declarations: [
          {
            fileName: 'dune-assets/src/card/traitor/Traitor.tsx',
            name: 'TypeLiteral',
          },
        ],
        required: true,
        type: {
          name: 'string',
        },
      },
      owner: {
        defaultValue: null,
        description: '',
        name: 'owner',
        declarations: [
          {
            fileName: 'dune-assets/src/card/traitor/Traitor.tsx',
            name: 'TypeLiteral',
          },
        ],
        required: true,
        type: {
          name: 'string',
        },
      },
    };

    expect(extractProps({ __docgenInfo: tsDocgenData })).toMatchInlineSnapshot(`
      {
        "rows": [],
      }
    `);
  });

  it('original flow data', () => {
    const data = {
      description: '',
      displayName: 'AllianceCard',
      props: {
        text: {
          defaultValue: null,
          description: '',
          name: 'text',
          required: true,
          type: {
            name: 'string',
          },
        },
        background: {
          defaultValue: null,
          description: '',
          name: 'background',
          required: true,
          type: {
            name: 'string',
          },
        },
        name: {
          defaultValue: null,
          description: '',
          name: 'name',
          required: true,
          type: {
            name: 'string',
          },
        },
        troop: {
          defaultValue: null,
          description: '',
          name: 'troop',
          required: true,
          type: {
            name: 'enum',
            value: [
              {
                value: '"vector/troop/atreides.svg"',
              },
              {
                value: '"vector/troop/smuggler.svg"',
              },
            ],
          },
        },
        logo: {
          defaultValue: null,
          description: '',
          name: 'logo',
          required: true,
          type: {
            name: 'enum',
            value: [
              {
                value: '"vector/troop/atreides.svg"',
              },
              {
                value: '"vector/troop/smuggler.svg"',
              },
              {
                value: '"vector/generic/x.svg"',
              },
              {
                value: '"vector/generic/zap.svg"',
              },
              {
                value: '"vector/logo/moritani.svg"',
              },
              {
                value: '"vector/logo/richese.svg"',
              },
              {
                value: '"vector/decal/weirding-way-multicolor.svg"',
              },
              {
                value: '"vector/decal/weirding-way-plus.svg"',
              },
              {
                value: '"vector/decal/weirding-way.svg"',
              },
              {
                value: '"vector/decal/wire.svg"',
              },
              {
                value: '"vector/decal/zenobia.svg"',
              },
              {
                value: '"vector/icon/waves.svg"',
              },
              {
                value: '"vector/icon/worthless.svg"',
              },
              {
                value: '"vector/icon/wreath.svg"',
              },
            ],
          },
        },
        decals: {
          defaultValue: null,
          description: '',
          name: 'decals',
          required: true,
          type: {
            name: '{ id: "vector/troop/atreides.svg" | "vector/troop/smuggler.svg" | "vector/generic/x.svg" | "vector/generic/zap.svg" | "vector/logo/moritani.svg" | "vector/logo/richese.svg" | ... 7 more ... | "vector/icon/wreath.svg"; scale: number; offset: [...]; outline: boolean; muted: boolean; }[]',
          },
        },
      },
    };

    expect(extractComponentProps({ __docgenInfo: data }, 'props')).toMatchInlineSnapshot(`
      [
        {
          "docgenInfo": {
            "defaultValue": null,
            "description": "",
            "name": "text",
            "required": true,
            "type": {
              "name": "string",
            },
          },
          "jsDocTags": undefined,
          "propDef": {
            "defaultValue": null,
            "description": "",
            "name": "text",
            "required": true,
            "sbType": {
              "name": "string",
            },
            "type": {
              "detail": undefined,
              "summary": "string",
            },
          },
          "typeSystem": "JavaScript",
        },
        {
          "docgenInfo": {
            "defaultValue": null,
            "description": "",
            "name": "background",
            "required": true,
            "type": {
              "name": "string",
            },
          },
          "jsDocTags": undefined,
          "propDef": {
            "defaultValue": null,
            "description": "",
            "name": "background",
            "required": true,
            "sbType": {
              "name": "string",
            },
            "type": {
              "detail": undefined,
              "summary": "string",
            },
          },
          "typeSystem": "JavaScript",
        },
        {
          "docgenInfo": {
            "defaultValue": null,
            "description": "",
            "name": "name",
            "required": true,
            "type": {
              "name": "string",
            },
          },
          "jsDocTags": undefined,
          "propDef": {
            "defaultValue": null,
            "description": "",
            "name": "name",
            "required": true,
            "sbType": {
              "name": "string",
            },
            "type": {
              "detail": undefined,
              "summary": "string",
            },
          },
          "typeSystem": "JavaScript",
        },
        {
          "docgenInfo": {
            "defaultValue": null,
            "description": "",
            "name": "troop",
            "required": true,
            "type": {
              "name": "enum",
              "value": [
                {
                  "value": ""vector/troop/atreides.svg"",
                },
                {
                  "value": ""vector/troop/smuggler.svg"",
                },
              ],
            },
          },
          "jsDocTags": undefined,
          "propDef": {
            "defaultValue": null,
            "description": "",
            "name": "troop",
            "required": true,
            "sbType": {
              "name": "enum",
              "value": [
                "vector/troop/atreides.svg",
                "vector/troop/smuggler.svg",
              ],
            },
            "type": {
              "detail": undefined,
              "summary": "enum",
            },
          },
          "typeSystem": "JavaScript",
        },
        {
          "docgenInfo": {
            "defaultValue": null,
            "description": "",
            "name": "logo",
            "required": true,
            "type": {
              "name": "enum",
              "value": [
                {
                  "value": ""vector/troop/atreides.svg"",
                },
                {
                  "value": ""vector/troop/smuggler.svg"",
                },
                {
                  "value": ""vector/generic/x.svg"",
                },
                {
                  "value": ""vector/generic/zap.svg"",
                },
                {
                  "value": ""vector/logo/moritani.svg"",
                },
                {
                  "value": ""vector/logo/richese.svg"",
                },
                {
                  "value": ""vector/decal/weirding-way-multicolor.svg"",
                },
                {
                  "value": ""vector/decal/weirding-way-plus.svg"",
                },
                {
                  "value": ""vector/decal/weirding-way.svg"",
                },
                {
                  "value": ""vector/decal/wire.svg"",
                },
                {
                  "value": ""vector/decal/zenobia.svg"",
                },
                {
                  "value": ""vector/icon/waves.svg"",
                },
                {
                  "value": ""vector/icon/worthless.svg"",
                },
                {
                  "value": ""vector/icon/wreath.svg"",
                },
              ],
            },
          },
          "jsDocTags": undefined,
          "propDef": {
            "defaultValue": null,
            "description": "",
            "name": "logo",
            "required": true,
            "sbType": {
              "name": "enum",
              "value": [
                "vector/troop/atreides.svg",
                "vector/troop/smuggler.svg",
                "vector/generic/x.svg",
                "vector/generic/zap.svg",
                "vector/logo/moritani.svg",
                "vector/logo/richese.svg",
                "vector/decal/weirding-way-multicolor.svg",
                "vector/decal/weirding-way-plus.svg",
                "vector/decal/weirding-way.svg",
                "vector/decal/wire.svg",
                "vector/decal/zenobia.svg",
                "vector/icon/waves.svg",
                "vector/icon/worthless.svg",
                "vector/icon/wreath.svg",
              ],
            },
            "type": {
              "detail": undefined,
              "summary": "enum",
            },
          },
          "typeSystem": "JavaScript",
        },
        {
          "docgenInfo": {
            "defaultValue": null,
            "description": "",
            "name": "decals",
            "required": true,
            "type": {
              "name": "{ id: "vector/troop/atreides.svg" | "vector/troop/smuggler.svg" | "vector/generic/x.svg" | "vector/generic/zap.svg" | "vector/logo/moritani.svg" | "vector/logo/richese.svg" | ... 7 more ... | "vector/icon/wreath.svg"; scale: number; offset: [...]; outline: boolean; muted: boolean; }[]",
            },
          },
          "jsDocTags": undefined,
          "propDef": {
            "defaultValue": null,
            "description": "",
            "name": "decals",
            "required": true,
            "sbType": {
              "name": "other",
              "value": "{ id: "vector/troop/atreides.svg" | "vector/troop/smuggler.svg" | "vector/generic/x.svg" | "vector/generic/zap.svg" | "vector/logo/moritani.svg" | "vector/logo/richese.svg" | ... 7 more ... | "vector/icon/wreath.svg"; scale: number; offset: [...]; outline: boolean; muted: boolean; }[]",
            },
            "type": {
              "detail": undefined,
              "summary": "{ id: "vector/troop/atreides.svg" | "vector/troop/smuggler.svg" | "vector/generic/x.svg" | "vector/generic/zap.svg" | "vector/logo/moritani.svg" | "vector/logo/richese.svg" | ... 7 more ... | "vector/icon/wreath.svg"; scale: number; offset: [...]; outline: boolean; muted: boolean; }[]",
            },
          },
          "typeSystem": "JavaScript",
        },
      ]
    `);
  });
});
