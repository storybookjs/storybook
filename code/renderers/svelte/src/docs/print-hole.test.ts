import { describe, expect, it } from 'vitest';

import { type ESTreeNode as Node, parseExpression, staticKey } from 'storybook/internal/csf-tools';
import {
  UnprintableArgError,
  fillTemplate,
  printValue,
  stripHoles,
} from 'storybook/internal/docs-tools';

import { printTemplate } from '../docgen/story-docs/print-template.ts';
import { printHole } from './print-hole.ts';

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

const print = (code: string, value: unknown) =>
  printTemplate({
    code,
    args: argsOf(`{ x: ${printValue(value, 'x')} }`),
    typescript: false,
    parameter: code.includes('{x}') ? { aliases: { x: 'x' } } : undefined,
    argsComplete: true,
  });

const fill = (code: string, value: unknown) =>
  fillTemplate(
    print(code, 'Go').template!,
    { initialArgs: { x: 'Go' }, unmappedArgs: { x: value } },
    printHole
  );

describe('printHole', () => {
  it.each(TEMPLATES)('prints the snippet of %j while no arg changes', (code) => {
    const { snippet, template } = print(code, 'Go');
    expect(template).toBeDefined();
    expect(stripHoles(template!)).toBe(snippet);
  });

  it.each(TEMPLATES)('prints each value in %j as the snippet of a story that writes it', (code) => {
    for (const value of VALUES) {
      expect(fill(code, value), JSON.stringify(value)).toBe(print(code, value).snippet);
    }
  });

  it.each(TEMPLATES)('throws for a value no code shows in %j', (code) => {
    expect(() => fill(code, () => {})).toThrow(UnprintableArgError);
    expect(() => fill(code, new Date(0))).toThrow(UnprintableArgError);
  });
});
