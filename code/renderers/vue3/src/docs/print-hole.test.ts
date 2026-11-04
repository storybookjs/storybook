import { describe, expect, it } from 'vitest';

import { h } from 'vue';

import { UnprintableArgError } from 'storybook/internal/docs-tools';

import type { VueHolePlace } from '../snippet-values.ts';
import { printHole } from './print-hole.ts';

const print = (place: VueHolePlace, value: unknown) => printHole({ ...place, arg: 'x' }, value);
const attr = { kind: 'attr', name: 'label' } as const;

describe('printHole', () => {
  it('prints an attribute bare when true, quoted for a string, bound otherwise', () => {
    expect(print(attr, true)).toBe('label');
    expect(print(attr, false)).toBe(':label="false"');
    expect(print(attr, 'Go')).toBe('label="Go"');
    expect(print(attr, 'say "hi"')).toBe(`label='say "hi"'`);
    expect(print(attr, -2)).toBe(':label="-2"');
    expect(print(attr, ['a', 1])).toBe(`:label="['a', 1]"`);
    expect(print(attr, undefined)).toBe('');
    expect(printHole({ kind: 'attr', arg: 'label' }, 'Go')).toBe('label="Go"');
  });

  it('cannot print an attribute that would read back as another value', () => {
    for (const value of [`a & "b" 'c'`, ['say "hi"'], () => {}]) {
      expect(() => print(attr, value)).toThrow(new UnprintableArgError('x'));
    }
  });

  it('prints the args a control added in name order, but those its place prints already', () => {
    expect(
      printHole(
        { kind: 'props', except: ['label', 'default'], spread: true },
        { size: 2, label: 'Go', active: true }
      )
    ).toBe('active :size="2"');
  });

  it('prints text escaped, and slot content that is no text as an interpolation', () => {
    expect(print({ kind: 'text' }, 'a < b & {{ c }}')).toBe('a &lt; b &amp; &#123;&#123; c }}');
    expect(print({ kind: 'text', slot: true }, null)).toBe('{{ null }}');
    expect(print({ kind: 'text' }, undefined)).toBe('');
    expect(() => print({ kind: 'text' }, ['a'])).toThrow(UnprintableArgError);
    expect(() => print({ kind: 'text', braceBefore: true }, '{x')).toThrow(UnprintableArgError);
    expect(() => print({ kind: 'text', slot: true }, ' padded')).toThrow(UnprintableArgError);
    expect(() => print({ kind: 'text', slot: true }, ['a}}b'])).toThrow(UnprintableArgError);
    expect(() => print({ kind: 'text', slot: true }, { a: '&amp;' })).toThrow(UnprintableArgError);
  });

  it('prints code in the quote the place does not use, an operand in parentheses if needed', () => {
    expect(print({ kind: 'value', in: 'attribute', quote: '"' }, 'a b')).toBe("'a b'");
    expect(print({ kind: 'value', in: 'attribute', quote: "'" }, 'it')).toBe('"it"');
    expect(print({ kind: 'value', in: 'interpolation', readsOn: true }, 5)).toBe('(5)');
    expect(print({ kind: 'value', in: 'interpolation' }, -2)).toBe('(-2)');
    expect(print({ kind: 'value', in: 'script' }, '</d>')).toBe("'</d>'");
    expect(print({ kind: 'value', in: 'script' }, -2)).toBe('-2');
    expect(print({ kind: 'value', in: 'statement' }, -2)).toBe('(-2)');
    expect(print({ kind: 'value', in: 'statement', readsOn: true }, 5)).toBe('(5)');
    expect(() => print({ kind: 'value', in: 'attribute', quote: '"' }, 'say "hi"')).toThrow(
      UnprintableArgError
    );
    expect(() => print({ kind: 'value', in: 'interpolation' }, 'a}}b')).toThrow(
      UnprintableArgError
    );
    expect(() => print({ kind: 'value', in: 'script' }, h('b'))).toThrow(UnprintableArgError);
  });

  it('cannot print an arg the snippet has no place for, nor a place it does not know', () => {
    expect(() => print({ kind: 'guard' }, 'Go')).toThrow(new UnprintableArgError('x'));
    expect(() => print({ kind: 'slot' } as never, 'Go')).toThrow('Unknown hole kind `slot`');
  });
});
