import { describe, expect, it } from 'vitest';

import {
  UnprintableArgError,
  fillHoles,
  findHoles,
  hole,
  holeWord,
  withHoleSpace,
} from './snippetTemplate.ts';
import { defaultCode, defaultWord } from './snippetValues.ts';

describe('fillHoles', () => {
  it('fills every hole with what the filler prints for its kind and words', () => {
    const template = `<Button${hole('attr', 'label', 'text')}>${hole('text', 'children')}</Button>`;
    expect(fillHoles(template, (kind, words) => `[${kind}:${words.join(',')}]`)).toBe(
      '<Button[attr:label,text]>[text:children]</Button>'
    );
  });

  it('keeps the code between the holes as written', () => {
    expect(fillHoles(`a ? ${hole('value', 'x')} : b`, () => '1')).toBe('a ? 1 : b');
  });

  it('reads nothing but the hole: the code around it is kept as written', () => {
    const fill = (kind: string, words: string[]) => (kind === 'empty' ? '' : words.join(','));
    for (const around of ['', ' ', '\n  ', 'a ', '<x>\n', '⟧ ']) {
      const filled = fillHoles(`${around}${hole('empty')}${around}|${hole('v', '1')}`, fill);
      expect(filled).toBe(`${around}${around}|1`);
    }
  });

  it('prints a space word before a value, and leaves it out with an empty one', () => {
    const template = `<Button${hole('attr', 'size', '~%20')}${hole('text', 'x', '~%0A%20%20')}`;
    expect(fillHoles(template, (kind) => (kind === 'attr' ? 'size="sm"' : ''))).toBe(
      '<Button size="sm"'
    );
    expect(fillHoles(template, (kind) => (kind === 'attr' ? '' : 'Go'))).toBe('<Button\n  Go');
  });

  it('passes a word holeWord encoded as the text it was given', () => {
    const template = hole('attr', 'showHeader', holeWord('Render header?'), holeWord('%x'));
    expect(template).toBe('⟦attr showHeader %Render%20header%3F %%25x⟧');
    expect(fillHoles(template, (_, words) => words.join('|'))).toBe('showHeader|Render header?|%x');
  });

  it('passes a default word on as written, for defaultCode to read', () => {
    const template = hole('value', 'size', defaultWord("'50 %'"));
    expect(fillHoles(template, (_, [, word]) => defaultCode(word)!)).toBe("'50 %'");
  });
});

describe('findHoles', () => {
  it('finds each hole with where it is, its kind and its words decoded', () => {
    expect(findHoles(`a${hole('attr', 'x', '%a%20b')}b`)).toEqual([
      { start: 1, end: 16, kind: 'attr', words: ['x', 'a b'] },
    ]);
  });
});

describe('withHoleSpace', () => {
  const takesSpace = (kind: string, space: string) =>
    kind === 'attr' || kind === 'props' || space.includes('\n');

  it('moves the whitespace before an attribute hole into it', () => {
    const template = `<Button ${hole('attr', 'size', 'size')}\n  ${hole('props')} />`;
    expect(withHoleSpace(template, takesSpace)).toBe(
      '<Button⟦attr size size ~%20⟧⟦props ~%0A%20%20⟧ />'
    );
    expect(fillHoles(withHoleSpace(template, takesSpace), () => '')).toBe('<Button />');
  });

  it('keeps the whitespace on its line before any other hole', () => {
    expect(withHoleSpace(`Hello ${hole('text', 'name')}!`, takesSpace)).toBe(
      `Hello ${hole('text', 'name')}!`
    );
    expect(fillHoles(withHoleSpace(`f(a, ${hole('value', 'b')})`, takesSpace), () => '')).toBe(
      'f(a, )'
    );
  });

  it('moves a line break before any other hole into it', () => {
    const template = withHoleSpace(
      `<Button>\n  ${hole('text', 'children')}\n</Button>`,
      takesSpace
    );
    expect(template).toBe('<Button>⟦text children ~%0A%20%20⟧\n</Button>');
    expect(fillHoles(template, () => '')).toBe('<Button>\n</Button>');
    expect(fillHoles(template, () => 'Go')).toBe('<Button>\n  Go\n</Button>');
  });

  it('moves a long run of whitespace in linear time', () => {
    const template = `${' '.repeat(200_000)}x${hole('attr', 'a', 'a')}`;
    expect(fillHoles(withHoleSpace(template, takesSpace), () => '')).toBe(
      `${' '.repeat(200_000)}x`
    );
  });
});

describe('holeWord', () => {
  it('writes a word that can stand in a hole as it is', () => {
    expect(['label', '-children', '^size', 'a%b', '?x', 'label=label'].map(holeWord)).toEqual([
      'label',
      '-children',
      '^size',
      'a%b',
      '?x',
      'label=label',
    ]);
  });

  it('encodes a word with a space, a hole bracket or a leading percent sign or tilde', () => {
    expect(['a b', 'x⟧', '%', '~x'].map(holeWord)).toEqual([
      '%a%20b',
      '%x%E2%9F%A7',
      '%%25',
      '%~x',
    ]);
  });
});
