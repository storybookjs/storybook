import { describe, expect, it } from 'vitest';

import { h } from 'vue';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('prints the component with every arg, its slots as content', () => {
    expect(fillTemplate('⟦element Button default⟧', { label: 'Go', primary: true, size: 2 })).toBe(
      '<Button label="Go" primary :size="2" />'
    );
    expect(
      fillTemplate('⟦element Card default header⟧', { disabled: false, default: 'Body', header: 1 })
    ).toBe('<Card :disabled="false">\n    Body\n    <template #header>1</template>\n  </Card>');
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
    expect(() => fillTemplate('⟦element Button⟧', { formatter })).toThrow(UnprintableArgError);
  });

  it("merges a spread's class with the element's own", () => {
    expect(fillTemplate('<div ⟦props +class⟧ class="a" />', { class: ['b'], id: 'x' })).toBe(
      `<div id="x" :class="['b']" class="a" />`
    );
    expect(fillTemplate(`<div ⟦props +:class⟧ :class="'a'" />`, { class: 'b' })).toBe(
      `<div class="b" :class="'a'" />`
    );
    expect(() => fillTemplate(`<div ⟦props +:class⟧ :class="'a'" />`, { class: ['b'] })).toThrow(
      UnprintableArgError
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
    expect(fillTemplate('<p>{{ ⟦value label⟧ }}</p>', { label: '&quot; }}' })).toBe(
      "<p>{{ '&amp;quot; }\\}' }}</p>"
    );
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

  it('binds an `is` Vue would read as the component of the element', () => {
    expect(fillTemplate('<Cell ⟦props⟧ />', { is: true })).toBe('<Cell :is="true" />');
    expect(fillTemplate('<Cell ⟦attr is is⟧ />', { is: 'vue:x' })).toBe(`<Cell :is="'vue:x'" />`);
    expect(fillTemplate('<Cell ⟦props⟧ />', { is: 'button' })).toBe('<Cell is="button" />');
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
});
