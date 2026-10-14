import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { html } from 'lit';
import { fn } from 'storybook/test';

import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('sets each arg as the attribute, property or custom property its props word names', () => {
    const template =
      '<x-card ⟦props label=label is-open=isOpen .items=items --gap=--gap⟧></x-card>';
    expect(fillTemplate(template, { label: 'Hi', isOpen: true, items: [1], '--gap': '2px' })).toBe(
      '<x-card label="Hi" is-open .items=${[1]} style="--gap: 2px;"></x-card>'
    );
  });

  it('leaves out an unset or false arg, an action, and an arg no word names', () => {
    const template = '<x-card ⟦props label=label .open=open size=size .onClose=onClose⟧></x-card>';
    expect(fillTemplate(template, { label: '', size: false, onClose: fn(), other: 1 })).toBe(
      '<x-card></x-card>'
    );
  });

  it.each([
    ['a props word', '<x-card ⟦props size=size⟧></x-card>'],
    ['a property word', '<x-card ⟦props .size=size⟧></x-card>'],
    ['a boolean word', '<x-card ⟦props ?size=size⟧></x-card>'],
    ['a spread', '<x-card ⟦props !spread *⟧></x-card>'],
    ['a property', '<x-card ⟦prop size size⟧></x-card>'],
    ['a boolean attribute', '<x-card ⟦bool size size⟧></x-card>'],
    ['a slot', '<x-card>⟦slot default size⟧</x-card>'],
  ])('leaves out an action in %s, and has no snippet for any other function', (_, template) => {
    expect(fillTemplate(template, { size: fn() })).toBe(template.replace(/ ?⟦.*?⟧/, ''));
    expect(() => fillTemplate(template, { size: () => 'l' })).toThrow(UnprintableArgError);
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
    expect(() => fillTemplate(template, { label: () => 'Hi' })).toThrow(UnprintableArgError);
    expect(() => fillTemplate(template, { label: html`<b></b>` })).toThrow(UnprintableArgError);
  });

  it('leaves out every function in a toolkit spread, as the toolkit does', () => {
    expect(fillTemplate('<x-card ⟦props !toolkit *⟧></x-card>', { size: () => 'l' })).toBe(
      '<x-card></x-card>'
    );
  });

  it('sets the field of a `~` word to false or null as a property, as the render does', () => {
    const template = '<x-card ⟦props ~active=active ~label=label⟧></x-card>';
    expect(fillTemplate(template, { active: false, label: '' })).toBe(
      '<x-card .active=${false} label=""></x-card>'
    );
    expect(fillTemplate(template, { active: true, label: null })).toBe(
      '<x-card active .label=${null}></x-card>'
    );
  });

  it('writes an attribute binding as lit does, empty while its arg is unset', () => {
    const template = '<x-card ⟦attr label text⟧ ⟦attr open open⟧ ⟦attr data data⟧></x-card>';
    expect(fillTemplate(template, { open: false, data: [1, 2] })).toBe(
      '<x-card label="" open="false" data="1,2"></x-card>'
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

  it('writes the part and state styles and custom properties of a style hole', () => {
    const template =
      '⟦style x-card --gap=--gap ::part(panel)=panel-part :state(busy)=busy-state⟧<x-card></x-card>';
    expect(fillTemplate(template, {})).toBe('<x-card></x-card>');
    expect(
      fillTemplate(template, { '--gap': '2px', 'panel-part': 'color: red;', 'busy-state': ' ' })
    ).toBe(
      '<style>\n  x-card { --gap: 2px; }\n  x-card::part(panel) { color: red; }\n</style>\n<x-card></x-card>'
    );
    expect(() => fillTemplate(template, { 'panel-part': '}</style>' })).toThrow(
      UnprintableArgError
    );
  });

  it('passes every arg as `@open-wc/lit-helpers` `spread` and `spreadProps` set it', () => {
    const args = { label: 'Hi', open: true, off: false, none: null, '.items': [1], '?on': 1 };
    expect(fillTemplate('<x-card ⟦props !spread * -label⟧></x-card>', args)).toBe(
      '<x-card open="true" off="false" .items=${[1]} on></x-card>'
    );
    expect(
      fillTemplate('<x-card ⟦props !spreadProps *⟧></x-card>', { ...args, '?on': undefined })
    ).toBe(
      '<x-card .label=${"Hi"} .open=${true} .off=${false} .none=${null} ..items=${[1]}></x-card>'
    );
    expect(() => fillTemplate('<x-card ⟦props !spread *⟧></x-card>', { '--gap': '1px' })).toThrow(
      UnprintableArgError
    );
  });

  it('passes the args as `@wc-toolkit/storybook-helpers` does', () => {
    const template =
      '<x-card ⟦props !toolkit * -label -open -items label=label ?open=open .items=items⟧></x-card>';
    expect(
      fillTemplate(template, { label: '', open: 'false', items: [1], extra: 2, onClick: 'x' })
    ).toBe('<x-card label="" .items=${[1]} extra="2"></x-card>');
  });

  it('sets a property to whatever its arg holds, false and null too', () => {
    const template = '<x-card ⟦prop open open⟧ ⟦prop data data⟧></x-card>';
    expect(fillTemplate(template, { open: false, data: null })).toBe(
      '<x-card .open=${false} .data=${null}></x-card>'
    );
  });

  it('escapes attribute values and text', () => {
    expect(fillTemplate('<p ⟦attr title t⟧>⟦text t⟧</p>', { t: 'a "b" & <c>' })).toBe(
      '<p title="a &quot;b&quot; &amp; &lt;c>">a "b" &amp; &lt;c&gt;</p>'
    );
    expect(fillTemplate('<p ⟦attr data d⟧></p>', { d: { a: 1 } })).toBe(
      '<p data="[object Object]"></p>'
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
      '<p ⟦attr title t ?title%3D%22Place%20Dog%22⟧ ⟦bool hidden h ?hidden⟧ ⟦prop data d ?.data%3D%24%7Brows%7D⟧>⟦text t ?%24%7Bname%7D⟧ ${⟦value n ?(a%20%2B%20b)⟧}</p>';
    expect(fillTemplate(template, {})).toBe(
      '<p title="Place Dog" hidden .data=${rows}>${name} ${(a + b)}</p>'
    );
    expect(fillTemplate(template, { t: 'Hi', h: false, d: null, n: 0 })).toBe(
      '<p title="Hi" .data=${null}>Hi ${0}</p>'
    );
  });

  it('prints a slot arg as html, and as text in a span for a named slot', () => {
    const template = '<x-card>\n  ⟦slot default body⟧\n  ⟦slot title title⟧\n</x-card>';
    expect(fillTemplate(template, { body: '<b>`${a}`</b>', title: 'Hi' })).toBe(
      '<x-card>\n  <b>\\`\\${a}\\`</b>\n  <span slot="title">Hi</span>\n</x-card>'
    );
    expect(fillTemplate(template, { body: '', title: false })).toBe('<x-card>\n</x-card>');
    expect(() => fillTemplate(template, { title: '<h3 slot="title">Hi</h3>' })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate(template, { body: { a: 1 } })).toThrow(UnprintableArgError);
  });

  it('throws for a set arg whose `^` word says the element writes it too', () => {
    const template = '<x-card ⟦props size=size ^label⟧ label="Written"></x-card>';
    expect(fillTemplate(template, { size: 'm' })).toBe(
      '<x-card size="m" label="Written"></x-card>'
    );
    expect(() => fillTemplate(template, { label: 'Set' })).toThrow(UnprintableArgError);
  });

  it('throws for a value it cannot print', () => {
    expect(() => fillTemplate('${⟦value onClick⟧}', { onClick: () => {} })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p>⟦text icon⟧</p>', { icon: html`<b></b>` })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p ⟦props .icon=icon⟧></p>', { icon: html`<b></b>` })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('${⟦value icons⟧}', { icons: [html`<b></b>`] })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('<p ⟦props --gap=gap⟧></p>', { gap: 'red; color: blue' })).toThrow(
      UnprintableArgError
    );
  });
});
