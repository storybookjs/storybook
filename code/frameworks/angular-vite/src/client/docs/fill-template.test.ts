import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { fillTemplate } from './fill-template.ts';

const template = 'template: `<app-button ⟦props label size data⟧ (clicked)="clicked($event)" />`,';

describe('fillTemplate', () => {
  it('binds each set input the props hole lists, a string too', () => {
    expect(fillTemplate(template, { label: 'Go', size: 2, data: { a: [true] }, other: 1 })).toBe(
      `template: \`<app-button [label]="'Go'" [size]="2" [data]="{ a: [true] }" (clicked)="clicked($event)" />\`,`
    );
  });

  it('leaves out an unset input and an action', () => {
    const spy = Object.assign(() => {}, { getMockName: () => 'spy' });
    const handler = Object.assign(() => {}, { isAction: true });
    expect(fillTemplate(template, { label: undefined, size: spy, data: handler })).toBe(
      'template: `<app-button (clicked)="clicked($event)" />`,'
    );
  });

  it('throws for any other function arg, so the static snippet shows', () => {
    expect(() => fillTemplate(template, { label: 'Go', size: (n: number) => `${n}` })).toThrow(
      UnprintableArgError
    );
    const action = Object.assign(() => {}, { isAction: true });
    expect(() => fillTemplate('  on = ⟦value on⟧;', { on: action })).toThrow(UnprintableArgError);
  });

  it('binds an arg set to undefined where the hole is led by =, as an element binds it', () => {
    expect(fillTemplate(' ⟦props = label size⟧', { label: undefined })).toBe(
      ` [label]="undefined"`
    );
    expect(fillTemplate(' ⟦props label size⟧', { label: undefined })).toBe('');
  });

  it('puts each binding on a line of its own where the hole has a line of its own', () => {
    expect(fillTemplate('<app-button\n    ⟦props label size⟧\n/>', { label: 'Go', size: 2 })).toBe(
      `<app-button\n    [label]="'Go'"\n    [size]="2"\n/>`
    );
    expect(fillTemplate('<app-button\n    ⟦props label size⟧\n/>', {})).toBe('<app-button\n/>');
  });

  it('escapes a value for the attribute and the template literal around it', () => {
    expect(fillTemplate(' ⟦props label⟧', { label: 'say "hi" & `go` ${x}' })).toBe(
      ` [label]="'say &quot;hi&quot; & \\\`go\\\` \\\${x}'"`
    );
    expect(fillTemplate(' ⟦props label⟧', { label: 'Tom &amp; Jerry' })).toBe(
      ` [label]="'Tom &amp;amp; Jerry'"`
    );
    expect(fillTemplate(' ⟦props label⟧', { label: 'a\rb\nc' })).toBe(` [label]="'a\\\\rb\\\\nc'"`);
    expect(fillTemplate(' ⟦props label⟧', { label: ["it's", '{{ x }}'] })).toBe(
      ` [label]="['it\\\\'s', '{{ x }}']"`
    );
    expect(fillTemplate(' ⟦props label⟧', { label: '{{ x }}' })).toBe(` [label]="'{{ x }}'"`);
  });

  it('prints a value hole as the literal of a host field', () => {
    expect(fillTemplate('  label = ⟦value label⟧;', { label: "it's `x`" })).toBe(
      "  label = 'it\\'s `x`';"
    );
    expect(fillTemplate('  data = ⟦value data⟧;', { data: { a: [1] } })).toBe(
      '  data = { a: [1] };'
    );
    expect(fillTemplate('  label = ⟦value label⟧;', {})).toBe('  label = undefined;');
    expect(fillTemplate('  min = ⟦value min⟧;', { min: new Date(Date.UTC(2024, 5, 1)) })).toBe(
      "  min = new Date('2024-06-01T00:00:00.000Z');"
    );
    expect(() => fillTemplate('  min = ⟦value min⟧;', { min: new Date(NaN) })).toThrow(
      UnprintableArgError
    );
    expect(() => fillTemplate('  on = ⟦value on⟧;', { on: () => {} })).toThrow(UnprintableArgError);
  });

  it("prints a value hole's default word while its arg is unset", () => {
    expect(fillTemplate("  value = ⟦value value ?''⟧;", {})).toBe("  value = '';");
    expect(fillTemplate("  tags = ⟦value tags ?%5B'A'%2C%20'B'%5D⟧;", {})).toBe(
      "  tags = ['A', 'B'];"
    );
    expect(fillTemplate("  value = ⟦value value ?''⟧;", { value: 'Go' })).toBe("  value = 'Go';");
  });

  it('throws for a value it cannot print', () => {
    expect(() => fillTemplate(' ⟦props date⟧', { date: new Date() })).toThrow(UnprintableArgError);
    expect(() => fillTemplate(' ⟦props max⟧', { max: [Infinity] })).toThrow(UnprintableArgError);
  });
});
