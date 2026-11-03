import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import {
  boundText,
  childText,
  cssDeclarations,
  escapeAttribute,
  escapeText,
  inlineText,
  printAttribute,
  quotedAttribute,
  slotText,
  slottedHtml,
  styleText,
} from '../snippet-values.ts';
import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('prints an attribute as Storybook sets it, and leaves out one that is unset or false', () => {
    const template =
      '<x-el⟦attr label label ~%20⟧⟦attr open open ~%20⟧⟦attr rows rows ~%20⟧></x-el>';
    expect(fillTemplate(template, { label: 'Go "now"', open: true, rows: [1] })).toBe(
      '<x-el label="Go &quot;now&quot;" open rows="[1]"></x-el>'
    );
    expect(fillTemplate(template, { label: '', open: false })).toBe('<x-el></x-el>');
  });

  it('keeps an empty attribute a field reflects', () => {
    expect(fillTemplate('<x-el⟦attr label label field ~%20⟧></x-el>', { label: '' })).toBe(
      '<x-el label=""></x-el>'
    );
  });

  it('prints a lit attribute binding as the text of its value', () => {
    const template = '<x-el⟦attr label label bind ~%20⟧⟦attr title title defined ~%20⟧></x-el>';
    expect(fillTemplate(template, { label: true, title: 'T' })).toBe(
      '<x-el label="true" title="T"></x-el>'
    );
    expect(fillTemplate(template, {})).toBe('<x-el label=""></x-el>');
  });

  it('prints a boolean binding while its value is truthy', () => {
    expect(fillTemplate('<x-el⟦bool disabled on ~%20⟧></x-el>', { on: 1 })).toBe(
      '<x-el disabled></x-el>'
    );
    expect(fillTemplate('<x-el⟦bool disabled on ~%20⟧></x-el>', { on: 0 })).toBe('<x-el></x-el>');
  });

  it('prints the custom properties of the style attribute', () => {
    const template = '<x-el⟦attr style - css --accent=accent --size=size ~%20⟧></x-el>';
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

  it('prints an array in a quoted attribute value as its text, as the static snippet does', () => {
    expect(fillTemplate('<b title="⟦quoted t⟧"></b>', { t: ['a', 'b'] })).toBe(
      '<b title="a,b"></b>'
    );
  });

  it('collapses the whitespace of text, trimmed where the snippet trims it', () => {
    expect(fillTemplate('<x-el>⟦text a ^ $⟧</x-el>', { a: '  spaced   text ' })).toBe(
      '<x-el>spaced text</x-el>'
    );
    expect(fillTemplate('<x-el>Hi ⟦text a $⟧</x-el>', { a: '  spaced   text ' })).toBe(
      '<x-el>Hi  spaced text</x-el>'
    );
  });

  it('prints the html of a string template as it is', () => {
    expect(fillTemplate('<x-el>⟦html a⟧</x-el>', { a: ['<b>', 'x', '</b>'] })).toBe(
      '<x-el><b>x</b></x-el>'
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
    expect(fillTemplate('<x-el>⟦slot icon a⟧</x-el>', { a: '<img src="a.png">' })).toBe(
      '<x-el><img src="a.png" slot="icon"></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot box a⟧</x-el>', { a: '<div><div>x</div></div>' })).toBe(
      '<x-el><div slot="box"><div>x</div></div></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot default a⟧</x-el>', { a: 'Go <b>now</b>' })).toBe(
      '<x-el>Go <b>now</b></x-el>'
    );
    expect(fillTemplate('<x-el>⟦slot actions a⟧</x-el>', { a: '' })).toBe('<x-el></x-el>');
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

describe('a changed arg', () => {
  const values: unknown[] = [
    'Go',
    'say "hi" & <wave>',
    "it's",
    '  runs   of\n\twhitespace  ',
    'line\nbreak',
    '{x}',
    '',
    0,
    -1,
    1e3,
    1.5,
    true,
    false,
    null,
    undefined,
    [],
    ['a', null, 'b'],
    [1, [2]],
    {},
    { a: 1, b: 'x"y' },
    '<button>Go</button>',
    '<b>a</b><b>b</b>',
    '<img src="a.png">',
    'text <b>and</b> html',
  ];
  const unprintable: unknown[] = [() => {}, Symbol('s'), { ['_$litType$']: 1, strings: [] }];

  // What the shared printers print for each kind of hole, as the static snippet prints a value
  // there.
  const shared: Record<string, (value: unknown) => string> = {
    '⟦attr label v⟧': (value) => printAttribute('label', value) ?? '',
    '⟦attr label v field⟧': (value) => printAttribute('label', value, true) ?? '',
    '⟦attr label v bind⟧': (value) => quotedAttribute('label', boundText(value)),
    '⟦attr label v defined⟧': (value) =>
      value === null || value === undefined ? '' : quotedAttribute('label', boundText(value)),
    '⟦attr style - css --accent=v⟧': (value) => {
      const style = cssDeclarations([{ name: '--accent', value }]);
      return style === undefined ? '' : quotedAttribute('style', style);
    },
    '⟦bool disabled v⟧': (value) => (value ? 'disabled' : ''),
    '⟦quoted v⟧': (value) => escapeAttribute(boundText(value)),
    '⟦text v ^ $⟧': (value) => escapeText(inlineText(childText(value), true, true)),
    '⟦html v⟧': (value) => childText(value),
    '⟦slot actions v⟧': (value) => slottedHtml('actions', slotText(value)),
    '⟦style x-el::part(p)=v⟧': (value) =>
      value === undefined
        ? ''
        : `<style>${styleText([{ selector: 'x-el::part(p)', declarations: String(value) }])}</style>\n`,
  };

  it.each(Object.keys(shared))('prints in %s what the shared printer prints', (hole) => {
    for (const value of values) {
      expect(fillTemplate(hole, { v: value }), String(value)).toBe(shared[hole]!(value));
    }
  });

  it.each(Object.keys(shared))('cannot print a function or lit value in %s', (hole) => {
    for (const value of unprintable) {
      expect(() => fillTemplate(hole, { v: value })).toThrow(new UnprintableArgError('v'));
    }
  });
});
