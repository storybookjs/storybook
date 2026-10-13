import { describe, expect, it } from 'vitest';

import { UnprintableArgError, fillHoles, hole, printValue } from './snippetTemplate.ts';

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
