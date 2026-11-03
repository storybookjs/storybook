import { describe, expect, it } from 'vitest';

import { h, isVNode } from 'vue';

import { UnprintableArgError, printValue, writtenArg } from 'storybook/internal/docs-tools';

import {
  type SnippetValue,
  expressionCode,
  interpolatedText,
  operand,
  printAttribute,
  slotContent,
} from '../snippet-values.ts';
import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('prints an attribute as the snippet does: bare when true, quoted for a string, bound otherwise', () => {
    const template = '<Button⟦attr label value ~%20⟧ />';
    expect(fillTemplate(template, { value: true })).toBe('<Button label />');
    expect(fillTemplate(template, { value: false })).toBe('<Button :label="false" />');
    expect(fillTemplate(template, { value: 'Go' })).toBe('<Button label="Go" />');
    expect(fillTemplate(template, { value: 'say "hi"' })).toBe(`<Button label='say "hi"' />`);
    expect(fillTemplate(template, { value: 2 })).toBe('<Button :label="2" />');
    expect(fillTemplate(template, { value: -2 })).toBe('<Button :label="-2" />');
    expect(fillTemplate(template, { value: null })).toBe('<Button :label="null" />');
  });

  it('shows the static snippet for a value the snippet declares in its script instead', () => {
    const template = '<Button⟦attr label value ~%20⟧ />';
    for (const value of [`a & "b" 'c'`, ['a'], { a: 1 }, Number.NaN]) {
      expect(() => fillTemplate(template, { value })).toThrow(UnprintableArgError);
    }
  });

  it('leaves out an unset arg, a spy and an action, with the space before it', () => {
    const spy = Object.assign(() => {}, { getMockName: () => 'spy' });
    const action = Object.assign(() => {}, { isAction: true });
    expect(fillTemplate('<Button⟦attr label value ~%20⟧ />', {})).toBe('<Button />');
    expect(
      fillTemplate('<Button⟦props ~%20⟧ />', { a: undefined, onClick: spy, onHover: action })
    ).toBe('<Button />');
  });

  it('passes every arg a props hole does not name, in the order of their names', () => {
    expect(
      fillTemplate('<Card⟦attr label label ~%20⟧⟦props -label -default ~%20⟧ />', {
        label: 'Go',
        size: 2,
        default: 'Body',
        active: true,
      })
    ).toBe('<Card label="Go" active :size="2" />');
  });

  it('throws for a value no literal prints', () => {
    const formatter = (value: number) => value.toFixed(2);
    expect(() => fillTemplate('<Button⟦props⟧ />', { formatter })).toThrow(UnprintableArgError);
    expect(() => fillTemplate('<p>⟦text node slot⟧</p>', { node: h('b') })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('const n = ⟦value node script⟧;', { node: h('b') })).toThrow(
      UnprintableArgError
    );
  });

  it('prints a written arg as its code, as the snippet does', () => {
    const formatter = writtenArg('(v) => v && "x"');
    expect(fillTemplate('<Chart⟦attr format formatter ~%20⟧ />', { formatter })).toBe(
      '<Chart :format="(v) => v && "x"" />'
    );
    expect(fillTemplate('const f = ⟦value formatter script⟧;', { formatter })).toBe(
      'const f = (v) => v && "x";'
    );
  });

  it('writes interpolated text escaped, and shows the static snippet for code there', () => {
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: 'a < b & {{ c }}' })).toBe(
      '<p>a &lt; b &amp; &#123;&#123; c }}</p>'
    );
    expect(fillTemplate('<p>⟦text n⟧ ⟦text on⟧</p>', { n: 2, on: true })).toBe('<p>2 true</p>');
    expect(fillTemplate('<p>⟦text label⟧</p>', {})).toBe('<p></p>');
    expect(() => fillTemplate('<p>⟦text items⟧</p>', { items: ['a'] })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p>{⟦text label {<⟧</p>', { label: '{x' })).toThrow(
      UnprintableArgError
    );
  });

  it('writes slot content as text, code as an interpolation, and padded text not at all', () => {
    expect(fillTemplate('<C>⟦text default slot⟧</C>', { default: 'a <b>' })).toBe(
      '<C>a &lt;b&gt;</C>'
    );
    expect(fillTemplate('<C>⟦text default slot⟧</C>', { default: null })).toBe('<C>{{ null }}</C>');
    expect(() => fillTemplate('<C>⟦text default slot⟧</C>', { default: ' padded' })).toThrow(
      UnprintableArgError
    );
  });

  it('prints the text a written number shows while the arg holds it', () => {
    const template = '<C>⟦text default slot =1000⟧</C>';
    expect(fillTemplate(template, { default: writtenArg('1e3') })).toBe('<C>1000</C>');
    expect(fillTemplate(template, { default: 5 })).toBe('<C>5</C>');
  });

  it('prints a value hole as a literal for where it stands', () => {
    expect(fillTemplate(`<p :title="⟦value label op⟧ + '!'" />`, { label: 'a b' })).toBe(
      `<p :title="'a b' + '!'" />`
    );
    expect(fillTemplate(`<p :title='⟦value label ' op⟧ + "!"' />`, { label: 'it' })).toBe(
      `<p :title='"it" + "!"' />`
    );
    expect(fillTemplate('const label = ⟦value label script⟧;', { label: '</d>' })).toBe(
      "const label = '</d>';"
    );
  });

  it('shows the static snippet for a value an expression cannot hold, as the snippet bails', () => {
    for (const [template, label] of [
      [`<p :title="⟦value label op⟧" />`, 'say "hi"'],
      [`<p :title="⟦value label op⟧" />`, 'a & b'],
      ['<p>{{ ⟦value label {{ op⟧ }}</p>', 'a}}b'],
      [`<p :title="⟦value label op⟧" />`, ['a']],
    ] as const) {
      expect(() => fillTemplate(template, { label })).toThrow(UnprintableArgError);
    }
  });

  it('prints strings in double quotes where the story writes them so', () => {
    expect(fillTemplate('<p>{{ ⟦value label {{ " op⟧ }}</p>', { label: "it's" })).toBe(
      `<p>{{ "it's" }}</p>`
    );
  });

  it('puts a value in parentheses where the code around it would read it differently', () => {
    expect(fillTemplate('{{ ⟦value n {{ op⟧ ** 2 }}', { n: -2 })).toBe('{{ (-2) ** 2 }}');
    expect(fillTemplate('{{ ⟦value n {{ op .⟧.toFixed(1) }}', { n: 5 })).toBe(
      '{{ (5).toFixed(1) }}'
    );
    expect(fillTemplate('{{ ⟦value n {{ op⟧ + 1 }}', { n: 5 })).toBe('{{ 5 + 1 }}');
    expect(fillTemplate('const n = ⟦value n script⟧;', { n: -2 })).toBe('const n = -2;');
  });

  it("prints a default word's code for an unset arg", () => {
    const template = 'const open = ref(⟦value open script ?⟧);';
    expect(fillTemplate(template, {})).toBe('const open = ref();');
    expect(fillTemplate(template, { open: true })).toBe('const open = ref(true);');
  });
});

describe('fillTemplate, for any value a control sets', () => {
  const values: [unknown, SnippetValue | undefined][] = [
    ['Go', { kind: 'string', value: 'Go' }],
    [`say "hi"`, { kind: 'string', value: `say "hi"` }],
    ["it's", { kind: 'string', value: "it's" }],
    [`a "b" 'c'`, { kind: 'string', value: `a "b" 'c'` }],
    ['{x}', { kind: 'string', value: '{x}' }],
    ['{{ x }}', { kind: 'string', value: '{{ x }}' }],
    ['a}}b', { kind: 'string', value: 'a}}b' }],
    ['<b>', { kind: 'string', value: '<b>' }],
    ['a & b', { kind: 'string', value: 'a & b' }],
    ['line\nbreak', { kind: 'string', value: 'line\nbreak' }],
    [' padded ', { kind: 'string', value: ' padded ' }],
    ['', { kind: 'string', value: '' }],
    [0, { kind: 'number', value: 0, code: '0' }],
    [2.5, { kind: 'number', value: 2.5, code: '2.5' }],
    [1e3, { kind: 'number', value: 1000, code: '1000' }],
    [-3, { kind: 'code', code: '-3' }],
    [true, { kind: 'boolean', value: true }],
    [false, { kind: 'boolean', value: false }],
    [null, { kind: 'code', code: 'null' }],
    [writtenArg('fn()'), { kind: 'code', code: 'fn()' }],
    [Number.NaN, undefined],
    [['a', 1], undefined],
    [{ a: 1 }, undefined],
    [() => {}, undefined],
    [h('b'), undefined],
  ];
  const outcome = (print: () => string | undefined) => {
    try {
      return print() ?? UnprintableArgError;
    } catch (error) {
      return error instanceof UnprintableArgError ? UnprintableArgError : error;
    }
  };

  // An args binding leaves out an empty string, and the snippet indents a line break as the
  // template's own.
  const multiline = (value: unknown) => typeof value === 'string' && value.includes('\n');

  it.each(values)('prints %j as an attribute as the snippet does', (value, printed) => {
    expect(outcome(() => fillTemplate('⟦attr label x⟧', { x: value }))).toBe(
      value === ''
        ? ''
        : printed && !multiline(value)
          ? (printAttribute('label', printed) ?? UnprintableArgError)
          : UnprintableArgError
    );
  });

  it("shows the static snippet for '' where the template binds the arg itself", () => {
    expect(outcome(() => fillTemplate('⟦attr label x bound⟧', { x: '' }))).toBe(
      UnprintableArgError
    );
  });

  it.each(values)('prints %j as slot content as the snippet does', (value, printed) => {
    expect(outcome(() => fillTemplate('⟦text x slot⟧', { x: value }))).toBe(
      value === ''
        ? ''
        : printed && !multiline(value)
          ? (slotContent(printed) ?? UnprintableArgError)
          : UnprintableArgError
    );
  });

  it.each(values)('prints %j as interpolated text as the snippet does', (value, printed) => {
    expect(outcome(() => fillTemplate('⟦text x⟧', { x: value }))).toBe(
      value !== '' && printed && !multiline(value)
        ? (interpolatedText(printed) ?? UnprintableArgError)
        : UnprintableArgError
    );
  });

  it.each(values)('prints %j in an attribute expression as the snippet does', (value, printed) => {
    const code =
      printed === undefined
        ? undefined
        : printed.kind === 'code'
          ? printed.code
          : printValue(printed.value, 'x', { quote: "'" });
    expect(outcome(() => fillTemplate('⟦value x op⟧', { x: value }))).toBe(
      code === undefined || value === ''
        ? UnprintableArgError
        : (() => {
            const fits = expressionCode(code, '"');
            return fits === undefined ? UnprintableArgError : operand(fits, false);
          })()
    );
  });

  it.each(values)('prints %j in the script as a literal', (value) => {
    expect(outcome(() => fillTemplate('⟦value x script⟧', { x: value }))).toBe(
      value === ''
        ? UnprintableArgError
        : outcome(() => printValue(value, 'x', { quote: "'", opaque: isVNode }))
    );
  });
});
