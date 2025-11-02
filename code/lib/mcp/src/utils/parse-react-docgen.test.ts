import { describe, expect, test } from 'vitest';
import { parseReactDocgen } from './parse-react-docgen';

describe('parseReactDocgen', () => {
	test('prefers raw over computed for unions (and copies default/required)', () => {
		const result = parseReactDocgen({
			props: {
				size: {
					description: 'Visual size',
					required: false,
					defaultValue: { value: '"md"', computed: false },
					tsType: {
						name: 'union',
						raw: '"sm" | "md" | "lg"',
						elements: [
							{ name: 'literal', value: '"sm"' },
							{ name: 'literal', value: '"md"' },
							{ name: 'literal', value: '"lg"' },
						],
					},
				},
			},
		});
		expect(result).toMatchInlineSnapshot(`
      {
        "props": {
          "size": {
            "defaultValue": ""md"",
            "description": "Visual size",
            "required": false,
            "type": ""sm" | "md" | "lg"",
          },
        },
      }
    `);
	});

	test('serializes union when raw is missing', () => {
		const result = parseReactDocgen({
			props: {
				tone: {
					description: 'Semantic tone',
					required: false,
					tsType: {
						name: 'union',
						elements: [
							{ name: 'literal', value: '"primary"' },
							{ name: 'literal', value: '"secondary"' },
						],
					},
				},
			},
		});
		expect(result).toMatchInlineSnapshot(`
      {
        "props": {
          "tone": {
            "defaultValue": undefined,
            "description": "Semantic tone",
            "required": false,
            "type": ""primary" | "secondary"",
          },
        },
      }
    `);
	});

	test('serializes intersection', () => {
		const result = parseReactDocgen({
			props: {
				options: {
					tsType: {
						name: 'intersection',
						elements: [
							{
								name: 'Record',
								elements: [{ name: 'string' }, { name: 'number' }],
							},
							{
								name: 'signature',
								type: 'object',
								signature: {
									properties: [
										{ key: 'a', value: { name: 'string', required: true } },
									],
								},
							},
						],
					},
				},
			},
		});
		expect(result).toMatchInlineSnapshot(`
      {
        "props": {
          "options": {
            "defaultValue": undefined,
            "description": undefined,
            "required": undefined,
            "type": "Record<string, number> & { a: string }",
          },
        },
      }
    `);
	});

	test('serializes Array fallback as T[]', () => {
		const result = parseReactDocgen({
			props: {
				tags: {
					tsType: { name: 'Array', elements: [{ name: 'string' }] },
					defaultValue: { value: '[]', computed: false },
				},
			},
		});
		expect(result).toMatchInlineSnapshot(`
      {
        "props": {
          "tags": {
            "defaultValue": "[]",
            "description": undefined,
            "required": undefined,
            "type": "string[]",
          },
        },
      }
    `);
	});

	test('serializes tuple', () => {
		const result = parseReactDocgen({
			props: {
				anchor: {
					tsType: {
						name: 'tuple',
						elements: [{ name: 'literal', value: '"x"' }, { name: 'number' }],
					},
				},
			},
		});
		expect(result).toMatchInlineSnapshot(`
      {
        "props": {
          "anchor": {
            "defaultValue": undefined,
            "description": undefined,
            "required": undefined,
            "type": "["x", number]",
          },
        },
      }
    `);
	});

	test('serializes literal', () => {
		const result = parseReactDocgen({
			props: {
				variant: {
					tsType: { name: 'literal', value: '"solid"' },
				},
			},
		});
		expect(result).toMatchInlineSnapshot(`
      {
        "props": {
          "variant": {
            "defaultValue": undefined,
            "description": undefined,
            "required": undefined,
            "type": ""solid"",
          },
        },
      }
    `);
	});

	test('serializes function signature', () => {
		const result = parseReactDocgen({
			props: {
				onClick: {
					description: 'Click handler',
					tsType: {
						name: 'signature',
						type: 'function',
						signature: {
							arguments: [{ name: 'ev', type: { name: 'MouseEvent' } }],
							return: { name: 'void' },
						},
					},
				},
			},
		});
		expect(result).toMatchInlineSnapshot(`
      {
        "props": {
          "onClick": {
            "defaultValue": undefined,
            "description": "Click handler",
            "required": undefined,
            "type": "(ev: MouseEvent) => void",
          },
        },
      }
    `);
	});

	test('serializes object signature with required and optional properties', () => {
		const result = parseReactDocgen({
			props: {
				asKind: {
					tsType: {
						name: 'signature',
						type: 'object',
						signature: {
							properties: [
								{
									key: 'kind',
									value: { name: 'literal', value: '"button"', required: true },
								},
								{
									key: 'type',
									value: {
										name: 'union',
										raw: '"button" | "submit" | "reset"',
										required: false,
									},
								},
							],
						},
					},
					defaultValue: {
						value: '{ kind: "button", type: "button" }',
						computed: false,
					},
				},
			},
		});
		expect(result).toMatchInlineSnapshot(`
      {
        "props": {
          "asKind": {
            "defaultValue": "{ kind: "button", type: "button" }",
            "description": undefined,
            "required": undefined,
            "type": "{ kind: "button"; type?: "button" | "submit" | "reset" }",
          },
        },
      }
    `);
	});

	test('generic type serialization and bare names', () => {
		const result = parseReactDocgen({
			props: {
				items: {
					tsType: {
						name: 'Array',
						elements: [{ name: 'Item', elements: [{ name: 'TMeta' }] }],
					},
				},
				children: { tsType: { name: 'ReactNode' } },
			},
		});
		expect(result).toMatchInlineSnapshot(`
      {
        "props": {
          "children": {
            "defaultValue": undefined,
            "description": undefined,
            "required": undefined,
            "type": "ReactNode",
          },
          "items": {
            "defaultValue": undefined,
            "description": undefined,
            "required": undefined,
            "type": "Item<TMeta>[]",
          },
        },
      }
    `);
	});

	test('handles undefined tsType and defaultValue null', () => {
		const result = parseReactDocgen({
			props: {
				icon: {
					tsType: undefined,
					defaultValue: { value: null, computed: false },
					required: true,
				},
			},
		});
		expect(result).toMatchInlineSnapshot(`
      {
        "props": {
          "icon": {
            "defaultValue": null,
            "description": undefined,
            "required": true,
            "type": undefined,
          },
        },
      }
    `);
	});
});
