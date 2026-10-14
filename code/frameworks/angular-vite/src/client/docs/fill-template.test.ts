import { describe, expect, it } from 'vitest';

import { UnprintableArgError, writtenArg } from 'storybook/internal/docs-tools';

import { fillTemplate } from './fill-template.ts';

const template = 'template: `<app-button ⟦props label size data⟧ (clicked)="clicked($event)" />`,';

describe('fillTemplate', () => {
  it('binds each set input the props hole lists, a string too', () => {
    expect(fillTemplate(template, { label: 'Go', size: 2, data: { a: [true] }, other: 1 })).toBe(
      `template: \`<app-button [label]="'Go'" [size]="2" [data]="{ a: [true] }" (clicked)="clicked($event)" />\`,`
    );
  });

  it('leaves out an unset input', () => {
    expect(fillTemplate(template, { label: undefined })).toBe(
      'template: `<app-button (clicked)="clicked($event)" />`,'
    );
  });

  it('prints a written arg as its code, in a binding and in a host field', () => {
    const control = writtenArg(`new FormControl("x")`);
    expect(fillTemplate(' ⟦props label⟧', { label: control })).toBe(
      ` [label]="new FormControl(&quot;x&quot;)"`
    );
    expect(
      fillTemplate('  select = ⟦value select⟧;', { select: writtenArg('fn((o) => o.name)') })
    ).toBe('  select = fn((o) => o.name);');
  });

  it('continues code over several lines at the indentation of its line', () => {
    const data = writtenArg('{\n  a: 1,\n}');
    expect(fillTemplate('  data = ⟦value data⟧;', { data })).toBe('  data = {\n    a: 1,\n  };');
    expect(fillTemplate('<a\n    ⟦props data⟧\n/>', { data })).toBe(
      '<a\n    [data]="{\n      a: 1,\n    }"\n/>'
    );
    const text = writtenArg('`a\nb`');
    expect(fillTemplate('  text = ⟦value text⟧;', { text })).toBe('  text = `a\nb`;');
  });

  it('throws for a function arg, so the static snippet shows', () => {
    expect(() => fillTemplate(template, { label: 'Go', size: (n: number) => `${n}` })).toThrow(
      UnprintableArgError
    );
    const action = Object.assign(() => {}, { isAction: true });
    expect(() => fillTemplate(template, { size: action })).toThrow(UnprintableArgError);
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
