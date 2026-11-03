import { describe, expect, it } from 'vitest';

import { type ESTreeNode as Node, parseExpression, staticKey } from 'storybook/internal/csf-tools';
import {
  UnprintableArgError,
  legacyPrintValue as printValue,
  writtenArg,
} from 'storybook/internal/docs-tools';

import { printTemplate } from '../docgen/story-docs/print-template.ts';
import { fillTemplate } from './fill-template.ts';

const VALUES: unknown[] = [
  'Go',
  '',
  ' ',
  `it's "quoted"`,
  'a {b} c',
  '<b>bold</b>',
  'a & b',
  'back\\slash',
  'two\nlines',
  'tab\there',
  0,
  3,
  -1,
  1e3,
  -0.5,
  true,
  false,
  null,
  undefined,
  [],
  [1, 'two', null],
  {},
  { a: 1, 'b-c': ['x'] },
];

const TEMPLATES = [
  '<Panel {...args} />',
  '<Panel\n  {...args}\n  primary\n/>',
  '<Panel title={args.x} />',
  '<Panel {x} />',
  '<Panel title="a {args.x} b" />',
  '<p>{args.x}</p>',
  '<Panel onclick={() => args.x} />',
  '<Panel x="written" {...args} />',
  '{#if args.x}<p>yes</p>{/if}',
];

const argsOf = (source: string): Record<string, Node> => {
  const object = parseExpression(source);
  if (object.type !== 'ObjectExpression') throw new Error('Expected an object literal');
  return Object.fromEntries(
    object.properties.flatMap((property) =>
      property.type === 'Property' ? [[staticKey(property)!, property.value]] : []
    )
  );
};

describe('fillTemplate', () => {
  // A value a control sets prints as next prints a story that writes that value as its literal.
  it.each(TEMPLATES)('prints each value in %j as next prints it', (code) => {
    const parameter = code.includes('{x}') ? { aliases: { x: 'x' } } : undefined;
    for (const value of VALUES) {
      const options = {
        code,
        args: argsOf(`{ x: ${printValue(value, 'x')} }`),
        typescript: false,
        parameter,
        argsComplete: true,
      };
      const template = printTemplate({ ...options, holes: true });
      expect(fillTemplate(template, { x: value }), JSON.stringify(value)).toBe(
        printTemplate(options)
      );
    }
  });

  it('prints the code an unchanged arg is written with', () => {
    const template = printTemplate({
      code: '<Panel {...args} />',
      args: argsOf('{ x: rows.length }'),
      typescript: false,
      holes: true,
    });
    expect(fillTemplate(template, { x: writtenArg('rows.length') })).toBe(
      '<Panel x={rows.length} />'
    );
  });

  it.each(TEMPLATES)('throws for a value no code shows in %j', (code) => {
    const parameter = code.includes('{x}') ? { aliases: { x: 'x' } } : undefined;
    const template = printTemplate({
      code,
      args: argsOf('{ x: 1 }'),
      typescript: false,
      parameter,
      holes: true,
    });
    expect(() => fillTemplate(template, { x: () => {} })).toThrow(UnprintableArgError);
    expect(() => fillTemplate(template, { x: new Date(0) })).toThrow(UnprintableArgError);
  });
});
