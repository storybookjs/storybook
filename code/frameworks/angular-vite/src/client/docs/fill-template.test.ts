import { describe, expect, it } from 'vitest';

import { UnprintableArgError, writtenArg } from 'storybook/internal/docs-tools';

import { fillTemplate } from './fill-template.ts';

describe('fillTemplate', () => {
  it('prints a value into a binding as the build prints the story args, for the template literal', () => {
    expect(
      fillTemplate('<x [label]="⟦bind label⟧" [config]="⟦bind config⟧" />', {
        label: `it's "q"`,
        config: { a: [1, 'b'], 'c-d': null, e: undefined },
      })
    ).toBe(
      String.raw`<x [label]="'it\\'s &quot;q&quot;'" [config]="{a: [1, 'b'], 'c-d': null}" />`
    );
  });

  it('prints an arg the story writes as code as that code', () => {
    expect(
      fillTemplate('<x [onClick]="⟦bind onClick⟧" />', { onClick: writtenArg('() => go("x")') })
    ).toBe('<x [onClick]="() => go(&quot;x&quot;)" />');
  });

  it('leaves out an argsToTemplate binding for an unset arg, with the space before it', () => {
    const template = '<x a="1" ⟦prop label⟧ ⟦prop size⟧></x>';
    expect(fillTemplate(template, { label: 'Go' })).toBe(`<x a="1" [label]="'Go'"></x>`);
    expect(fillTemplate(template, { label: undefined, size: 2 })).toBe('<x a="1" [size]="2"></x>');
  });

  it('prints a field as code, indenting the lines after the first', () => {
    expect(fillTemplate('  items = ⟦field items +2⟧;', { items: writtenArg('[\n  1,\n]') })).toBe(
      '  items = [\n    1,\n  ];'
    );
  });

  it('prints text as it reads in markup, escaping what Angular reads as its own syntax', () => {
    expect(fillTemplate('<b>⟦text label⟧</b>', { label: 'a {b} @c `d`' })).toBe(
      "<b>a {{ '{' }}b{{ '}' }} &#64;c \\`d\\`</b>"
    );
    expect(fillTemplate('<b>⟦text count⟧</b>', { count: 3 })).toBe('<b>3</b>');
  });

  it.each([() => null, new Date(0), Number.NaN, Symbol('s')])(
    'throws for a value with no expression, such as %s',
    (value) => {
      expect(() => fillTemplate('[a]="⟦bind a⟧"', { a: value })).toThrow(UnprintableArgError);
    }
  );
});
