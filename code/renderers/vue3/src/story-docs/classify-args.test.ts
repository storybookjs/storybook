import { describe, expect, it } from 'vitest';

import { babelParse, types as t } from 'storybook/internal/babel';

import { classifyArgs, type ClassifiedArg } from './classify-args.ts';
import { printValue } from './classify-value.ts';

interface DocgenFixture {
  props?: string[];
  slots?: string[];
  events?: string[];
}

interface ReadableClassifyArgsResult {
  args: string[];
  unset?: string[];
  unresolved?: string[];
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

  it('tracks an arg explicitly set to undefined without naming it unresolved', () => {
    expect(classify(`{ a: undefined, label: 'ok' }`)).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      unset: ['a'],
    });
  });

  it.each([
    { label: 'a function', value: '() => null' },
    { label: 'an empty string', value: `''` },
  ])('drops an arg set to $label without naming it', ({ value }) => {
    expect(classify(`{ a: ${value}, label: 'ok' }`)).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
    });
  });

  it('omits an unresolvable arg, keeps the rest, and names the omission', () => {
    expect(classify(`{ label: 'ok', size: Sizes.LARGE }`)).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      unresolved: ['size: Sizes.LARGE'],
    });
  });

  it('names every unresolved arg', () => {
    expect(classify(`{ label: 'ok', size: SOME_CONST, items: makeItems(3) }`)).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      unresolved: ['size: SOME_CONST', 'items: makeItems(3)'],
    });
  });

  it('omits a spread value rather than failing the story', () => {
    const result = classify(`{ label: 'ok', options: { ...BASE_OPTIONS } }`);

    expect(result.args).toEqual([`label: 'ok' -> prop (inline)`]);
    expect(result.unresolved?.[0]).toContain('BASE_OPTIONS');
  });

  it('names every arg when nothing the story sets can be rendered', () => {
    expect(classify(`{ label: SOME_CONST }`)).toEqual({
      args: [],
      unresolved: ['label: SOME_CONST'],
    });
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

  it('names a declared event arg whose value is not a function expression', () => {
    expect(classify(`{ label: 'ok', onSubmit: fn() }`, { events: ['submit'] })).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      unresolved: ['onSubmit: fn()'],
    });
  });

  it('omits a listener that captures a story-local binding, and names it', () => {
    expect(
      classify(`{ label: 'ok', onSubmit: value => formatHelper(value) }`, {
        events: ['submit'],
      })
    ).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      unresolved: ['onSubmit: value => formatHelper(value)'],
    });
  });

  it('omits a declared function prop that captures a story-local binding', () => {
    expect(
      classify(`{ label: 'ok', formatter: () => SOME_CONST }`, { props: ['formatter'] })
    ).toEqual({
      args: [`label: 'ok' -> prop (inline)`],
      unresolved: ['formatter: () => SOME_CONST'],
    });
  });

  it('classifies a declared function prop as a hoisted prop', () => {
    expect(classify(`{ formatter: () => null }`, { props: ['formatter'] })).toEqual({
      args: ['formatter: () => null -> prop (hoist)'],
    });
  });

  it('reports nothing unresolved when every arg renders', () => {
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
    args: result.args.map(formatArg),
    ...(result.unset.size > 0 ? { unset: Array.from(result.unset) } : {}),
    ...(result.unresolved.length > 0 ? { unresolved: result.unresolved } : {}),
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
