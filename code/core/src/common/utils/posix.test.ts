import { describe, expect, it } from 'vite-plus/test';

import { posix } from './posix';

describe('posix', () => {
  it('should replace backslashes with forward slashes', () => {
    expect(posix('src\\components\\Page.tsx', '\\')).toBe('src/components/Page.tsx');
    expect(posix('src\\\\components\\\\Page.tsx', '\\\\')).toBe('src/components/Page.tsx');
  });
});
