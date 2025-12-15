import { beforeEach, expect, test, vi } from 'vitest';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { fsMocks } from './fixtures';
import { generateMockProps, getComponentDocgen } from './getComponentProps';

beforeEach(() => {
  vi.spyOn(process, 'cwd').mockReturnValue('/app');
  vol.fromJSON(fsMocks, '/app');
});

// Tests for getComponentDocgen function
test('getComponentDocgen - extracts component name and docgen from a simple component file', () => {
  const componentFilePath = '/app/src/components/Button.tsx';
  const componentCode = dedent`
    import React from 'react';

    interface ButtonProps {
      children: React.ReactNode;
      variant?: 'primary' | 'secondary';
    }

    /**
     * A simple button component
     */
    export const Button: React.FC<ButtonProps> = ({ children, variant = 'primary' }) => {
      return <button className={variant}>{children}</button>;
    };
  `;

  vol.fromJSON({
    [componentFilePath]: componentCode,
  });

  const result = getComponentDocgen(componentFilePath);

  expect(result).not.toBeNull();
  expect(result?.componentName).toBe('Button');
  expect(result?.reactDocgen.type).toBe('success');
  expect(result?.reactDocgen.data.displayName).toBe('Button');
});

test('getComponentDocgen - extracts default export component when no name specified', () => {
  const componentFilePath = '/app/src/components/Icon.tsx';
  const componentCode = dedent`
    import React from 'react';

    interface IconProps {
      name: string;
      size?: number;
    }

    /**
     * An icon component
     */
    const Icon: React.FC<IconProps> = ({ name, size = 16 }) => {
      return <span style={{ fontSize: size }}>{name}</span>;
    };

    export default Icon;
  `;

  vol.fromJSON({
    [componentFilePath]: componentCode,
  });

  const result = getComponentDocgen(componentFilePath);

  expect(result).not.toBeNull();
  expect(result?.componentName).toBe('Icon');
  expect(result?.reactDocgen.type).toBe('success');
  expect(result?.reactDocgen.data.displayName).toBe('Icon');
});

test('getComponentDocgen - finds specific component by name when multiple exports exist', () => {
  const componentFilePath = '/app/src/components/Form.tsx';
  const componentCode = dedent`
    import React from 'react';

    /**
     * Input component
     */
    export const Input: React.FC<{ placeholder?: string }> = ({ placeholder }) => {
      return <input placeholder={placeholder} />;
    };

    /**
     * Label component
     */
    export const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      return <label>{children}</label>;
    };
  `;

  vol.fromJSON({
    [componentFilePath]: componentCode,
  });

  const inputResult = getComponentDocgen(componentFilePath, 'Input');
  const labelResult = getComponentDocgen(componentFilePath, 'Label');

  expect(inputResult).not.toBeNull();
  expect(inputResult?.componentName).toBe('Input');
  expect(inputResult?.reactDocgen.data.displayName).toBe('Input');

  expect(labelResult).not.toBeNull();
  expect(labelResult?.componentName).toBe('Label');
  expect(labelResult?.reactDocgen.data.displayName).toBe('Label');
});

test('getComponentDocgen - returns null for non-existent component name', () => {
  const componentFilePath = '/app/src/components/Button.tsx';
  const componentCode = dedent`
    import React from 'react';

    export const Button: React.FC = () => {
      return <button>Click me</button>;
    };
  `;

  vol.fromJSON({
    [componentFilePath]: componentCode,
  });

  const result = getComponentDocgen(componentFilePath, 'NonExistentComponent');

  expect(result).toBeNull();
});

test('getComponentDocgen - returns null for file with no components', () => {
  const utilityFilePath = '/app/src/utils/helpers.ts';
  const utilityCode = dedent`
    export const formatDate = (date: Date): string => {
      return date.toISOString();
    };

    export const capitalize = (str: string): string => {
      return str.charAt(0).toUpperCase() + str.slice(1);
    };
  `;

  vol.fromJSON({
    [utilityFilePath]: utilityCode,
  });

  const result = getComponentDocgen(utilityFilePath);

  expect(result).toBeNull();
});

test('getComponentDocgen - handles file read errors gracefully', () => {
  const nonExistentFilePath = '/app/src/components/NonExistent.tsx';

  const result = getComponentDocgen(nonExistentFilePath);

  expect(result).toBeNull();
});

test('getComponentDocgen - works with TypeScript class components', () => {
  const componentFilePath = '/app/src/components/LegacyButton.tsx';
  const componentCode = dedent`
    import React from 'react';

    interface ButtonProps {
      children: React.ReactNode;
    }

    /**
     * A legacy class-based button component
     */
    export class LegacyButton extends React.Component<ButtonProps> {
      render() {
        return <button>{this.props.children}</button>;
      }
    }
  `;

  vol.fromJSON({
    [componentFilePath]: componentCode,
  });

  const result = getComponentDocgen(componentFilePath);

  expect(result).not.toBeNull();
  expect(result?.componentName).toBe('LegacyButton');
  expect(result?.reactDocgen.type).toBe('success');
  expect(result?.reactDocgen.data.displayName).toBe('LegacyButton');
});

test('getComponentDocgen - extracts JSDoc comments and component information', () => {
  const componentFilePath = '/app/src/components/DetailedButton.tsx';
  const componentCode = dedent`
    import React from 'react';

    interface DetailedButtonProps {
      // React node
      children: React.ReactNode;

      // Literal union
      variant?: 'primary' | 'secondary' | 'danger';

      // Primitive booleans, numbers, strings
      disabled?: boolean;
      label?: string;
      priority?: number;

      // Date
      createdAt?: Date;

      // Array
      tags?: string[];
      steps?: Array<{ id: string; done: boolean }>;

      // Tuple
      coordinates?: [number, number];

      // Object
      metadata?: {
        id: string;
        description?: string;
        flags?: Record<string, boolean>;
      };

      // Record/map-like object
      styleOverrides?: Record<string, string | number>;

      // Nullable/undefined union
      note?: string | null;

      // Function with parameters and return value
      onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
      onClose?: () => Promise<void>;

      // Discriminated union example
      mode?:
        | { type: 'static'; value: string }
        | { type: 'dynamic'; compute: () => string };

      // Enum-like field (numeric or string)
      size?: 'small' | 'medium' | 'large';

      // Arbitrary JSON-like struct
      config?: unknown;

      // Async data
      fetchData?: () => Promise<{ result: string[] }>;

      // Optional callback list
      lifecycleHooks?: Array<() => void>;

      // Optional custom renderer
      renderPrefix?: () => React.ReactNode;
    }

    /**
     * A detailed button component with comprehensive documentation
     */
    export const DetailedButton: React.FC<DetailedButtonProps> = ({
      children,
      variant = 'primary',
      disabled = false,
      onClick,
    }) => {
      return (
        <button
          className={variant}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </button>
      );
    };
  `;

  vol.fromJSON({
    [componentFilePath]: componentCode,
  });

  const result = getComponentDocgen(componentFilePath);

  expect(result).not.toBeNull();
  expect(result?.componentName).toBe('DetailedButton');
  expect(result?.reactDocgen.type).toBe('success');

  const docgenData = result?.reactDocgen.data;
  expect(docgenData?.displayName).toBe('DetailedButton');
  expect(docgenData?.description).toContain('detailed button component');
  // Note: react-docgen may not always extract detailed prop types depending on configuration
  expect(docgenData?.props).toMatchInlineSnapshot(`
    {
      "children": {
        "description": "",
        "required": true,
        "tsType": {
          "name": "ReactReactNode",
          "raw": "React.ReactNode",
        },
      },
      "config": {
        "description": "",
        "required": false,
        "tsType": {
          "name": "unknown",
        },
      },
      "coordinates": {
        "description": "",
        "required": false,
        "tsType": {
          "elements": [
            {
              "name": "number",
            },
            {
              "name": "number",
            },
          ],
          "name": "tuple",
          "raw": "[number, number]",
        },
      },
      "createdAt": {
        "description": "",
        "required": false,
        "tsType": {
          "name": "Date",
        },
      },
      "disabled": {
        "defaultValue": {
          "computed": false,
          "value": "false",
        },
        "description": "",
        "required": false,
        "tsType": {
          "name": "boolean",
        },
      },
      "fetchData": {
        "description": "",
        "required": false,
        "tsType": {
          "name": "signature",
          "raw": "() => Promise<{ result: string[] }>",
          "signature": {
            "arguments": [],
            "return": {
              "elements": [
                {
                  "name": "signature",
                  "raw": "{ result: string[] }",
                  "signature": {
                    "properties": [
                      {
                        "key": "result",
                        "value": {
                          "elements": [
                            {
                              "name": "string",
                            },
                          ],
                          "name": "Array",
                          "raw": "string[]",
                          "required": true,
                        },
                      },
                    ],
                  },
                  "type": "object",
                },
              ],
              "name": "Promise",
              "raw": "Promise<{ result: string[] }>",
            },
          },
          "type": "function",
        },
      },
      "label": {
        "description": "",
        "required": false,
        "tsType": {
          "name": "string",
        },
      },
      "lifecycleHooks": {
        "description": "",
        "required": false,
        "tsType": {
          "elements": [
            {
              "name": "signature",
              "raw": "() => void",
              "signature": {
                "arguments": [],
                "return": {
                  "name": "void",
                },
              },
              "type": "function",
            },
          ],
          "name": "Array",
          "raw": "Array<() => void>",
        },
      },
      "metadata": {
        "description": "",
        "required": false,
        "tsType": {
          "name": "signature",
          "raw": "{
      id: string;
      description?: string;
      flags?: Record<string, boolean>;
    }",
          "signature": {
            "properties": [
              {
                "key": "id",
                "value": {
                  "name": "string",
                  "required": true,
                },
              },
              {
                "key": "description",
                "value": {
                  "name": "string",
                  "required": false,
                },
              },
              {
                "key": "flags",
                "value": {
                  "elements": [
                    {
                      "name": "string",
                    },
                    {
                      "name": "boolean",
                    },
                  ],
                  "name": "Record",
                  "raw": "Record<string, boolean>",
                  "required": false,
                },
              },
            ],
          },
          "type": "object",
        },
      },
      "mode": {
        "description": "",
        "required": false,
        "tsType": {
          "elements": [
            {
              "name": "signature",
              "raw": "{ type: 'static'; value: string }",
              "signature": {
                "properties": [
                  {
                    "key": "type",
                    "value": {
                      "name": "literal",
                      "required": true,
                      "value": "'static'",
                    },
                  },
                  {
                    "key": "value",
                    "value": {
                      "name": "string",
                      "required": true,
                    },
                  },
                ],
              },
              "type": "object",
            },
            {
              "name": "signature",
              "raw": "{ type: 'dynamic'; compute: () => string }",
              "signature": {
                "properties": [
                  {
                    "key": "type",
                    "value": {
                      "name": "literal",
                      "required": true,
                      "value": "'dynamic'",
                    },
                  },
                  {
                    "key": "compute",
                    "value": {
                      "name": "signature",
                      "raw": "() => string",
                      "required": true,
                      "signature": {
                        "arguments": [],
                        "return": {
                          "name": "string",
                        },
                      },
                      "type": "function",
                    },
                  },
                ],
              },
              "type": "object",
            },
          ],
          "name": "union",
          "raw": "| { type: 'static'; value: string }
    | { type: 'dynamic'; compute: () => string }",
        },
      },
      "note": {
        "description": "",
        "required": false,
        "tsType": {
          "elements": [
            {
              "name": "string",
            },
            {
              "name": "null",
            },
          ],
          "name": "union",
          "raw": "string | null",
        },
      },
      "onClick": {
        "description": "",
        "required": false,
        "tsType": {
          "name": "signature",
          "raw": "(event: React.MouseEvent<HTMLButtonElement>) => void",
          "signature": {
            "arguments": [
              {
                "name": "event",
                "type": {
                  "elements": [
                    {
                      "name": "HTMLButtonElement",
                    },
                  ],
                  "name": "ReactMouseEvent",
                  "raw": "React.MouseEvent<HTMLButtonElement>",
                },
              },
            ],
            "return": {
              "name": "void",
            },
          },
          "type": "function",
        },
      },
      "onClose": {
        "description": "",
        "required": false,
        "tsType": {
          "name": "signature",
          "raw": "() => Promise<void>",
          "signature": {
            "arguments": [],
            "return": {
              "elements": [
                {
                  "name": "void",
                },
              ],
              "name": "Promise",
              "raw": "Promise<void>",
            },
          },
          "type": "function",
        },
      },
      "priority": {
        "description": "",
        "required": false,
        "tsType": {
          "name": "number",
        },
      },
      "renderPrefix": {
        "description": "",
        "required": false,
        "tsType": {
          "name": "signature",
          "raw": "() => React.ReactNode",
          "signature": {
            "arguments": [],
            "return": {
              "name": "ReactReactNode",
              "raw": "React.ReactNode",
            },
          },
          "type": "function",
        },
      },
      "size": {
        "description": "",
        "required": false,
        "tsType": {
          "elements": [
            {
              "name": "literal",
              "value": "'small'",
            },
            {
              "name": "literal",
              "value": "'medium'",
            },
            {
              "name": "literal",
              "value": "'large'",
            },
          ],
          "name": "union",
          "raw": "'small' | 'medium' | 'large'",
        },
      },
      "steps": {
        "description": "",
        "required": false,
        "tsType": {
          "elements": [
            {
              "name": "signature",
              "raw": "{ id: string; done: boolean }",
              "signature": {
                "properties": [
                  {
                    "key": "id",
                    "value": {
                      "name": "string",
                      "required": true,
                    },
                  },
                  {
                    "key": "done",
                    "value": {
                      "name": "boolean",
                      "required": true,
                    },
                  },
                ],
              },
              "type": "object",
            },
          ],
          "name": "Array",
          "raw": "Array<{ id: string; done: boolean }>",
        },
      },
      "styleOverrides": {
        "description": "",
        "required": false,
        "tsType": {
          "elements": [
            {
              "name": "string",
            },
            {
              "elements": [
                {
                  "name": "string",
                },
                {
                  "name": "number",
                },
              ],
              "name": "union",
              "raw": "string | number",
            },
          ],
          "name": "Record",
          "raw": "Record<string, string | number>",
        },
      },
      "tags": {
        "description": "",
        "required": false,
        "tsType": {
          "elements": [
            {
              "name": "string",
            },
          ],
          "name": "Array",
          "raw": "string[]",
        },
      },
      "variant": {
        "defaultValue": {
          "computed": false,
          "value": "'primary'",
        },
        "description": "",
        "required": false,
        "tsType": {
          "elements": [
            {
              "name": "literal",
              "value": "'primary'",
            },
            {
              "name": "literal",
              "value": "'secondary'",
            },
            {
              "name": "literal",
              "value": "'danger'",
            },
          ],
          "name": "union",
          "raw": "'primary' | 'secondary' | 'danger'",
        },
      },
    }
  `);
});

// Tests for generateMockProps function
test('generateMockProps - handles empty props', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {},
  } as any;

  const result = generateMockProps(docgenData);

  expect(result).toEqual({
    required: {},
    optional: {},
  });
});

test('generateMockProps - separates required and optional props', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      requiredProp: {
        required: true,
        tsType: { name: 'string' },
      },
      optionalProp: {
        required: false,
        tsType: { name: 'number' },
      },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required).toEqual({
    requiredProp: 'mock string',
  });
  expect(result.optional).toEqual({
    optionalProp: 42,
  });
});

test('generateMockProps - generates correct mock values for primitive types', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      booleanProp: { required: true, tsType: { name: 'boolean' } },
      stringProp: { required: true, tsType: { name: 'string' } },
      numberProp: { required: true, tsType: { name: 'number' } },
      dateProp: { required: true, tsType: { name: 'Date' } },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.booleanProp).toBe(true);
  expect(result.required.stringProp).toBe('mock string');
  expect(result.required.numberProp).toBe(42);
  expect(result.required.dateProp).toBeInstanceOf(Date);
});

test('generateMockProps - handles color-related strings', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      colorProp: { required: true, tsType: { name: 'string', raw: 'color' } },
      backgroundColor: { required: true, tsType: { name: 'string', raw: 'backgroundColor' } },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.colorProp).toBe('#ff0000');
  expect(result.required.backgroundColor).toBe('#ff0000');
});

test('generateMockProps - handles date-related strings', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      dateString: { required: true, tsType: { name: 'string', raw: 'dateString' } },
      createdAt: { required: true, tsType: { name: 'string', raw: 'createdAt' } },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.dateString).toBe('2023-12-01');
  expect(result.required.createdAt).toBe('2023-12-01');
});

test('generateMockProps - handles React nodes', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      children: { required: true, tsType: { name: 'ReactReactNode' } },
      content: { required: true, tsType: { name: 'ReactNode' } },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.children).toBe('<div>Mock React Node</div>');
  expect(result.required.content).toBe('<div>Mock React Node</div>');
});

test('generateMockProps - handles functions as __function__', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      onClick: { required: true, tsType: { name: 'signature' } },
      onChange: { required: true, tsType: { name: 'signature' } },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.onClick).toBe('__function__');
  expect(result.required.onChange).toBe('__function__');
});

test('generateMockProps - handles union types with literals', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      variant: {
        required: true,
        tsType: {
          name: 'union',
          elements: [
            { name: 'literal', value: "'primary'" },
            { name: 'literal', value: "'secondary'" },
            { name: 'literal', value: "'danger'" },
          ],
        },
      },
      size: {
        required: true,
        tsType: {
          name: 'union',
          raw: "'small' | 'medium' | 'large'",
          elements: [
            { name: 'literal', value: "'small'" },
            { name: 'literal', value: "'medium'" },
            { name: 'literal', value: "'large'" },
          ],
        },
      },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.variant).toBe('primary');
  expect(result.required.size).toBe('small');
});

test('generateMockProps - handles union types without literals', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      mixedUnion: {
        required: true,
        tsType: {
          name: 'union',
          elements: [{ name: 'string' }, { name: 'number' }],
        },
      },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.mixedUnion).toBe('mock string');
});

test('generateMockProps - handles arrays', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      tags: { required: true, tsType: { name: 'Array', elements: [{ name: 'string' }] } },
      numbers: { required: true, tsType: { name: 'Array', elements: [{ name: 'number' }] } },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.tags).toEqual(['mock string']);
  expect(result.required.numbers).toEqual([42]);
});

test('generateMockProps - handles arrays with custom types', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      cartItems: {
        required: true,
        tsType: {
          name: 'Array',
          elements: [{ name: 'CartItem' }],
          raw: 'CartItem[]',
        },
      },
      users: {
        required: true,
        tsType: {
          name: 'Array',
          elements: [{ name: 'User' }],
          raw: 'User[]',
        },
      },
    },
  } as any;

  const result = generateMockProps(docgenData);

  // Should return empty arrays for custom types that can't be resolved
  expect(result.required.cartItems).toEqual([]);
  expect(result.required.users).toEqual([]);
});

test('generateMockProps - handles tuples', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      coordinates: {
        required: true,
        tsType: {
          name: 'tuple',
          elements: [{ name: 'number' }, { name: 'number' }],
        },
      },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.coordinates).toEqual(['mock string', 'mock string']);
});

test('generateMockProps - handles Records and objects', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      config: { required: true, tsType: { name: 'Record' } },
      metadata: {
        required: true,
        tsType: {
          name: 'signature',
          signature: {
            properties: [
              { key: 'id', value: { name: 'string', required: true } },
              { key: 'name', value: { name: 'string', required: false } },
            ],
          },
        },
      },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.config).toEqual({});
  expect(result.required.metadata).toEqual({
    id: 'mock string',
    name: 'mock string',
  });
});

test('generateMockProps - handles React event types', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      onMouseEvent: { required: true, tsType: { name: 'ReactMouseEvent' } },
      onButtonElement: { required: true, tsType: { name: 'HTMLButtonElement' } },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.onMouseEvent).toBe('__function__');
  expect(result.required.onButtonElement).toBe('__function__');
});

test('generateMockProps - handles null, void, and unknown types', () => {
  const docgenData = {
    displayName: 'TestComponent',
    props: {
      nullable: { required: true, tsType: { name: 'null' } },
      voidProp: { required: true, tsType: { name: 'void' } },
      unknownProp: { required: true, tsType: { name: 'unknown' } },
      anyProp: { required: true, tsType: { name: 'any' } },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required.nullable).toBe(null);
  expect(result.required.voidProp).toBe(undefined);
  expect(result.required.unknownProp).toBe('mock unknown value');
  expect(result.required.anyProp).toBe('mock any value');
});

test('generateMockProps - handles complex real-world example', () => {
  // Based on the example from the attached file
  const docgenData = {
    displayName: 'DetailedButton',
    props: {
      children: {
        required: true,
        tsType: { name: 'ReactReactNode', raw: 'React.ReactNode' },
      },
      variant: {
        required: false,
        tsType: {
          name: 'union',
          raw: "'primary' | 'secondary' | 'danger'",
          elements: [
            { name: 'literal', value: "'primary'" },
            { name: 'literal', value: "'secondary'" },
            { name: 'literal', value: "'danger'" },
          ],
        },
      },
      disabled: {
        required: false,
        tsType: { name: 'boolean' },
      },
      onClick: {
        required: false,
        tsType: {
          name: 'signature',
          raw: '(event: React.MouseEvent<HTMLButtonElement>) => void',
        },
      },
      size: {
        required: false,
        tsType: {
          name: 'union',
          raw: "'small' | 'medium' | 'large'",
          elements: [
            { name: 'literal', value: "'small'" },
            { name: 'literal', value: "'medium'" },
            { name: 'literal', value: "'large'" },
          ],
        },
      },
      tags: {
        required: false,
        tsType: {
          name: 'Array',
          raw: 'string[]',
          elements: [{ name: 'string' }],
        },
      },
    },
  } as any;

  const result = generateMockProps(docgenData);

  expect(result.required).toEqual({
    children: '<div>Mock React Node</div>',
  });

  expect(result.optional).toEqual({
    variant: 'primary',
    disabled: true,
    onClick: '__function__',
    size: 'small',
    tags: ['mock string'],
  });
});
