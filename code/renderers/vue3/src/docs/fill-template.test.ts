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

  it('leaves out an unset arg and a function arg', () => {
    expect(fillTemplate('<Button⟦props⟧ />', { a: undefined, b: null, onClick: () => {} })).toBe(
      '<Button />'
    );
    expect(fillTemplate('<Button⟦attr label text⟧ />', {})).toBe('<Button />');
  });

  it('leaves out the args a props hole names', () => {
    expect(fillTemplate('<Card⟦props -default⟧ />', { default: 'x', a: 'b' })).toBe(
      '<Card a="b" />'
    );
  });

  it('escapes a string attribute and binds any other value', () => {
    expect(fillTemplate('<Button⟦attr label text⟧ />', { text: 'say "hi" & go' })).toBe(
      '<Button label="say &quot;hi&quot; &amp; go" />'
    );
    expect(fillTemplate('<Button⟦props⟧ />', { items: ['a', "it's"], style: { gap: 1 } })).toBe(
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
    expect(() => fillTemplate('<Button⟦props⟧ />', { 'my prop': 1 })).toThrow(UnprintableArgError);
  });
});
