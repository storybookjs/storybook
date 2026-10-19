import { describe, expect, it } from 'vitest';

import { UnprintableArgError, writtenArg } from 'storybook/internal/docs-tools';

import { html } from 'lit';
import { fn } from 'storybook/test';

import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it("prints an attribute as Storybook's render sets it, and the code of one that is no text", () => {
    const template = '<x-card ⟦attr label l⟧ ⟦attr is-open o⟧ ⟦attr size s⟧></x-card>';
    expect(fillTemplate(template, { l: 'Hi', o: true, s: 2 })).toBe(
      '<x-card label="Hi" is-open size="2"></x-card>'
    );
    expect(fillTemplate(template, { l: '', o: false, s: null })).toBe('<x-card></x-card>');
    expect(fillTemplate(template, { l: writtenArg('LABEL') })).toBe(
      '<x-card label=${LABEL}></x-card>'
    );
  });

  it('has no snippet for a function that is no code the story writes, an action too', () => {
    for (const template of [
      '<x-card ⟦bool size size⟧></x-card>',
      '<x-card ⟦attr size size⟧></x-card>',
      '<p>⟦text size⟧</p>',
    ]) {
      expect(() => fillTemplate(template, { size: fn() })).toThrow(UnprintableArgError);
      expect(() => fillTemplate(template, { size: () => 'l' })).toThrow(UnprintableArgError);
    }
  });

  it('writes an attribute value as lit does, empty while its arg is unset', () => {
    const template =
      '<x-card label="⟦quoted text⟧" open="⟦quoted open⟧" data="⟦quoted data⟧"></x-card>';
    expect(fillTemplate(template, { open: false, data: [1, 2] })).toBe(
      '<x-card label="" open="false" data="${[1, 2]}"></x-card>'
    );
    expect(() => fillTemplate(template, { text: () => {} })).toThrow(UnprintableArgError);
  });

  it('writes an arg inside a larger attribute value as text in its quotes', () => {
    expect(fillTemplate('<p title="⟦quoted t⟧!">', { t: `"a'&` })).toBe(
      `<p title="&quot;a'&amp;!">`
    );
    expect(fillTemplate('<p title="⟦quoted t⟧!">', {})).toBe('<p title="!">');
  });

  it('writes the part and state styles of a style hole', () => {
    const template =
      '⟦style x-card ::part(panel)=panel-part :state(busy)=busy-state⟧<x-card></x-card>';
    expect(fillTemplate(template, {})).toBe('<x-card></x-card>');
    expect(fillTemplate(template, { 'panel-part': 'color: red;', 'busy-state': '' })).toBe(
      '<style>\n  x-card::part(panel) { color: red; }\n</style>\n<x-card></x-card>'
    );
    expect(() => fillTemplate(template, { 'panel-part': '}</style>' })).toThrow(
      UnprintableArgError
    );
  });

  it('escapes attribute values and text', () => {
    expect(fillTemplate('<p title="⟦quoted t⟧">⟦text t⟧</p>', { t: 'a "b" & <c>' })).toBe(
      '<p title="a &quot;b&quot; &amp; &lt;c>">a "b" &amp; &lt;c&gt;</p>'
    );
  });

  it('binds a value that is no text, such as the code the story writes an arg with', () => {
    const template = '<p title="⟦quoted t⟧" ⟦bool hidden h⟧>⟦text t⟧</p>';
    expect(fillTemplate(template, { t: writtenArg('LABEL'), h: writtenArg('HIDDEN') })).toBe(
      '<p title="${LABEL}" ?hidden=${HIDDEN}>${LABEL}</p>'
    );
  });

  it('escapes the text of every hole for the lit template literal it is in', () => {
    const value = 'C:\\temp `a` ${b}';
    const escaped = 'C:\\\\temp \\`a\\` \\${b}';
    for (const [template, expected] of [
      ['<p ⟦attr title t⟧>', `<p title="${escaped}">`],
      ['<p title="⟦quoted t⟧">', `<p title="${escaped}">`],
      ['<p>⟦text t⟧</p>', `<p>${escaped}</p>`],
      ['<p>⟦slot default t⟧</p>', `<p>${escaped}</p>`],
      ['<p>⟦slot title t⟧</p>', `<p><span slot="title">${escaped}</span></p>`],
    ]) {
      expect(fillTemplate(template!, { t: value })).toBe(expected);
    }
    expect(fillTemplate('<p⟦css --gap=t⟧>', { t: '`a` \\b' })).toBe(
      '<p style="--gap: \\`a\\` \\\\b;">'
    );
    expect(fillTemplate('⟦style p ::part(x)=t⟧<p>', { t: '`a`' })).toBe(
      '<style>\n  p::part(x) { \\`a\\` }\n</style>\n<p>'
    );
  });

  it("prints an attribute lit's `ifDefined` sets while its arg is neither `null` nor `undefined`", () => {
    const template = '<p ⟦attr title t defined⟧></p>';
    expect(fillTemplate(template, { t: '' })).toBe('<p title=""></p>');
    expect(fillTemplate(template, { t: false })).toBe('<p title="false"></p>');
    expect(fillTemplate(template, { t: null })).toBe('<p></p>');
    expect(fillTemplate(template, {})).toBe('<p></p>');
    expect(fillTemplate(template, { t: writtenArg('TITLE') })).toBe('<p title=${TITLE}></p>');
  });

  it('writes the code of a css or style arg as a binding, as any other hole does', () => {
    expect(fillTemplate('<p⟦css --gap=gap⟧></p>', { gap: writtenArg('GAP') })).toBe(
      '<p style="--gap: ${GAP};"></p>'
    );
    expect(fillTemplate('⟦style p ::part(x)=x⟧<p></p>', { x: writtenArg('CSS') })).toBe(
      '<style>\n  p::part(x) { ${CSS} }\n</style>\n<p></p>'
    );
  });

  it('writes a start tag with a hole on one line while it fits in 80 columns', () => {
    const template =
      '<div>\n  <x-card ⟦attr label l⟧ variant="primary" ⟦bool open o⟧⟦css --gap=g⟧>\n  </x-card>\n</div>';
    expect(fillTemplate(template, { l: 'Hi', o: true })).toBe(
      '<div>\n  <x-card label="Hi" variant="primary" open>\n  </x-card>\n</div>'
    );
    expect(fillTemplate(template, { l: 'A label that is long enough to wrap', g: '1px' })).toBe(
      [
        '<div>',
        '  <x-card',
        '    label="A label that is long enough to wrap"',
        '    variant="primary"',
        '    style="--gap: 1px;"',
        '  >',
        '  </x-card>',
        '</div>',
      ].join('\n')
    );
    expect(
      fillTemplate('<x-card\n  ⟦attr label l⟧\n  ⟦bool open o⟧\n></x-card>', { l: 'Hi' })
    ).toBe('<x-card label="Hi"></x-card>');
  });

  it('prints a boolean attribute only while its arg is truthy', () => {
    expect(fillTemplate('<button ⟦bool disabled off⟧>', { off: true })).toBe('<button disabled>');
    expect(fillTemplate('<button ⟦bool disabled off⟧>', { off: false })).toBe('<button>');
  });

  it('prints a slot arg as html, in a span for a named slot, and the code of one that is no text', () => {
    const template = '<x-card>\n  ⟦slot default body⟧\n  ⟦slot title title⟧\n</x-card>';
    expect(fillTemplate(template, { body: '<b>`${a}`</b>', title: 'Hi' })).toBe(
      '<x-card>\n  <b>\\`\\${a}\\`</b>\n  <span slot="title">Hi</span>\n</x-card>'
    );
    expect(fillTemplate(template, { body: '', title: null })).toBe('<x-card>\n</x-card>');
    expect(fillTemplate(template, { title: '<b>Hi</b> there' })).toBe(
      '<x-card>\n  <span slot="title"><b>Hi</b> there</span>\n</x-card>'
    );
    expect(fillTemplate(template, { body: writtenArg('html`<img>`'), title: { a: 1 } })).toBe(
      '<x-card>\n  ${html`<img>`}\n  <span slot="title">${{ a: 1 }}</span>\n</x-card>'
    );
  });

  it('throws for a value it cannot print', () => {
    expect(() => fillTemplate('<p>⟦text icon⟧</p>', { icon: html`<b></b>` })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p ⟦attr icons icons⟧></p>', { icons: [html`<b></b>`] })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p⟦css --gap=gap⟧></p>', { gap: 'red; color: blue' })).toThrow(
      UnprintableArgError
    );
  });
});
