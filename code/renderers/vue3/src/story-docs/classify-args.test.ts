import { describe, expect, it } from 'vitest';

import { babelParse, types as t } from 'storybook/internal/babel';

import { classifyArgs, type ClassifiedArg, type ClassifyArgsResult } from './classify-args.ts';
import { printValue } from './classify-value.ts';

interface DocgenFixture {
  props?: string[];
  slots?: string[];
  events?: string[];
}

interface ReadableClassifyArgsResult extends Omit<ClassifyArgsResult, 'args'> {
  args: string[];
}

describe('classifyArgs', () => {
  it('assigns roles from docgen slot and event names', () => {
    expect(
      classify(
        `{
          content: 'Hi',
          checked: true,
          label: 'Go',
        }`,
        {
          props: ['label'],
          slots: ['content'],
          events: ['update:checked'],
        }
      )
    ).toEqual({
      args: [
        `content: 'Hi' -> slot (inline)`,
        'checked: true -> model (inline)',
        `label: 'Go' -> prop (inline)`,
      ],
    });
  });

  it.each([
    { label: 'undefined', value: 'undefined' },
    { label: 'a function', value: '() => null' },
    { label: 'an empty string', value: `''` },
  ])('drops an arg set to $label without warning', ({ value }) => {
    expect(classify(`{ a: ${value}, label: 'ok' }`)).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
    });
  });

  it('omits an unresolvable arg, keeps the rest, and names the omission', () => {
    expect(classify(`{ label: 'ok', size: Sizes.LARGE }`)).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      warning: 'Omitted args that cannot be resolved statically: size: Sizes.LARGE',
    });
  });

  it('names every omitted arg in the warning', () => {
    expect(classify(`{ label: 'ok', size: SOME_CONST, items: makeItems(3) }`)).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      warning:
        'Omitted args that cannot be resolved statically: size: SOME_CONST, items: makeItems(3)',
    });
  });

  it('omits a spread value rather than failing the story', () => {
    const result = classify(`{ label: 'ok', options: { ...BASE_OPTIONS } }`);

    expect(result.args).toEqual([`label: 'ok' -> prop (inline)`]);
    expect(result.warning).toContain('BASE_OPTIONS');
  });

  it('defers when nothing the story sets can be rendered', () => {
    expect(classify(`{ label: SOME_CONST }`)).toEqual({ args: [], defer: true });
  });

  it('still renders a story whose only args are dropped silently', () => {
    expect(classify(`{ onClick: () => null }`)).toEqual({ args: [] });
  });

  it('forwards a function slot whose content only a render-tree renderer can realize', () => {
    expect(
      classify(
        `{
          default: () => h(Child),
          label: 'ok',
        }`,
        { slots: ['default'] }
      )
    ).toEqual({
      args: [`default: () => h(Child) -> slot (function-slot)`, `label: 'ok' -> prop (inline)`],
    });
  });

  it('renders a slot function that returns a string literal', () => {
    expect(classify(`{ default: () => 'hi' }`, { slots: ['default'] })).toEqual({
      args: [`default: 'hi' -> slot (inline)`],
    });
  });

  it('renders a slot function block that returns a string literal', () => {
    expect(classify(`{ default: () => { return 'hi' } }`, { slots: ['default'] })).toEqual({
      args: [`default: 'hi' -> slot (inline)`],
    });
  });

  it('forwards a multi-statement slot function instead of inlining its return', () => {
    expect(
      classify(`{ default: () => { sideEffect(); return 'hi'; }, label: 'ok' }`, {
        slots: ['default'],
      })
    ).toEqual({
      args: [
        `default: () => { sideEffect(); return 'hi'; } -> slot (function-slot)`,
        `label: 'ok' -> prop (inline)`,
      ],
    });
  });

  it('classifies a function arg matching a declared event as a listener', () => {
    expect(classify(`{ onSubmit: () => null }`, { events: ['submit'] })).toEqual({
      args: ['onSubmit: () => null -> event:submit (hoist)'],
    });
  });

  it('warns when a declared event arg value is not a function expression', () => {
    expect(classify(`{ label: 'ok', onSubmit: fn() }`, { events: ['submit'] })).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      warning: 'Omitted args that cannot be resolved statically: onSubmit: fn()',
    });
  });

  it('omits a listener that captures a story-local binding, and names it', () => {
    expect(
      classify(`{ label: 'ok', onSubmit: value => formatHelper(value) }`, {
        events: ['submit'],
      })
    ).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      warning:
        'Omitted args that cannot be resolved statically: onSubmit: value => formatHelper(value)',
    });
  });

  it('omits a declared function prop that captures a story-local binding', () => {
    expect(
      classify(`{ label: 'ok', formatter: () => SOME_CONST }`, { props: ['formatter'] })
    ).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      warning: 'Omitted args that cannot be resolved statically: formatter: () => SOME_CONST',
    });
  });

  it('classifies a declared function prop as a hoisted prop', () => {
    expect(classify(`{ formatter: () => null }`, { props: ['formatter'] })).toEqual({
      args: ['formatter: () => null -> prop (hoist)'],
    });
  });

  it('reports no warning when every arg renders', () => {
    expect(classify(`{ label: 'ok' }`)).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
    });
  });
});

function classify(
  code: string,
  { props = [], slots = [], events = [] }: DocgenFixture = {}
): ReadableClassifyArgsResult {
  const result = classifyArgs(parseArgs(code), {
    props: new Set(props),
    slots: new Set(slots),
    events: new Set(events),
  });

  return {
    ...result,
    args: result.args.map(formatArg),
  };
}

function parseArgs(code: string): Record<string, t.Node> {
  const file = babelParse(`(${code})`);
  const statement = file.program.body[0];
  if (!t.isExpressionStatement(statement) || !t.isObjectExpression(statement.expression)) {
    throw new Error(`Not an args object: ${code}`);
  }

  return Object.fromEntries(
    statement.expression.properties.map((property) => {
      if (!t.isObjectProperty(property) || property.computed) {
        throw new Error(`Not a plain arg: ${printValue(property)}`);
      }

      if (t.isIdentifier(property.key)) {
        return [property.key.name, property.value];
      }
      if (t.isStringLiteral(property.key)) {
        return [property.key.value, property.value];
      }

      throw new Error(`Unsupported arg name: ${printValue(property.key)}`);
    })
  );
}

function formatArg(arg: ClassifiedArg): string {
  const destination =
    arg.role === 'event' && arg.eventName ? `${arg.role}:${arg.eventName}` : arg.role;
  return `${arg.name}: ${printValue(arg.value)} -> ${destination} (${arg.plan.kind})`;
}
