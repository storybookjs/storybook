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
    const template = '<x-card ⟦props label=label .open=open size=size⟧></x-card>';
    expect(fillTemplate(template, { label: '', open: false, size: () => {}, other: 1 })).toBe(
      '<x-card></x-card>'
    );
    expect(fillTemplate('<x-card ⟦attr label text⟧></x-card>', {})).toBe('<x-card></x-card>');
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
