import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { html } from 'lit';

import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('sets each arg as the attribute, property or custom property its props word names', () => {
    const template =
      '<x-card ⟦props label=label is-open=isOpen .items=items --gap=--gap⟧></x-card>';
    expect(fillTemplate(template, { label: 'Hi', isOpen: true, items: [1], '--gap': '2px' })).toBe(
      '<x-card label="Hi" is-open .items=${[1]} style="--gap: 2px;"></x-card>'
    );
  });

  it('leaves out an unset, false or function arg, and an arg no word names', () => {
    const template = '<x-card ⟦props label=label .open=open size=size .onClose=onClose⟧></x-card>';
    expect(fillTemplate(template, { label: '', size: false, onClose: () => {}, other: 1 })).toBe(
      '<x-card></x-card>'
    );
    expect(fillTemplate('<x-card ⟦attr label text⟧></x-card>', {})).toBe('<x-card></x-card>');
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
      '<p data="{&quot;a&quot;:1}"></p>'
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
