import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import { classifyArgs } from './classify-args.ts';

const NO_DOCGEN = { slots: new Set<string>(), events: new Set<string>() };

describe('classifyArgs', () => {
  it('assigns roles from docgen slot and event names', () => {
    const result = classifyArgs(
      {
        content: t.stringLiteral('Hi'),
        checked: t.booleanLiteral(true),
        label: t.stringLiteral('Go'),
      },
      { slots: new Set(['content']), events: new Set(['update:checked']) }
    );

    expect(result.args.map((arg) => [arg.name, arg.role])).toEqual([
      ['content', 'slot'],
      ['checked', 'model'],
      ['label', 'prop'],
    ]);
  });

  it.each([
    { label: 'undefined', value: t.identifier('undefined') },
    { label: 'a function', value: t.arrowFunctionExpression([], t.nullLiteral()) },
    { label: 'an empty string', value: t.stringLiteral('') },
  ])('drops an arg set to $label without warning', ({ value }) => {
    const label = t.stringLiteral('ok');

    expect(classifyArgs({ a: value, label }, NO_DOCGEN)).toEqual({
      args: [{ name: 'label', value: label, role: 'prop', plan: { kind: 'inline' } }],
    });
  });

  it('omits an unresolvable arg, keeps the rest, and names the omission', () => {
    const label = t.stringLiteral('ok');
    const result = classifyArgs(
      { label, size: t.memberExpression(t.identifier('Sizes'), t.identifier('LARGE')) },
      NO_DOCGEN
    );

    expect(result.args.map((arg) => arg.name)).toEqual(['label']);
    expect(result.warning).toBe(
      'Omitted args that cannot be resolved statically: size: Sizes.LARGE'
    );
  });

  it('names every omitted arg in the warning', () => {
    const result = classifyArgs(
      {
        label: t.stringLiteral('ok'),
        size: t.identifier('SOME_CONST'),
        items: t.callExpression(t.identifier('makeItems'), [t.numericLiteral(3)]),
      },
      NO_DOCGEN
    );

    expect(result.args.map((arg) => arg.name)).toEqual(['label']);
    expect(result.warning).toBe(
      'Omitted args that cannot be resolved statically: size: SOME_CONST, items: makeItems(3)'
    );
  });

  it('omits a spread value rather than failing the story', () => {
    const result = classifyArgs(
      {
        label: t.stringLiteral('ok'),
        options: t.objectExpression([t.spreadElement(t.identifier('BASE_OPTIONS'))]),
      },
      NO_DOCGEN
    );

    expect(result.args.map((arg) => arg.name)).toEqual(['label']);
    expect(result.warning).toContain('BASE_OPTIONS');
  });

  it('defers when nothing the story sets can be rendered', () => {
    expect(classifyArgs({ label: t.identifier('SOME_CONST') }, NO_DOCGEN)).toEqual({
      args: [],
      defer: true,
    });
  });

  it('still renders a story whose only args are dropped silently', () => {
    expect(
      classifyArgs({ onClick: t.arrowFunctionExpression([], t.nullLiteral()) }, NO_DOCGEN)
    ).toEqual({ args: [] });
  });

  it('defers the whole story when a slot receives a function', () => {
    expect(
      classifyArgs(
        {
          default: t.arrowFunctionExpression([], t.stringLiteral('hi')),
          label: t.stringLiteral('ok'),
        },
        { slots: new Set(['default']), events: new Set() }
      )
    ).toEqual({ args: [], defer: true });
  });

  it('reports no warning when every arg renders', () => {
    expect(classifyArgs({ label: t.stringLiteral('ok') }, NO_DOCGEN).warning).toBeUndefined();
  });
});
