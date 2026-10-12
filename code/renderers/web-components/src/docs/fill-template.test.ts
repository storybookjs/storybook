import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { html } from 'lit';
import { describe, expect, it } from 'vitest';

import { fillTemplate } from './fill-template.ts';
import { spreadHole } from './template-format.ts';

describe('fillTemplate', () => {
  describe('args spread', () => {
    const template = `<x-el ${spreadHole({
      label: 'label',
      open: 'open',
      items: '.items',
      accent: '--accent',
      slot: null,
    })}></x-el>`;

    it('writes each arg as the attribute, property or custom property it maps to', () => {
      expect(
        fillTemplate(template, { label: 'a "b"', open: true, items: [1], accent: 'red' })
      ).toBe('<x-el label="a &quot;b&quot;" open .items=${[1]} style="--accent: red;"></x-el>');
    });

    it('leaves out unset, empty, false and function args', () => {
      expect(
        fillTemplate(template, { label: '', open: false, items: undefined, onClick: () => {} })
      ).toBe('<x-el></x-el>');
    });

    it('throws for a set arg that only the static snippet can show', () => {
      expect(() => fillTemplate(template, { slot: 'Body' })).toThrow(UnprintableArgError);
    });

    it('reads back an arg whose name closes a comment', () => {
      expect(fillTemplate(`<x-el ${spreadHole({ 'a*/b': 'a' })}></x-el>`, { 'a*/b': 1 })).toBe(
        '<x-el a="1"></x-el>'
      );
    });
  });

  describe('attribute bindings', () => {
    it('fills an attribute as lit sets it', () => {
      const template = '<x-el label=${args.label}></x-el>';
      expect(fillTemplate(template, { label: 'a < b' })).toBe('<x-el label="a &lt; b"></x-el>');
      expect(fillTemplate(template, {})).toBe('<x-el label=""></x-el>');
      expect(fillTemplate('<x-el label=${ifDefined(args.label)}></x-el>', {})).toBe(
        '<x-el></x-el>'
      );
    });

    it('writes a boolean attribute bare when truthy and leaves it out otherwise', () => {
      const template = '<x-el ?open=${args.open}></x-el>';
      expect(fillTemplate(template, { open: true })).toBe('<x-el open></x-el>');
      expect(fillTemplate(template, { open: false })).toBe('<x-el></x-el>');
    });

    it('keeps property and listener bindings with the value printed', () => {
      expect(
        fillTemplate('<x-el .items=${args.items} @click=${args.onClick}></x-el>', {
          items: [1, 2],
          onClick: () => {},
        })
      ).toBe('<x-el .items=${[1, 2]} @click=${onClick}></x-el>');
    });

    it('writes a value into a quoted attribute', () => {
      expect(fillTemplate('<x-el class="btn btn-${args.size}"></x-el>', { size: 'a"b' })).toBe(
        '<x-el class="btn btn-a&quot;b"></x-el>'
      );
    });

    it('keeps a value without a literal as code', () => {
      expect(fillTemplate('<x-el label=${args.label}></x-el>', { label: { a: 1 } })).toBe(
        '<x-el label=${{ a: 1 }}></x-el>'
      );
    });
  });

  describe('text', () => {
    it('writes a primitive as escaped text, and nothing when unset', () => {
      expect(fillTemplate('<b>${args.label}</b>', { label: '<i>' })).toBe('<b>&lt;i&gt;</b>');
      expect(fillTemplate('<b>${args.label}</b>', {})).toBe('<b></b>');
    });

    it('keeps conditionals and maps as code, with the args filled in', () => {
      expect(
        fillTemplate('${args.on ? html`<b>${args.label}</b>` : nothing}', {
          on: true,
          label: 'Hi',
        })
      ).toBe('${true ? html`<b>${"Hi"}</b>` : nothing}');
      expect(
        fillTemplate('<ul>${args.items.map((item) => html`<li>${item}</li>`)}</ul>', {
          items: ['a'],
        })
      ).toBe('<ul>${["a"].map((item) => html`<li>${item}</li>`)}</ul>');
    });

    it('prints a lit template as the code that writes it', () => {
      expect(fillTemplate('${args.content}', { content: html`<b>${'Hi'}</b>` })).toBe(
        '${html`<b>${"Hi"}</b>`}'
      );
    });

    it('throws for another lit value, such as a directive', () => {
      expect(() =>
        fillTemplate('${args.content}', { content: { _$litDirective$: class {}, values: [] } })
      ).toThrow(UnprintableArgError);
    });
  });

  it('reads escaped characters as text', () => {
    expect(fillTemplate('\\${not a hole} \\\\', {})).toBe('${not a hole} \\');
  });

  it('does not read a filled value as part of the template', () => {
    expect(fillTemplate('<b>${args.a}</b>${args.b}', { a: '${args.b}', b: 'x' })).toBe(
      '<b>${args.b}</b>x'
    );
  });
});
