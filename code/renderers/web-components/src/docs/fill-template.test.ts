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

  it('prints a property as lit sets it, `undefined` too, but for its `?` word while unset', () => {
    const template = '<x-card ⟦prop open open⟧ ⟦prop data data ?⟧></x-card>';
    expect(fillTemplate(template, { open: false, data: null })).toBe(
      '<x-card .open=${false} .data=${null}></x-card>'
    );
    expect(fillTemplate(template, {})).toBe('<x-card .open=${undefined}></x-card>');
  });

  it('has no snippet for a function that is no code the story writes, an action too', () => {
    for (const template of [
      '<x-card ⟦prop size size⟧></x-card>',
      '<x-card ⟦bool size size⟧></x-card>',
      '<x-card ⟦attr size size⟧></x-card>',
      '<p>${⟦value size⟧}</p>',
    ]) {
      expect(() => fillTemplate(template, { size: fn() })).toThrow(UnprintableArgError);
      expect(() => fillTemplate(template, { size: () => 'l' })).toThrow(UnprintableArgError);
    }
  });

  it('writes the args as an object without the names its words leave out, and actions', () => {
    const template = '<p ${spread(⟦args -count⟧)}></p>';
    expect(
      fillTemplate(template, {
        label: 'Hi',
        'is-open': true,
        count: 2,
        onClick: fn(),
        x: undefined,
      })
    ).toBe('<p ${spread({ label: "Hi", "is-open": true })}></p>');
    expect(fillTemplate(template, { icon: writtenArg('ICON') })).toBe(
      '<p ${spread({ icon: ICON })}></p>'
    );
    expect(() => fillTemplate(template, { label: () => 'Hi' })).toThrow(UnprintableArgError);
    expect(() => fillTemplate(template, { label: html`<b></b>` })).toThrow(UnprintableArgError);
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
    expect(fillTemplate("<p title=\"⟦quoted t⟧!\" lang='⟦quoted t '⟧'>", { t: `"a'&` })).toBe(
      `<p title="&quot;a'&amp;!" lang='"a&#39;&amp;'>`
    );
    expect(fillTemplate('<p title="⟦quoted t⟧!">', {})).toBe('<p title="!">');
  });

  it('writes the text of a style or script as it is, but for its end tag', () => {
    expect(fillTemplate('<style>⟦raw css⟧</style>', { css: 'a > b { content: "&" }' })).toBe(
      '<style>a > b { content: "&" }</style>'
    );
    expect(() => fillTemplate('<style>⟦raw css⟧</style>', { css: '</style><b>' })).toThrow(
      UnprintableArgError
    );
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
      ['<style>⟦raw t⟧</style>', `<style>${escaped}</style>`],
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

  it('prints a boolean attribute only while its arg is truthy', () => {
    expect(fillTemplate('<button ⟦bool disabled off⟧>', { off: true })).toBe('<button disabled>');
    expect(fillTemplate('<button ⟦bool disabled off⟧>', { off: false })).toBe('<button>');
  });

  it('prints a value hole as a literal in the code around it', () => {
    expect(fillTemplate('.items=${⟦value items⟧}', { items: ['a'] })).toBe('.items=${["a"]}');
    expect(fillTemplate('${⟦value on⟧ ? a : b}', { on: true })).toBe('${true ? a : b}');
  });

  it('prints the `?` word of a hole while its arg is undefined', () => {
    const template =
      "<p title=\"⟦quoted t ?Place%20Dog⟧\" lang='⟦quoted t ' ?en⟧' ⟦bool hidden h ?hidden⟧ ⟦prop data d ?.data%3D%24%7Brows%7D⟧>⟦text t ?%24%7Bname%7D⟧ ${⟦value n ?(a%20%2B%20b)⟧}</p>";
    expect(fillTemplate(template, {})).toBe(
      '<p title="Place Dog" lang=\'en\' hidden .data=${rows}>${name} ${(a + b)}</p>'
    );
    expect(fillTemplate(template, { t: 'Hi', h: false, d: null, n: 0 })).toBe(
      '<p title="Hi" lang=\'Hi\' .data=${null}>Hi ${0}</p>'
    );
  });

  it('prints a slot arg as html, in a span for a named slot', () => {
    const template = '<x-card>\n  ⟦slot default body⟧\n  ⟦slot title title⟧\n</x-card>';
    expect(fillTemplate(template, { body: '<b>`${a}`</b>', title: 'Hi' })).toBe(
      '<x-card>\n  <b>\\`\\${a}\\`</b>\n  <span slot="title">Hi</span>\n</x-card>'
    );
    expect(fillTemplate(template, { body: '', title: null })).toBe('<x-card>\n</x-card>');
    expect(fillTemplate(template, { title: '<b>Hi</b> there' })).toBe(
      '<x-card>\n  <span slot="title"><b>Hi</b> there</span>\n</x-card>'
    );
    expect(() => fillTemplate(template, { body: { a: 1 } })).toThrow(UnprintableArgError);
  });

  it('throws for a value it cannot print', () => {
    expect(() => fillTemplate('${⟦value onClick⟧}', { onClick: () => {} })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p>⟦text icon⟧</p>', { icon: html`<b></b>` })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p ⟦prop icon icon⟧></p>', { icon: html`<b></b>` })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('${⟦value icons⟧}', { icons: [html`<b></b>`] })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p⟦css --gap=gap⟧></p>', { gap: 'red; color: blue' })).toThrow(
      UnprintableArgError
    );
  });
});
