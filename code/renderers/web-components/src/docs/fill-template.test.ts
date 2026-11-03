import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('prints an attribute as Storybook sets it, and leaves out one that is unset or false', () => {
    const template = '<x-el ⟦attr label label⟧ ⟦attr open open⟧ ⟦attr rows rows⟧></x-el>';
    expect(fillTemplate(template, { label: 'Go "now"', open: true, rows: [1] })).toBe(
      '<x-el label="Go &quot;now&quot;" open rows="[1]"></x-el>'
    );
    expect(fillTemplate(template, { label: '', open: false })).toBe('<x-el></x-el>');
  });

  it('keeps an empty attribute a field reflects', () => {
    expect(fillTemplate('<x-el ⟦attr label label field⟧></x-el>', { label: '' })).toBe(
      '<x-el label=""></x-el>'
    );
  });

  it('prints a lit attribute binding as the text of its value', () => {
    const template = '<x-el ⟦attr label label bind⟧ ⟦attr title title defined⟧></x-el>';
    expect(fillTemplate(template, { label: true, title: 'T' })).toBe(
      '<x-el label="true" title="T"></x-el>'
    );
    expect(fillTemplate(template, {})).toBe('<x-el label=""></x-el>');
  });

  it('prints a boolean binding while its value is truthy', () => {
    expect(fillTemplate('<x-el ⟦bool disabled on⟧></x-el>', { on: 1 })).toBe(
      '<x-el disabled></x-el>'
    );
    expect(fillTemplate('<x-el ⟦bool disabled on⟧></x-el>', { on: 0 })).toBe('<x-el></x-el>');
  });

  it('drops the line of an attribute that prints nothing', () => {
    const template = '<x-el\n  ⟦attr label label⟧\n  ⟦attr open open⟧\n></x-el>';
    expect(fillTemplate(template, { label: 'Go' })).toBe('<x-el\n  label="Go"\n></x-el>');
  });

  it('prints the custom properties of the style attribute', () => {
    const template = '<x-el ⟦attr style - css --accent=accent --size=size⟧></x-el>';
    expect(fillTemplate(template, { accent: 'red', size: '' })).toBe(
      '<x-el style="--accent: red;"></x-el>'
    );
    expect(fillTemplate(template, {})).toBe('<x-el></x-el>');
  });

  it('escapes text and quoted attribute text', () => {
    expect(fillTemplate('<b title="a ⟦quoted t⟧">⟦text t⟧</b>', { t: '<"&>' })).toBe(
      '<b title="a &lt;&quot;&amp;>">&lt;"&amp;&gt;</b>'
    );
    expect(fillTemplate('<b>⟦text items⟧</b>', { items: ['a', null, 'b'] })).toBe('<b>ab</b>');
  });

  it('collapses the whitespace of text, trimmed where the snippet trims it', () => {
    expect(fillTemplate('<x-el>⟦text a ^ $⟧</x-el>', { a: '  spaced   text ' })).toBe(
      '<x-el>spaced text</x-el>'
    );
    expect(fillTemplate('<x-el>Hi ⟦text a $⟧</x-el>', { a: '  spaced   text ' })).toBe(
      '<x-el>Hi  spaced text</x-el>'
    );
  });

  it('puts named slot html in the slot, on its one element or in a span', () => {
    expect(fillTemplate('<x-el>⟦slot actions a⟧</x-el>', { a: '<button>Go</button>' })).toBe(
      '<x-el><button slot="actions">Go</button></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot actions a⟧</x-el>', { a: 'Go <b>now</b>' })).toBe(
      '<x-el><span slot="actions">Go <b>now</b></span></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot header a⟧</x-el>', { a: '<b class="x">Hi</b>' })).toBe(
      '<x-el><b class="x" slot="header">Hi</b></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot default a⟧</x-el>', { a: 'Go <b>now</b>' })).toBe(
      '<x-el>Go <b>now</b></x-el>'
    );
  });

  it('prints the style rules of part and state args, or nothing', () => {
    const template = '⟦style x-el::part(panel)=panel x-el:state(on)=on⟧<x-el></x-el>';
    expect(fillTemplate(template, { panel: 'color: red' })).toBe(
      '<style>\n  x-el::part(panel) { color: red }\n</style>\n<x-el></x-el>'
    );
    expect(fillTemplate(template, {})).toBe('<x-el></x-el>');
  });

  it('cannot print a function or a lit template', () => {
    expect(() => fillTemplate('<b>⟦text t⟧</b>', { t: () => {} })).toThrow(UnprintableArgError);
    expect(() =>
      fillTemplate('<b>⟦text t⟧</b>', { t: { ['_$litType$']: 1, strings: [] } })
    ).toThrow(UnprintableArgError);
  });
});
