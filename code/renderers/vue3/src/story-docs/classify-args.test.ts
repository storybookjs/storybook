import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import { classifyArgs } from './classify-args.ts';

describe('classifyArgs', () => {
  it.each([
    {
      label: 'object',
      value: t.objectExpression([
        t.objectProperty(
          t.identifier('nested'),
          t.objectExpression([
            t.objectProperty(t.identifier('value'), t.identifier('OBJECT_VALUE')),
          ])
        ),
      ]),
      identifier: 'OBJECT_VALUE',
    },
    {
      label: 'array',
      value: t.arrayExpression([
        t.arrayExpression([t.stringLiteral('static'), t.identifier('ARRAY_VALUE')]),
      ]),
      identifier: 'ARRAY_VALUE',
    },
  ])('rejects an identifier nested in an $label value', ({ value, identifier }) => {
    expect(classifyArgs({ options: value }, { slots: new Set(), events: new Set() })).toEqual({
      args: [],
      error: {
        name: 'Unsupported story args',
        message: `Arg "options" references "${identifier}", which cannot be statically inlined yet.`,
      },
    });
  });

  it('drops an arg set to undefined without failing the story', () => {
    const label = t.stringLiteral('ok');

    expect(
      classifyArgs({ a: t.identifier('undefined'), label }, { slots: new Set(), events: new Set() })
    ).toEqual({ args: [{ type: 'prop', name: 'label', value: label }] });
  });

  it.each([
    { label: 'slot', docgen: { slots: new Set(['content']), events: new Set<string>() } },
    { label: 'v-model', docgen: { slots: new Set<string>(), events: new Set(['update:content']) } },
  ])('drops an undefined $label arg', ({ docgen }) => {
    expect(classifyArgs({ content: t.identifier('undefined') }, docgen)).toEqual({ args: [] });
  });

  it('keeps undefined nested in an object value', () => {
    const value = t.objectExpression([
      t.objectProperty(t.identifier('color'), t.identifier('undefined')),
    ]);

    expect(classifyArgs({ options: value }, { slots: new Set(), events: new Set() })).toEqual({
      args: [{ type: 'prop', name: 'options', value }],
    });
  });

  it('still rejects an identifier alongside an undefined arg', () => {
    expect(
      classifyArgs(
        { a: t.identifier('undefined'), label: t.identifier('LABEL') },
        { slots: new Set(), events: new Set() }
      )
    ).toEqual({
      args: [],
      error: {
        name: 'Unsupported story args',
        message: 'Arg "label" references "LABEL", which cannot be statically inlined yet.',
      },
    });
  });

  it('keeps spread identifiers classified as spread values', () => {
    const value = t.objectExpression([t.spreadElement(t.identifier('BASE_OPTIONS'))]);

    expect(classifyArgs({ options: value }, { slots: new Set(), events: new Set() })).toEqual({
      args: [],
      error: {
        name: 'Unsupported story args',
        message: 'Arg "options" contains a spread value, which cannot be statically inlined yet.',
      },
    });
  });
});
