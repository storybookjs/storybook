import { describe, expect, it } from 'vitest';

import { parseTypeText, type ParsedTypeText } from './parse-type-text.ts';

describe('parseTypeText', () => {
  it.each([
    {
      input: "'a'",
      output: { type: { name: 'enum', value: ['a'] } },
    },
    {
      input: "'a' | 'b' | undefined",
      output: { type: { name: 'enum', value: ['a', 'b'] } },
    },
    {
      input: '"a" | "b"',
      output: { type: { name: 'enum', value: ['a', 'b'] } },
    },
    {
      input: "'a' | 'b' | string",
      output: { type: { name: 'enum', value: ['a', 'b'] } },
    },
    {
      input: '1 | 2 | 3',
      output: { type: { name: 'enum', value: [1, 2, 3] } },
    },
    {
      input: 'true | false',
      output: { type: { name: 'boolean' } },
    },
    {
      input: 'string | number',
      output: { type: { name: 'string' } },
    },
    {
      input: 'number | SomeType',
      output: { type: { name: 'number' } },
    },
    {
      input: "'self' | { id: string }",
      output: { type: { name: 'other', value: "'self' | { id: string }" }, control: 'object' },
    },
    {
      input: "'a' | Foo",
      output: { type: { name: 'enum', value: ['a'] } },
    },
    {
      input: "'a' | SomeType",
      output: { type: { name: 'enum', value: ['a'] } },
    },
    {
      input: "'auto' | true",
      output: { type: { name: 'other', value: "'auto' | true" }, control: 'object' },
    },
    {
      input: "'auto' | Date",
      output: { type: { name: 'other', value: "'auto' | Date" }, control: 'object' },
    },
    {
      input: "'a' | () => void",
      output: { type: { name: 'other', value: "'a' | () => void" }, control: false },
    },
    {
      input: "'a' | Function",
      output: { type: { name: 'other', value: "'a' | Function" }, control: false },
    },
    {
      input: 'boolean | undefined',
      output: { type: { name: 'boolean' } },
    },
    {
      input: "Array<'a' | 'b'>",
      output: {
        type: { name: 'array', value: { name: 'enum', value: ['a', 'b'] } },
        control: 'multi-select',
        options: ['a', 'b'],
      },
    },
    {
      input: "('a' | 'b')[]",
      output: {
        type: { name: 'array', value: { name: 'enum', value: ['a', 'b'] } },
        control: 'multi-select',
        options: ['a', 'b'],
      },
    },
    {
      input: "Array<'a' | Foo>",
      output: {
        type: { name: 'array', value: { name: 'enum', value: ['a'] } },
        control: 'multi-select',
        options: ['a'],
      },
    },
    {
      input: "('a' | Foo)[]",
      output: {
        type: { name: 'array', value: { name: 'enum', value: ['a'] } },
        control: 'multi-select',
        options: ['a'],
      },
    },
    {
      input: 'Array<() => void>',
      output: { type: { name: 'array', value: { name: 'function' } } },
    },
    {
      input: '(() => void)[]',
      output: { type: { name: 'array', value: { name: 'function' } } },
    },
    {
      input: 'Date[]',
      output: { type: { name: 'array', value: { name: 'date' } } },
    },
    {
      input: 'Array<object>',
      output: { type: { name: 'array', value: { name: 'object', value: {} } } },
    },
    {
      input: 'number[][]',
      output: { type: { name: 'array', value: { name: 'array', value: { name: 'number' } } } },
    },
    {
      input: 'Array<(A) | (B)>',
      output: { type: { name: 'array', value: { name: 'other', value: 'A | B' } } },
    },
    {
      input: "Array<(x: number) => 'a' | 'b'>",
      output: { type: { name: 'array', value: { name: 'function' } } },
    },
    {
      input: 'string',
      output: { type: { name: 'string' } },
    },
    {
      input: 'number',
      output: { type: { name: 'number' } },
    },
    {
      input: 'bigint',
      output: { type: { name: 'number' } },
    },
    {
      input: 'boolean',
      output: { type: { name: 'boolean' } },
    },
    {
      input: 'Date | null',
      output: { type: { name: 'date' }, control: 'date' },
    },
    {
      input: '(size: Size) => void',
      output: { type: { name: 'function' } },
    },
    {
      input: '(a: string) => number',
      output: { type: { name: 'function' } },
    },
    {
      input: '((size: Size) => void) | undefined',
      output: { type: { name: 'function' } },
    },
    {
      input: 'Function',
      output: { type: { name: 'function' } },
    },
    {
      input: 'string[]',
      output: { type: { name: 'array', value: { name: 'string' } } },
    },
    {
      input: 'Array<number>',
      output: { type: { name: 'array', value: { name: 'number' } } },
    },
    {
      input: 'array',
      output: { type: { name: 'array', value: { name: 'other', value: '' } } },
    },
    {
      input: 'Array',
      output: { type: { name: 'array', value: { name: 'other', value: '' } } },
    },
    {
      input: 'object',
      output: { type: { name: 'object', value: {} } },
    },
    {
      input: 'Object',
      output: { type: { name: 'object', value: {} } },
    },
    {
      input: '{ id: string }',
      output: { type: { name: 'object', value: {} } },
    },
    {
      input: 'Record<string, number>',
      output: { type: { name: 'object', value: {} } },
    },
    {
      input: '{ onClick: () => void }',
      output: { type: { name: 'object', value: {} } },
    },
    {
      input: 'Record<string, () => void>',
      output: { type: { name: 'object', value: {} } },
    },
    {
      input: 'Promise<() => void>',
      output: { type: { name: 'object', value: {} } },
    },
    {
      input: 'MyType[]',
      output: { type: { name: 'array', value: { name: 'other', value: 'MyType' } } },
    },
    {
      input: 'Size',
      output: { type: { name: 'other', value: 'Size' }, control: false },
    },
    {
      input: 'HTMLElement | null',
      output: { type: { name: 'other', value: 'HTMLElement' }, control: false },
    },
    {
      input: '',
      output: undefined,
    },
    {
      input: undefined,
      output: undefined,
    },
  ] satisfies { input: string | undefined; output: ParsedTypeText | undefined }[])(
    '$input => $output',
    ({ input, output }) => {
      expect(parseTypeText(input)).toEqual(output);
    }
  );
});
