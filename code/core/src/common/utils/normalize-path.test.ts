import { describe, expect, it } from 'vitest';

import { normalizePath } from './normalize-path';

describe('normalize-path', () => {
  it('should normalize paths', () => {
    expect(normalizePath('path/to/../file')).toBe('path/file');
    expect(normalizePath('path/to/./file')).toBe('path/to/file');
    expect(normalizePath('path\\to\\file')).toBe('path/to/file');
    expect(normalizePath('foo\\..\\bar')).toBe('bar');
  });
});
