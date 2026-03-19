import { describe, expect, it } from 'vitest';

import { stripCommentsAndStrings } from './strip-comments-and-strings';

describe('stripCommentsAndStrings', () => {
  it('should remove single-quoted strings', () => {
    expect(stripCommentsAndStrings("import x from './drei-exports.ts'")).toBe('import x from ""');
  });

  it('should remove double-quoted strings', () => {
    expect(stripCommentsAndStrings('const file = "exports.ts"')).toBe('const file = ""');
  });

  it('should remove template strings', () => {
    expect(stripCommentsAndStrings('const path = `${dir}/exports.ts`')).toBe('const path = ""');
  });

  it('should remove line comments', () => {
    expect(stripCommentsAndStrings('const x = 1 // exports.foo')).toBe('const x = 1 ');
  });

  it('should remove block comments', () => {
    expect(stripCommentsAndStrings('/* exports.foo = 1 */ const x = 1')).toBe(' const x = 1');
  });

  it('should preserve code outside strings and comments', () => {
    expect(stripCommentsAndStrings('module.exports = {}')).toBe('module.exports = {}');
    expect(stripCommentsAndStrings('exports.foo = bar')).toBe('exports.foo = bar');
  });
});
