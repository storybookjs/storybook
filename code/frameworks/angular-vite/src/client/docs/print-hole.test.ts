import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import type { AngularHolePlace } from '../../snippet-values.ts';
import { printHole } from './print-hole.ts';

const print = (kind: AngularHolePlace['kind'], value: unknown, indent?: number) =>
  printHole({ place: { kind, indent }, arg: 'x' }, value);

describe('printHole', () => {
  it('prints a value into a binding as the build prints the story args, for the template literal', () => {
    expect(print('bind', `it's "q"`)).toBe(String.raw`'it\\'s &quot;q&quot;'`);
    expect(print('bind', { a: [1, 'b'], 'c-d': null, e: undefined })).toBe(
      "{a: [1, 'b'], 'c-d': null}"
    );
  });

  it('prints a whole argsToTemplate binding, and none for an unset arg', () => {
    expect(print('prop', 'Go')).toBe(`[x]="'Go'"`);
    expect(print('prop', undefined)).toBe('');
  });

  it('indents the lines after the first as its place says', () => {
    expect(print('field', ['a\nb'], 2)).toBe("['a\\nb']");
    expect(print('text', 'a\nb', 2)).toBe('a\n  b');
  });

  it('prints text as written, and none Angular would read as its own syntax', () => {
    expect(print('text', 'a <i>b</i> `d`')).toBe('a <i>b</i> \\`d\\`');
    expect(print('text', 3)).toBe('3');
    for (const label of ['a {b}', '@if', '{{ x }}']) {
      expect(() => print('text', label)).toThrow(UnprintableArgError);
    }
  });

  it.each([() => null, new Date(0), Number.NaN, Symbol('s')])(
    'throws for a value with no expression, such as %s',
    (value) => {
      expect(() => print('bind', value)).toThrow(new UnprintableArgError('x'));
    }
  );
});
