import { describe, expect, it } from 'vitest';

import {
  UnprintableArgError,
  dedentStoryCode,
  defaultCode,
  defaultWord,
  fillHoles,
  hole,
  holeWord,
  printValue,
  spreadArgs,
} from './snippetTemplate.ts';

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

  it('encodes a word with a space, a hole bracket or a leading percent sign', () => {
    expect(['a b', 'x⟧', '%'].map(holeWord)).toEqual(['%a%20b', '%x%E2%9F%A7', '%%25']);
  });
});

describe('defaultWord', () => {
  it('writes code after a question mark, URI-encoded, which defaultCode reads back', () => {
    expect(defaultWord("{ size: 'md' }")).toBe("?%7B%20size%3A%20'md'%20%7D");
    expect(defaultCode(defaultWord("{ size: 'md' }"))).toBe("{ size: 'md' }");
  });

  it('reads no code from any other word', () => {
    expect(defaultCode('label')).toBeUndefined();
    expect(defaultCode(undefined)).toBeUndefined();
  });
});

describe('spreadArgs', () => {
  it('passes every arg but those written after the spread', () => {
    expect(spreadArgs({ a: 1, b: 2 }, ['-b'])).toEqual([['a', 1]]);
  });

  it('throws for a set arg written before the spread', () => {
    expect(() => spreadArgs({ a: 1 }, ['^a'])).toThrow(new UnprintableArgError('a'));
    expect(spreadArgs({ b: 2 }, ['^a'])).toEqual([['b', 2]]);
  });
});

describe('dedentStoryCode', () => {
  it('keeps the indentation lines have past the column the cut starts at', () => {
    expect(dedentStoryCode('a\n      ? b\n      : c', 4)).toBe('a\n  ? b\n  : c');
    expect(dedentStoryCode('{\n      b\n    }', 20)).toBe('{\n  b\n}');
  });
});

describe('printValue', () => {
  it('prints primitives as literals', () => {
    expect(printValue('Go', 'label')).toBe('"Go"');
    expect(printValue('it\'s "x"\n', 'label', { quote: "'" })).toBe("'it\\'s \"x\"\\n'");
    expect(printValue(3, 'n')).toBe('3');
    expect(printValue(false, 'b')).toBe('false');
    expect(printValue(null, 'x')).toBe('null');
    expect(printValue(undefined, 'x')).toBe('undefined');
  });

  it('prints plain data as array and object literals', () => {
    expect(printValue({ a: 1, 'b-c': ['x'], d: undefined, e: {} }, 'data')).toBe(
      '{ a: 1, "b-c": ["x"], e: {} }'
    );
  });

  it('throws for a value with no literal', () => {
    expect(() => printValue(() => {}, 'onClick')).toThrow(new UnprintableArgError('onClick'));
    expect(() => printValue([new Date(0)], 'dates')).toThrow(UnprintableArgError);
  });

  it('throws for a value opaque matches, at any depth', () => {
    const opaque = (value: unknown) => Object(value).secret === true;
    expect(() => printValue({ a: [{ secret: true }] }, 'data', { opaque })).toThrow(
      new UnprintableArgError('data')
    );
  });
});
