import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { fillTemplate } from './fill-template.ts';

const template = 'template: `<app-button⟦props label size data⟧ (clicked)="clicked($event)" />`,';

describe('fillTemplate', () => {
  it('binds each set input the props hole lists, a string as a plain attribute', () => {
    expect(fillTemplate(template, { label: 'Go', size: 2, data: { a: [true] }, other: 1 })).toBe(
      'template: `<app-button label="Go" [size]="2" [data]="{ a: [true] }" (clicked)="clicked($event)" />`,'
    );
  });

  it('leaves out an unset input and a function arg', () => {
    expect(fillTemplate(template, { label: undefined, size: () => {} })).toBe(
      'template: `<app-button (clicked)="clicked($event)" />`,'
    );
  });

  it('escapes a value for the attribute and the template literal around it', () => {
    expect(fillTemplate('⟦props label⟧', { label: 'say "hi" & `go` ${x}' })).toBe(
      ' label="say &quot;hi&quot; &amp; \\`go\\` \\${x}"'
    );
    expect(fillTemplate('⟦props label⟧', { label: ["it's", '{{ x }}'] })).toBe(
      ` [label]="['it\\\\'s', '{{ x }}']"`
    );
    expect(fillTemplate('⟦props label⟧', { label: '{{ x }}' })).toBe(` [label]="'{{ x }}'"`);
  });

  it('throws for a value it cannot print', () => {
    expect(() => fillTemplate('⟦props date⟧', { date: new Date() })).toThrow(UnprintableArgError);
    expect(() => fillTemplate('⟦props max⟧', { max: [Infinity] })).toThrow(UnprintableArgError);
  });
});
