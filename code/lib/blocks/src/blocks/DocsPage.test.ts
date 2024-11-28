import { describe, expect, it } from 'vitest';
import { Title } from './Title';
import { extractTitle } from './Title';

describe('defaultTitleSlot', () => {
  it('splits on last /', () => {
    expect(extractTitle('a/b/c')).toBe('c');
    expect(extractTitle('a|b')).toBe('a|b');
    expect(extractTitle('a/b/c.d')).toBe('c.d');
  });

  it('throws error when of prop is undefined', () => {
    expect(() => {
      Title({ of: undefined });
    }).toThrow('Unexpected `of={undefined}`, did you mistype a CSF file reference?');
  });
});
