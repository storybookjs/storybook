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

  it('drops the whitespace before an attribute hole that prints nothing', () => {
    const template = `<Button ${hole('attr', 'size', 'size')}\n  ${hole('props')} />`;
    expect(fillHoles(template, () => '')).toBe('<Button />');
  });

  it('keeps the whitespace on its line before any other hole that prints nothing', () => {
    expect(fillHoles(`Hello ${hole('text', 'name')}!`, () => '')).toBe('Hello !');
    expect(fillHoles(`f(a, ${hole('value', 'b')})`, () => '')).toBe('f(a, )');
  });

  it('drops the line of any other hole that prints nothing on a line of its own', () => {
    const template = `<Button>\n  ${hole('text', 'children')}\n</Button>`;
    expect(fillHoles(template, () => '')).toBe('<Button>\n</Button>');
  });

  it('fills a template with a long run of whitespace in linear time', () => {
    const template = `${' '.repeat(200_000)}x${hole('attr', 'a', 'a')}`;
    expect(fillHoles(template, () => '')).toBe(`${' '.repeat(200_000)}x`);
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

  it('prints a literal up to 2000 characters long, and throws for a longer one', () => {
    expect(printValue('x'.repeat(1998), 'text')).toHaveLength(2000);
    expect(() => printValue('x'.repeat(1999), 'text')).toThrow(new UnprintableArgError('text'));
    expect(() => printValue({ a: 'x'.repeat(1992) }, 'data')).toThrow(UnprintableArgError);
    expect(printValue({ a: 'x'.repeat(1991) }, 'data')).toHaveLength(2000);
  });

  it('stops printing a large value as soon as it is too long', () => {
    const items = Array.from({ length: 1_000_000 }, (_, id) => ({ id, name: `item ${id}` }));
    const start = performance.now();
    expect(() => printValue(items, 'items')).toThrow(UnprintableArgError);
    expect(performance.now() - start).toBeLessThan(50);
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
