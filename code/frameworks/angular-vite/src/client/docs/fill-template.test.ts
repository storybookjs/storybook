import { describe, expect, it } from 'vitest';

import { UnprintableArgError, writtenArg, writtenCode } from 'storybook/internal/docs-tools';

import {
  escapeAttributeExpression,
  escapeTemplateLiteral,
  indentLines,
  inputBinding,
  printExpressionValue,
  textValue,
} from '../../snippet-values.ts';

import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('prints a value into a binding as the build prints the story args, for the template literal', () => {
    expect(
      fillTemplate('<x [label]="⟦bind label⟧" [config]="⟦bind config⟧" />', {
        label: `it's "q"`,
        config: { a: [1, 'b'], 'c-d': null, e: undefined },
      })
    ).toBe(
      String.raw`<x [label]="'it\\'s &quot;q&quot;'" [config]="{a: [1, 'b'], 'c-d': null}" />`
    );
  });

  it('prints an arg the story writes as code as that code', () => {
    expect(
      fillTemplate('<x [onClick]="⟦bind onClick⟧" />', { onClick: writtenArg('() => go("x")') })
    ).toBe('<x [onClick]="() => go(&quot;x&quot;)" />');
  });

  it('leaves out an argsToTemplate binding for an unset arg, with the space before it', () => {
    const template = '<x a="1"⟦prop label ~%20⟧⟦prop size ~%20⟧></x>';
    expect(fillTemplate(template, { label: 'Go' })).toBe(`<x a="1" [label]="'Go'"></x>`);
    expect(fillTemplate(template, { label: undefined, size: 2 })).toBe('<x a="1" [size]="2"></x>');
  });

  it('prints a field as code, indenting the lines after the first', () => {
    expect(fillTemplate('  items = ⟦field items +2⟧;', { items: writtenArg('[\n  1,\n]') })).toBe(
      '  items = [\n    1,\n  ];'
    );
  });

  it('prints text as written, and none Angular would read as its own syntax', () => {
    expect(fillTemplate('<b>⟦text label⟧</b>', { label: 'a <i>b</i> `d`' })).toBe(
      '<b>a <i>b</i> \\`d\\`</b>'
    );
    expect(fillTemplate('<b>⟦text count⟧</b>', { count: 3 })).toBe('<b>3</b>');
    for (const label of ['a {b}', '@if', '{{ x }}']) {
      expect(() => fillTemplate('<b>⟦text label⟧</b>', { label })).toThrow(UnprintableArgError);
    }
  });

  it.each([() => null, new Date(0), Number.NaN, Symbol('s')])(
    'throws for a value with no expression, such as %s',
    (value) => {
      expect(() => fillTemplate('[a]="⟦bind a⟧"', { a: value })).toThrow(UnprintableArgError);
    }
  );
});

const VALUES: unknown[] = [
  'Go',
  `it's "q" \`t\` \${x} \\ & <b>`,
  'line\nbreak',
  '',
  0,
  -1,
  1e3,
  1.5,
  Number.NaN,
  true,
  false,
  null,
  undefined,
  [1, 'a', null],
  { a: 1, 'b-c': ['x'], d: undefined },
  () => {},
  new Date(0),
  writtenArg('fn((o) => o.name)'),
  writtenArg('[\n  1,\n]'),
];

const shared = (value: unknown, print: (code: string) => string) => {
  const code = writtenCode(value);
  if (code !== undefined) {
    return print(code);
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new UnprintableArgError('x');
  }
  return print(
    printExpressionValue(value, () => {
      throw new UnprintableArgError('x');
    })
  );
};

const outcome = (print: () => string) => {
  try {
    return print();
  } catch (error) {
    return error instanceof UnprintableArgError ? 'unprintable' : String(error);
  }
};

describe('fillTemplate prints each value with snippet-values', () => {
  it.each(VALUES.map((value) => [value]))('%s', (value) => {
    const args = { x: value };
    expect(outcome(() => fillTemplate('⟦bind x +2⟧', args))).toBe(
      outcome(() =>
        shared(value, (code) =>
          indentLines(escapeTemplateLiteral(escapeAttributeExpression(code)), '  ')
        )
      )
    );
    expect(outcome(() => fillTemplate('⟦field x⟧', args))).toBe(
      outcome(() => shared(value, (code) => code))
    );
    expect(outcome(() => fillTemplate('⟦prop x⟧', args))).toBe(
      value === undefined || typeof value === 'function'
        ? ''
        : outcome(() =>
            shared(value, (code) =>
              escapeTemplateLiteral(inputBinding('x', escapeAttributeExpression(code)))
            )
          )
    );
    const text = writtenCode(value) ?? textValue(value);
    expect(outcome(() => fillTemplate('⟦text x⟧', args))).toBe(
      text === undefined || /[{}@]/.test(text) ? 'unprintable' : escapeTemplateLiteral(text)
    );
  });
});
