// @vitest-environment happy-dom
import { describe, expect, it } from 'vite-plus/test';

import { extractTitle } from './Title';

describe('defaultTitleSlot', () => {
  it('splits on last /', () => {
    expect(extractTitle('a/b/c')).toBe('c');
    expect(extractTitle('a|b')).toBe('a|b');
    expect(extractTitle('a/b/c.d')).toBe('c.d');
  });
});
