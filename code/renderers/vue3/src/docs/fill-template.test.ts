import { describe, expect, it } from 'vitest';

import { h } from 'vue';

import { UnprintableArgError, writtenArg } from 'storybook/internal/docs-tools';

import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('closes the element with the slots as content, and the props in the order of their names', () => {
    expect(
      fillTemplate('<Button ⟦props -default⟧⟦slots Button default⟧', {
        size: 2,
        label: 'Go',
        primary: true,
      })
    ).toBe('<Button label="Go" primary :size="2" />');
    expect(
      fillTemplate('<Card ⟦props -default -header⟧ :items="items"⟦slots Card default header⟧', {
        disabled: false,
        default: 'Body',
        header: 1,
      })
    ).toBe(
      '<Card :disabled="false" :items="items">\n    Body\n    <template #header>\n      1\n    </template>\n  </Card>'
    );
  });

  it('leaves out an unset arg, a spy and an action, and binds a null arg', () => {
    const spy = Object.assign(() => {}, { getMockName: () => 'spy' });
    const action = Object.assign(() => {}, { isAction: true });
    expect(
      fillTemplate('<Button ⟦props⟧ />', { a: undefined, onClick: spy, onHover: action })
    ).toBe('<Button />');
    expect(fillTemplate('<Button ⟦attr label text⟧ />', {})).toBe('<Button />');
    expect(fillTemplate('<Button ⟦attr label text⟧ />', { text: null })).toBe(
      '<Button :label="null" />'
    );
  });

  it('throws for a function arg that is neither a spy nor an action', () => {
    const formatter = (value: number) => value.toFixed(2);
    expect(() => fillTemplate('<Button ⟦attr format formatter⟧ />', { formatter })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<Button ⟦props⟧ />', { formatter })).toThrow(UnprintableArgError);
  });

  it('prints a written arg as its code, escaped for the attribute it lands in', () => {
    const formatter = writtenArg('(v) => v && "x"');
    expect(fillTemplate('<Chart ⟦props⟧ />', { formatter })).toBe(
      '<Chart :formatter="(v) => v &amp;&amp; &quot;x&quot;" />'
    );
    expect(fillTemplate('const f = ⟦value formatter script⟧;', { formatter })).toBe(
      'const f = (v) => v && "x";'
    );
  });

  it('leaves out the args a props hole names', () => {
    expect(fillTemplate('<Card ⟦props -default⟧ />', { default: 'x', a: 'b' })).toBe(
      '<Card a="b" />'
    );
  });

  it('escapes a string attribute and binds any other value', () => {
    expect(fillTemplate('<Button ⟦attr label text⟧ />', { text: 'say "hi" & go' })).toBe(
      '<Button label="say &quot;hi&quot; &amp; go" />'
    );
    expect(fillTemplate('<Button ⟦props⟧ />', { items: ['a', "it's"], style: { gap: 1 } })).toBe(
      `<Button :items="['a', 'it\\'s']" :style="{ gap: 1 }" />`
    );
  });

  it('writes text Vue would read as markup escaped, and anything else as an interpolation', () => {
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: 'a < b & {{ c }}' })).toBe(
      '<p>a &lt; b &amp; {&#123; c }}</p>'
    );
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: ' padded ' })).toBe(
      "<p>{{ ' padded ' }}</p>"
    );
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: { a: '"' } })).toBe(
      "<p>{{ { a: '&quot;' } }}</p>"
    );
  });

  it('prints a value hole as a literal in the code around it', () => {
    expect(
      fillTemplate('<p v-if="⟦value open⟧ && ⟦value label⟧">', { open: true, label: 'a"b' })
    ).toBe(`<p v-if="true && 'a&quot;b'">`);
    expect(
      fillTemplate('<p :config="⟦value config⟧">', { config: writtenArg('{a: {b: 1}}') })
    ).toBe('<p :config="{a: {b: 1}}">');
    expect(fillTemplate('<p>⟦text label⟧</p>', { label: 'a  }}}' })).toBe(
      "<p>{{ 'a  }\\}\\}' }}</p>"
    );
    expect(
      fillTemplate('<p>⟦text label⟧</p>', { label: writtenArg('JSON.stringify({a:{b:{}}})') })
    ).toBe('<p>{{ JSON.stringify({a:{b:{} } }) }}</p>');
  });

  it('keeps a string or written code from ending the interpolation a value hole is in', () => {
    expect(fillTemplate('<p>{{ ⟦operand label {{⟧.trim() }}</p>', { label: 'a}}b' })).toBe(
      "<p>{{ 'a}\\}b'.trim() }}</p>"
    );
    expect(
      fillTemplate('<p>{{ ⟦value fmt {{⟧(1) }}</p>', { fmt: writtenArg('(s) => ({a:{b:s}})') })
    ).toBe('<p>{{ (s) => ({a:{b:s} })(1) }}</p>');
  });

  it('escapes a value in an attribute written in single quotes for that quote', () => {
    expect(fillTemplate(`<p :title='⟦value label '⟧ + "!"'>`, { label: `a"b'c` })).toBe(
      `<p :title='"a\\"b&#39;c" + "!"'>`
    );
  });

  it('starts a statement with a `;` where the literal would continue the one before', () => {
    expect(fillTemplate('⟦operand n script ;⟧.toFixed()', { n: 5 })).toBe(';(5).toFixed()');
    expect(fillTemplate('⟦operand n script ;⟧.forEach()', { n: [1] })).toBe(';[1].forEach()');
    expect(fillTemplate('⟦operand n script ;⟧.at()', { n: 'ab' })).toBe("'ab'.at()");
  });

  it('writes text with a whitespace run or a `{` before an interpolation as code', () => {
    expect(fillTemplate('<p>⟦text a⟧</p>', { a: 'a  b' })).toBe("<p>{{ 'a  b' }}</p>");
    expect(fillTemplate('<p>⟦text a⟧⟦text b⟧</p>', { a: 'Price {', b: true })).toBe(
      '<p>Price &#123;{{ true }}</p>'
    );
  });

  it('prints a hole in the script as code, where no entity is decoded', () => {
    expect(fillTemplate('const a = ref(⟦value a script⟧);', { a: 'x & "y" </script>' })).toBe(
      `const a = ref('x & "y" <\\/script>');`
    );
    expect(fillTemplate('const n = ⟦operand n script⟧.toFixed();', { n: 5 })).toBe(
      'const n = (5).toFixed();'
    );
  });

  it('throws for an arg it cannot print or name as an attribute', () => {
    expect(() => fillTemplate('⟦value onClick⟧', { onClick: () => {} })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p>⟦text icon⟧</p>', { icon: h('span') })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p>⟦text icons⟧</p>', { icons: [h('span')] })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<Button ⟦props⟧ />', { 'my prop': 1 })).toThrow(UnprintableArgError);
  });

  it('binds an arg named with a colon, as a listener for a model update', () => {
    expect(fillTemplate('<Button ⟦props⟧ />', { 'onUpdate:modelValue': writtenArg('fn()') })).toBe(
      '<Button :onUpdate:modelValue="fn()" />'
    );
  });
});
