import { describe, expect, it } from 'vitest';

import { types as t } from 'storybook/internal/babel';

import { classifyArgs } from './classify-args.ts';

const NO_DOCGEN = { props: new Set<string>(), slots: new Set<string>(), events: new Set<string>() };

describe('classifyArgs', () => {
  it('assigns roles from docgen slot and event names', () => {
    const result = classifyArgs(
      {
        content: t.stringLiteral('Hi'),
        checked: t.booleanLiteral(true),
        label: t.stringLiteral('Go'),
      },
      {
        props: new Set(['label']),
        slots: new Set(['content']),
        events: new Set(['update:checked']),
      }
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
          default: t.arrowFunctionExpression(
            [],
            t.callExpression(t.identifier('h'), [t.identifier('Child')])
          ),
          label: t.stringLiteral('ok'),
        },
        { props: new Set<string>(), slots: new Set(['default']), events: new Set() }
      )
    ).toEqual({ args: [], defer: true });
  });

  it('renders a slot function that returns a string literal', () => {
    const returned = t.stringLiteral('hi');
    const result = classifyArgs(
      { default: t.arrowFunctionExpression([], returned) },
      { props: new Set<string>(), slots: new Set(['default']), events: new Set() }
    );

    expect(result.args).toEqual([
      { name: 'default', value: returned, role: 'slot', plan: { kind: 'inline' } },
    ]);
    expect(result.args[0].value.type).toBe('StringLiteral');
  });

  it('renders a slot function block that returns a string literal', () => {
    const returned = t.stringLiteral('hi');
    const result = classifyArgs(
      {
        default: t.arrowFunctionExpression([], t.blockStatement([t.returnStatement(returned)])),
      },
      { props: new Set<string>(), slots: new Set(['default']), events: new Set() }
    );

    expect(result.args).toEqual([
      { name: 'default', value: returned, role: 'slot', plan: { kind: 'inline' } },
    ]);
    expect(result.args[0].value.type).toBe('StringLiteral');
  });

  it('defers the whole story when a slot function has a multi-statement body', () => {
    expect(
      classifyArgs(
        {
          default: t.arrowFunctionExpression(
            [],
            t.blockStatement([
              t.expressionStatement(t.stringLiteral('side effect')),
              t.returnStatement(t.stringLiteral('hi')),
            ])
          ),
          label: t.stringLiteral('ok'),
        },
        { props: new Set<string>(), slots: new Set(['default']), events: new Set() }
      )
    ).toEqual({ args: [], defer: true });
  });

  it('classifies a function arg matching a declared event as a listener', () => {
    const value = t.arrowFunctionExpression([], t.nullLiteral());

    expect(
      classifyArgs(
        { onSubmit: value },
        { props: new Set<string>(), slots: new Set(), events: new Set(['submit']) }
      ).args
    ).toEqual([
      { name: 'onSubmit', value, role: 'event', eventName: 'submit', plan: { kind: 'hoist' } },
    ]);
  });

  it('warns when a declared event arg value is not a function expression', () => {
    const label = t.stringLiteral('ok');
    const result = classifyArgs(
      {
        label,
        onSubmit: t.callExpression(t.identifier('fn'), []),
      },
      { props: new Set<string>(), slots: new Set(), events: new Set(['submit']) }
    );

    expect(result.args).toEqual([
      { name: 'label', value: label, role: 'prop', plan: { kind: 'inline' } },
    ]);
    expect(result.warning).toBe('Omitted args that cannot be resolved statically: onSubmit: fn()');
  });

  it('classifies a declared function prop as a hoisted prop', () => {
    const value = t.arrowFunctionExpression([], t.nullLiteral());

    expect(
      classifyArgs(
        { formatter: value },
        { props: new Set(['formatter']), slots: new Set(), events: new Set() }
      ).args
    ).toEqual([{ name: 'formatter', value, role: 'prop', plan: { kind: 'hoist' } }]);
  });

  it('reports no warning when every arg renders', () => {
    expect(classifyArgs({ label: t.stringLiteral('ok') }, NO_DOCGEN).warning).toBeUndefined();
  });
});
