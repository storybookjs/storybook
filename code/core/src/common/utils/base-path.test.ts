import { describe, expect, it } from 'vitest';

import { InvalidBasePathError } from 'storybook/internal/server-errors';

import { normalizeBasePath } from './base-path.ts';

describe('normalizeBasePath', () => {
  it('defaults to the domain root', () => {
    expect(normalizeBasePath(undefined)).toBe('/');
    expect(normalizeBasePath('')).toBe('/');
    expect(normalizeBasePath('   ')).toBe('/');
    expect(normalizeBasePath('/')).toBe('/');
    expect(normalizeBasePath('///')).toBe('/');
  });

  it('adds the leading and trailing slash', () => {
    expect(normalizeBasePath('__storybook')).toBe('/__storybook/');
    expect(normalizeBasePath('/__storybook')).toBe('/__storybook/');
    expect(normalizeBasePath('__storybook/')).toBe('/__storybook/');
    expect(normalizeBasePath('/__storybook/')).toBe('/__storybook/');
  });

  it('preserves nested paths and collapses repeated slashes', () => {
    expect(normalizeBasePath('/design/storybook')).toBe('/design/storybook/');
    expect(normalizeBasePath('//design//storybook//')).toBe('/design/storybook/');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeBasePath('  /__storybook  ')).toBe('/__storybook/');
  });

  it('is idempotent', () => {
    expect(normalizeBasePath(normalizeBasePath('__storybook'))).toBe('/__storybook/');
    expect(normalizeBasePath(normalizeBasePath('/'))).toBe('/');
  });

  it('rejects absolute URLs', () => {
    expect(() => normalizeBasePath('https://example.com/sb')).toThrow(InvalidBasePathError);
  });

  it('rejects query strings and fragments', () => {
    expect(() => normalizeBasePath('/sb?foo=1')).toThrow(InvalidBasePathError);
    expect(() => normalizeBasePath('/sb#foo')).toThrow(InvalidBasePathError);
  });
});
