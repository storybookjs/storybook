import { describe, expect, it } from 'vitest';
import { posix } from './posix';

describe('posix', () => {
  it('should replace backslashes with forward slashes', () => {
    expect(posix('src\\components\\Page.tsx', '\\')).toBe('src/components/Page.tsx');
    expect(posix('src\\\\components\\\\Page.tsx', '\\\\')).toBe('src/components/Page.tsx');
  });
});
