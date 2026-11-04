import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import type { AngularHolePlace } from '../../snippet-values.ts';
import { printHole } from './print-hole.ts';

const print = (kind: AngularHolePlace['kind'], value: unknown) =>
  printHole({ kind, arg: 'x' }, value);

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

  it('prints a value over several lines as one line of code', () => {
    expect(print('field', ['a\nb'])).toBe("['a\\nb']");
  });

  it('indents the lines after the first of text as its place says', () => {
    expect(printHole({ kind: 'text', arg: 'x', indent: 2 }, 'a\nb')).toBe('a\n  b');
  });

  it('prints text as written, and a cleared arg as none', () => {
    expect(print('text', 'a <i>b</i> `d`')).toBe('a <i>b</i> \\`d\\`');
    expect(print('text', 3)).toBe('3');
    expect(print('text', undefined)).toBe('');
  });

  it('prints text Angular would read as its own syntax in the form Angular reads as text', () => {
    expect(print('text', 'a {b} me@x.com')).toBe('a &#123;b&#125; me&#64;x.com');
    expect(print('text', '{{ x }}')).toBe("{{ '{{' }} x &#125;&#125;");
  });

  it('prints NaN and Infinity into a class field, which TypeScript writes by name', () => {
    expect(print('field', Number.NaN)).toBe('NaN');
    expect(print('field', { max: Number.NEGATIVE_INFINITY })).toBe('{max: -Infinity}');
  });

  it.each([() => null, new Date(0), Number.NaN, { a: Number.POSITIVE_INFINITY }, Symbol('s')])(
    'throws for a value with no template expression, such as %s',
    (value) => {
      expect(() => print('bind', value)).toThrow(new UnprintableArgError('x'));
    }
  );

  it.each([() => null, new Date(0), { a: 1 }])(
    'throws for a value with no text, such as %s',
    (value) => {
      expect(() => print('text', value)).toThrow(new UnprintableArgError('x'));
    }
  );
});
