import { describe, expect, it } from 'vitest';

import { h } from 'vue';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import { printHole } from './print-hole.ts';

const print = (kind: string, words: string[], value: unknown) =>
  printHole({ kind, arg: 'x', words }, value);

describe('printHole', () => {
  it('prints an attribute bare when true, quoted for a string, bound otherwise', () => {
    expect(print('attr', ['label'], true)).toBe('label');
    expect(print('attr', ['label'], false)).toBe(':label="false"');
    expect(print('attr', ['label'], 'Go')).toBe('label="Go"');
    expect(print('attr', ['label'], 'say "hi"')).toBe(`label='say "hi"'`);
    expect(print('attr', ['label'], -2)).toBe(':label="-2"');
    expect(print('attr', ['label'], ['a', 1])).toBe(`:label="['a', 1]"`);
    expect(print('attr', ['label'], undefined)).toBe('');
  });

  it('cannot print an attribute that would read back as another value', () => {
    for (const value of [`a & "b" 'c'`, ['say "hi"'], () => {}]) {
      expect(() => print('attr', ['label'], value)).toThrow(new UnprintableArgError('x'));
    }
  });

  it('prints the args a control added in name order, but those its words name', () => {
    expect(
      printHole(
        { kind: 'props', words: ['label', 'default'] },
        { size: 2, label: 'Go', active: true }
      )
    ).toBe('active :size="2"');
  });

  it('prints text escaped, and slot content that is no text as an interpolation', () => {
    expect(print('text', [], 'a < b & {{ c }}')).toBe('a &lt; b &amp; &#123;&#123; c }}');
    expect(print('text', ['slot'], null)).toBe('{{ null }}');
    expect(print('text', [], undefined)).toBe('');
    expect(() => print('text', [], ['a'])).toThrow(UnprintableArgError);
    expect(() => print('text', ['{<'], '{x')).toThrow(UnprintableArgError);
    expect(() => print('text', ['slot'], ' padded')).toThrow(UnprintableArgError);
  });

  it('prints code in the quote the place does not use, in parentheses where it reads on', () => {
    expect(print('value', [], 'a b')).toBe("'a b'");
    expect(print('value', ["'"], 'it')).toBe('"it"');
    expect(print('value', ['{{', '.'], 5)).toBe('(5)');
    expect(print('value', ['{{'], -2)).toBe('(-2)');
    expect(print('value', ['script'], '</d>')).toBe("'</d>'");
    expect(() => print('value', [], 'say "hi"')).toThrow(UnprintableArgError);
    expect(() => print('value', ['{{'], 'a}}b')).toThrow(UnprintableArgError);
    expect(() => print('value', ['script'], h('b'))).toThrow(UnprintableArgError);
  });
});
