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

  it('writes what an attribute value cannot hold as is with the entities Vue decodes', () => {
    expect(print(attr, `a & "b" 'c'`)).toBe(`label="a &amp; &quot;b&quot; 'c'"`);
    expect(print(attr, ['say "hi"'])).toBe(`:label="['say &quot;hi&quot;']"`);
  });

  it('cannot print a value with no literal', () => {
    expect(() => print(attr, () => {})).toThrow(new UnprintableArgError('x'));
    expect(() => print({ kind: 'value', in: 'script' }, h('b'))).toThrow(UnprintableArgError);
  });

  it('prints the args a control added in name order, but those its place prints already', () => {
    expect(
      printHole(
        { kind: 'props', except: ['label', 'default'], spread: true },
        { size: 2, label: 'Go', active: true }
      )
    ).toBe('active :size="2"');
  });

  it('binds a class or style the element writes, which Vue merges', () => {
    expect(
      printHole(
        { kind: 'props', except: [], merge: ['class'], spread: true },
        { class: 'big', title: 'Hi' }
      )
    ).toBe(`:class="'big'" title="Hi"`);
  });

  it('prints the slots a control set as children, opening a tag that closes itself', () => {
    const slots: Extract<VueHolePlace, { kind: 'slots' }> = {
      kind: 'slots',
      slots: ['default', 'header'],
      indent: '    ',
    };
    expect(printHole({ ...slots, spread: true }, { label: 'Go' })).toBe('');
    expect(printHole({ ...slots, tag: 'Card', spread: true }, { label: 'Go' })).toBe(' />');
    expect(printHole({ ...slots, spread: true }, { header: 'Hi', default: 'Body' })).toBe(
      '\n    Body\n    <template #header>\n      Hi\n    </template>'
    );
    expect(printHole({ ...slots, tag: 'Card', spread: true }, { header: ' padded ' })).toBe(
      ">\n    <template #header>\n      {{ ' padded ' }}\n    </template>\n  </Card>"
    );
  });

  it('prints text escaped, and code as an interpolation', () => {
    expect(print({ kind: 'text' }, 'a < b & {{ c }}')).toBe('a &lt; b &amp; &#123;&#123; c }}');
    expect(print({ kind: 'text' }, 'a{')).toBe('a&#123;');
    expect(print({ kind: 'text' }, ['a}}b'])).toBe(`{{ ['a}\\}b'] }}`);
    expect(print({ kind: 'text' }, undefined)).toBe('');
    expect(print({ kind: 'text', slot: true }, null)).toBe('{{ null }}');
    expect(print({ kind: 'text', slot: true }, ' padded')).toBe(`{{ ' padded' }}`);
    expect(print({ kind: 'text', slot: true }, { a: '&amp;' })).toBe(`{{ { a: '&amp;amp;' } }}`);
  });

  it('prints code in the quote the place does not use, an operand in parentheses if needed', () => {
    expect(print({ kind: 'value', in: 'attribute', quote: '"' }, 'a b')).toBe("'a b'");
    expect(print({ kind: 'value', in: 'attribute', quote: "'" }, 'it')).toBe('"it"');
    expect(print({ kind: 'value', in: 'attribute', quote: '"' }, 'say "hi"')).toBe(
      "'say &quot;hi&quot;'"
    );
    expect(print({ kind: 'value', in: 'interpolation', readsOn: true }, 5)).toBe('(5)');
    expect(print({ kind: 'value', in: 'interpolation' }, -2)).toBe('(-2)');
    expect(print({ kind: 'value', in: 'interpolation' }, 'a}}}b')).toBe(`'a}\\}\\}b'`);
    expect(print({ kind: 'value', in: 'script' }, '</d>')).toBe("'</d>'");
    expect(print({ kind: 'value', in: 'script' }, -2)).toBe('-2');
    expect(print({ kind: 'value', in: 'statement' }, -2)).toBe('(-2)');
    expect(print({ kind: 'value', in: 'statement', readsOn: true }, 5)).toBe('(5)');
  });

  it('prints a bound prop as its code, with the args a control set, or as its arg over it', () => {
    const bound: Extract<VueHolePlace, { kind: 'bound' }> = {
      kind: 'bound',
      by: 'size',
      code: [
        ':size="',
        { kind: 'value', in: 'attribute', quote: '"', arg: 'label', text: "'Go'" },
        ` + '!'"`,
      ],
      over: [{ kind: 'attr', arg: 'size', text: '' }],
    };
    const hole = { ...bound, spread: true } as const;
    expect(printHole(hole, { count: 2 })).toBe(`:size="'Go' + '!'"`);
    expect(printHole(hole, { label: 'Stop' })).toBe(`:size="'Stop' + '!'"`);
    expect(printHole(hole, { label: 'Stop', size: 'lg' })).toBe('size="lg"');
  });

  it('cannot print a place it does not know', () => {
    expect(() => print({ kind: 'slot' } as never, 'Go')).toThrow('Unknown hole kind `slot`');
  });
});
