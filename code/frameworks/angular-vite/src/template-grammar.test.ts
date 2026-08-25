import { describe, expect, it } from 'vitest';

import type { BuildTemplateInput } from './template-grammar.ts';
import {
  buildComponentOutletTemplate,
  buildTemplate,
  formatInputValue,
  formatTemplateMarkup,
} from './template-grammar.ts';

describe('formatInputValue', () => {
  it('renders primitives as their literal text and strings single-quoted', () => {
    expect(formatInputValue(7)).toBe('7');
    expect(formatInputValue(true)).toBe('true');
    expect(formatInputValue(null)).toBe('null');
    expect(formatInputValue(undefined)).toBe('undefined');
    expect(formatInputValue('Save')).toBe("'Save'");
  });

  it('renders objects and arrays with unquoted identifier keys and spaced separators', () => {
    expect(formatInputValue({ id: 7, tags: ['a', 'b'], nested: { deep: true } })).toBe(
      "{id: 7, tags: ['a', 'b'], nested: {deep: true}}"
    );
  });

  it('quotes a key that is not an identifier', () => {
    expect(formatInputValue({ 'data-id': 1 })).toBe("{'data-id': 1}");
  });

  it('keeps a comma inside a string value intact', () => {
    expect(formatInputValue({ hello: '1,2' })).toBe("{hello: '1,2'}");
  });

  it('preserves typographic quotes instead of collapsing them into escapes', () => {
    expect(formatInputValue({ text: 'it’s “great”' })).toBe("{text: 'it’s “great”'}");
  });

  it('escapes the quoting it introduces and entity-encodes the attribute delimiter', () => {
    expect(formatInputValue("it's")).toBe("'it\\'s'");
    expect(formatInputValue('say "hi"')).toBe("'say &quot;hi&quot;'");
    expect(formatInputValue({ path: 'a\\b' })).toBe("{path: 'a\\\\b'}");
    expect(formatInputValue('line\nbreak')).toBe("'line\\nbreak'");
  });

  it('caps a circular reference instead of recursing forever', () => {
    const value: Record<string, unknown> = { name: 'loop' };
    value.self = value;
    expect(formatInputValue(value)).toBe("{name: 'loop', self: '[Circular]'}");
  });
});

describe('buildTemplate', () => {
  const short: BuildTemplateInput = { inputs: [{ name: 'label', expression: "'x'" }], outputs: [] };
  const long: BuildTemplateInput = {
    inputs: [{ name: 'label', expression: "'a label long enough to push the tag past the limit'" }],
    outputs: ['clicked'],
  };

  it('keeps the closing tag when the caller does not opt in', () => {
    expect(buildTemplate('sb-button', short)).toBe(`<sb-button [label]="'x'"></sb-button>`);
  });

  it('self-closes a dashed element that fits on one line', () => {
    expect(buildTemplate('sb-button', { ...short, selfClosing: true })).toBe(
      `<sb-button [label]="'x'" />`
    );
  });

  it('puts the bracket on its own line when the tag breaks over lines', () => {
    expect(buildTemplate('sb-shape-button', { ...long, selfClosing: true })).toBe(
      [
        '<sb-shape-button',
        `    [label]="'a label long enough to push the tag past the limit'"`,
        '    (clicked)="clicked($event)"',
        '/>',
      ].join('\n')
    );
  });

  it('keeps the closing tag for a selector naming an element with an attribute', () => {
    expect(buildTemplate('button[sb-button]', { ...short, selfClosing: true })).toBe(
      `<button sb-button [label]="'x'"></button>`
    );
  });

  it('keeps the closing tag for a selector that names no element', () => {
    expect(buildTemplate('.card', { ...short, selfClosing: true })).toBe(
      `<div class="card" [label]="'x'"></div>`
    );
  });

  it('keeps a void element inline when it fits on one line', () => {
    expect(buildTemplate('input[appInput]', { ...short, selfClosing: true })).toBe(
      `<input appInput [label]="'x'" />`
    );
  });

  it('moves the bracket of a broken void element onto its own line only under the opt-in', () => {
    expect(buildTemplate('input[appInput]', { ...long, selfClosing: true })).toBe(
      [
        '<input appInput',
        `    [label]="'a label long enough to push the tag past the limit'"`,
        '    (clicked)="clicked($event)"',
        '/>',
      ].join('\n')
    );
    expect(buildTemplate('input[appInput]', long)).toBe(
      [
        '<input appInput',
        `    [label]="'a label long enough to push the tag past the limit'"`,
        '    (clicked)="clicked($event)" />',
      ].join('\n')
    );
  });

  it('keeps the closing tag when the element carries inner content', () => {
    expect(buildTemplate('sb-button', { ...short, innerTemplate: 'hi', selfClosing: true })).toBe(
      `<sb-button [label]="'x'">hi</sb-button>`
    );
  });
});

describe('buildComponentOutletTemplate', () => {
  it('keeps the closing tag when the caller does not opt in', () => {
    expect(buildComponentOutletTemplate('ButtonComponent')).toBe(
      '<ng-container *ngComponentOutlet="ButtonComponent"></ng-container>'
    );
  });

  it('self-closes the outlet under the opt-in', () => {
    expect(buildComponentOutletTemplate('ButtonComponent', { selfClosing: true })).toBe(
      '<ng-container *ngComponentOutlet="ButtonComponent" />'
    );
  });
});

describe('formatTemplateMarkup', () => {
  it('moves nested elements onto their own lines', () => {
    expect(formatTemplateMarkup('<div class="bound"><sb-button></sb-button></div>')).toBe(
      ['<div class="bound">', '    <sb-button></sb-button>', '</div>'].join('\n')
    );
  });

  it('keeps a short element with only text content as written', () => {
    expect(formatTemplateMarkup('<sb-button emphasis>hi</sb-button>')).toBe(
      '<sb-button emphasis>hi</sb-button>'
    );
  });

  it('breaks an over-long attribute run one binding per line, like the generated templates', () => {
    expect(
      formatTemplateMarkup(
        `<div class="wrap"><sb-button [label]="'Save'" [count]="7" [kind]="'primary'" (clicked)="clicked($event)"></sb-button></div>`
      )
    ).toBe(
      [
        '<div class="wrap">',
        '    <sb-button',
        `        [label]="'Save'"`,
        '        [count]="7"',
        `        [kind]="'primary'"`,
        '        (clicked)="clicked($event)">',
        '    </sb-button>',
        '</div>',
      ].join('\n')
    );
  });

  it('keeps a self-closing child on its own line', () => {
    expect(formatTemplateMarkup('<div><sb-icon name="x" /></div>')).toBe(
      ['<div>', '    <sb-icon name="x" />', '</div>'].join('\n')
    );
  });

  it('places sibling text and elements on their own lines', () => {
    expect(formatTemplateMarkup('<sb-button [label]="\'Save\'"><span>Bye</span></sb-button>')).toBe(
      [`<sb-button [label]="'Save'">`, '    <span>Bye</span>', '</sb-button>'].join('\n')
    );
  });

  it('returns markup it cannot follow exactly as written', () => {
    expect(formatTemplateMarkup('<div><span></div>')).toBe('<div><span></div>');
    expect(formatTemplateMarkup('plain interpolated {{ text }}')).toBe(
      'plain interpolated {{ text }}'
    );
  });
});
