import { beforeEach, expect, test, vi } from 'vitest';

import { vol } from 'memfs';
import { dedent } from 'ts-dedent';

import { fsMocks } from '../fixtures';
import { getComponentDocgen } from './extractDocgenInfo';

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
  // @ts-expect-error fix this later
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
  // @ts-expect-error fix this later
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
  // @ts-expect-error fix this later
  expect(inputResult?.reactDocgen.data.displayName).toBe('Input');

  expect(labelResult).not.toBeNull();
  expect(labelResult?.componentName).toBe('Label');
  // @ts-expect-error fix this later
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
  // @ts-expect-error fix this later
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

  // @ts-expect-error fix this later
  const argTypesData = result?.reactDocgen.data;
  expect(argTypesData?.displayName).toBe('DetailedButton');
  expect(argTypesData?.description).toContain('detailed button component');
  // Note: react-docgen may not always extract detailed prop types depending on configuration
  expect(argTypesData?.props).toMatchInlineSnapshot(`
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
