import { describe, expect, it } from 'vitest';

import { h } from 'vue';

import { UnprintableArgError, writtenArg } from 'storybook/internal/docs-tools';

import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('prints an attribute as the snippet does: bare when true, quoted for a string, bound otherwise', () => {
    const template = '<Button ⟦attr label value⟧ />';
    expect(fillTemplate(template, { value: true })).toBe('<Button label />');
    expect(fillTemplate(template, { value: false })).toBe('<Button :label="false" />');
    expect(fillTemplate(template, { value: 'Go' })).toBe('<Button label="Go" />');
    expect(fillTemplate(template, { value: 'say "hi"' })).toBe(`<Button label='say "hi"' />`);
    expect(fillTemplate(template, { value: 2 })).toBe('<Button :label="2" />');
    expect(fillTemplate(template, { value: null })).toBe('<Button :label="null" />');
    expect(fillTemplate(template, { value: ['a', "it's"] })).toBe(
      `<Button :label="['a', 'it\\'s']" />`
    );
  });

  it('binds a string an attribute cannot hold as written, as entities decode in it', () => {
    expect(fillTemplate('<Button ⟦attr label value⟧ />', { value: `a & "b" 'c'` })).toBe(
      `<Button :label="'a &amp; &quot;b&quot; \\'c\\''" />`
    );
  });

  it('leaves out an unset arg, a spy and an action, with the space before it', () => {
    const spy = Object.assign(() => {}, { getMockName: () => 'spy' });
    const action = Object.assign(() => {}, { isAction: true });
    expect(fillTemplate('<Button ⟦attr label value⟧ />', {})).toBe('<Button />');
    expect(
      fillTemplate('<Button ⟦props⟧ />', { a: undefined, onClick: spy, onHover: action })
    ).toBe('<Button />');
  });

  it('passes every arg a props hole does not name, in the order of their names', () => {
    expect(
      fillTemplate('<Card ⟦attr label label⟧ ⟦props -label -default⟧ />', {
        label: 'Go',
        size: 2,
        default: 'Body',
        active: true,
      })
    ).toBe('<Card label="Go" active :size="2" />');
  });

  it('throws for a value no literal prints', () => {
    const formatter = (value: number) => value.toFixed(2);
    expect(() => fillTemplate('<Button ⟦props⟧ />', { formatter })).toThrow(UnprintableArgError);
    expect(() => fillTemplate('<p>⟦text node⟧</p>', { node: h('b') })).toThrow(UnprintableArgError);
    expect(() => fillTemplate('<Button ⟦props⟧ />', { 'my label': 'Go' })).toThrow(
      UnprintableArgError
    );
  });

  it('prints a written arg as its code, escaped where it lands', () => {
    const formatter = writtenArg('(v) => v && "x"');
    expect(fillTemplate('<Chart ⟦attr format formatter⟧ />', { formatter })).toBe(
      '<Chart :format="(v) => v &amp;&amp; &quot;x&quot;" />'
    );
    expect(fillTemplate('const f = ⟦value formatter script⟧;', { formatter })).toBe(
      'const f = (v) => v && "x";'
    );
  });

  it('writes text Vue would read as markup escaped, and any other value as an interpolation', () => {
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: 'a < b & {{ c }}' })).toBe(
      '<p>a &lt; b &amp; &#123;&#123; c }}</p>'
    );
    expect(fillTemplate('<p>⟦text n⟧ ⟦text on⟧</p>', { n: 2, on: true })).toBe('<p>2 true</p>');
    expect(fillTemplate('<p>⟦text label⟧</p>', {})).toBe('<p></p>');
    expect(fillTemplate('<p>⟦text items⟧</p>', { items: ['a'] })).toBe("<p>{{ ['a'] }}</p>");
  });

  it('prints a value hole as a literal for where it stands', () => {
    expect(fillTemplate(`<p :title="⟦value label⟧ + '!'" />`, { label: `"a" & b` })).toBe(
      `<p :title="'&quot;a&quot; &amp; b' + '!'" />`
    );
    expect(fillTemplate(`<p :title='⟦value label '⟧ + "!"' />`, { label: "it's" })).toBe(
      `<p :title='"it&#39;s" + "!"' />`
    );
    expect(fillTemplate('<p>{{ ⟦value label {{⟧ }}</p>', { label: 'a}}b' })).toBe(
      "<p>{{ 'a}\\}b' }}</p>"
    );
    expect(fillTemplate('const label = ⟦value label script⟧;', { label: '</script>' })).toBe(
      "const label = '<\\/script>';"
    );
  });

  it('prints strings in double quotes where the story writes them so', () => {
    expect(fillTemplate('<p>{{ ⟦value label {{ "⟧ }}</p>', { label: "it's" })).toBe(
      `<p>{{ "it's" }}</p>`
    );
  });

  it('puts a value in parentheses where the code around it would read it differently', () => {
    expect(fillTemplate('{{ ⟦value n {{⟧ ** 2 }}', { n: -2 })).toBe('{{ (-2) ** 2 }}');
    expect(fillTemplate('{{ ⟦value n {{ .⟧.toFixed(1) }}', { n: 5 })).toBe('{{ (5).toFixed(1) }}');
    expect(fillTemplate('{{ ⟦value n {{⟧ + 1 }}', { n: 5 })).toBe('{{ 5 + 1 }}');
  });

  it("prints a default word's code for an unset arg", () => {
    const template = 'const open = ref(⟦value open script ?⟧);';
    expect(fillTemplate(template, {})).toBe('const open = ref();');
    expect(fillTemplate(template, { open: true })).toBe('const open = ref(true);');
  });
});
