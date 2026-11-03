import { describe, expect, it } from 'vitest';

import { UnprintableArgError } from './snippetTemplate.ts';
import {
  asWrittenArgs,
  defaultCode,
  defaultWord,
  printValue,
  spreadArgs,
  writtenArg,
  writtenCode,
} from './snippetValues.ts';

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
  it('passes every arg but those the element writes', () => {
    expect(spreadArgs({ a: 1, b: 2 }, ['-b'])).toEqual([['a', 1]]);
  });
});

describe('printValue', () => {
  it('prints a written arg as its code, whatever the value would print as', () => {
    expect(printValue(writtenArg('fn((o) => o.name)'), 'select')).toBe('fn((o) => o.name)');
    expect(printValue(writtenArg(`new FormControl('x')`), 'control', { quote: "'" })).toBe(
      `new FormControl('x')`
    );
  });

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

  it('prints a literal of any length', () => {
    expect(printValue('x'.repeat(5000), 'text')).toHaveLength(5002);
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

describe('asWrittenArgs', () => {
  it('keeps an initial arg the args store dropped as the code the story writes it with', () => {
    const initialArgs = { thing: undefined, label: 'Go' };
    const unmappedArgs = { label: 'Stop' };
    const args = asWrittenArgs(
      { args: unmappedArgs, unmappedArgs, initialArgs },
      {
        thing: 'undefined',
      }
    );
    expect(printValue(args.thing, 'thing')).toBe('undefined');
    expect(writtenCode(args.thing)).toBe('undefined');
    expect(args.label).toBe('Stop');
  });

  it('passes an arg a control changed as its value', () => {
    const initialArgs = { onClick: 1 };
    const unmappedArgs = { onClick: 2 };
    expect(
      asWrittenArgs({ args: unmappedArgs, unmappedArgs, initialArgs }, { onClick: 'fn()' })
    ).toEqual({ onClick: 2 });
  });
});
