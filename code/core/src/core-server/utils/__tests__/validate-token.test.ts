import { describe, expect, it } from 'vitest';

import { isValidToken } from '../validate-token';

describe('isValidToken', () => {
  const validToken = 'test-token-123';

  it('returns true for matching tokens', () => {
    expect(isValidToken(validToken, validToken)).toBe(true);
  });

  it('returns false for non-matching tokens', () => {
    expect(isValidToken('wrong-token', validToken)).toBe(false);
  });

  it('returns false for null token', () => {
    expect(isValidToken(null, validToken)).toBe(false);
  });

  it('returns false for undefined token', () => {
    expect(isValidToken(undefined as any, validToken)).toBe(false);
  });

  it('returns false for empty token', () => {
    expect(isValidToken('', validToken)).toBe(false);
  });

  it('returns false when expected token is null', () => {
    expect(isValidToken(validToken, null as any)).toBe(false);
  });

  it('returns false when expected token is undefined', () => {
    expect(isValidToken(validToken, undefined as any)).toBe(false);
  });

  it('returns false for empty expected token', () => {
    expect(isValidToken(validToken, '')).toBe(false);
  });

  it('returns false for tokens with different lengths', () => {
    expect(isValidToken('short', 'much-longer-token')).toBe(false);
  });

  it('handles special characters in tokens', () => {
    const specialToken = 'token-with-special-chars-!@#$%^&*()';
    expect(isValidToken(specialToken, specialToken)).toBe(true);
    expect(isValidToken(specialToken, 'different-token')).toBe(false);
  });

  it('handles unicode characters in tokens', () => {
    const unicodeToken = 'token-with-unicode-🚀-测试';
    expect(isValidToken(unicodeToken, unicodeToken)).toBe(true);
    expect(isValidToken(unicodeToken, 'different-token')).toBe(false);
  });
});
