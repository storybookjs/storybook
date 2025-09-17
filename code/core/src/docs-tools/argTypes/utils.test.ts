import { describe, expect, it } from 'vitest';

import { createSummaryValue, parseLiteral } from './utils';

describe('createSummaryValue', () => {
  it('creates an object with just summary if detail is not passed', () => {
    const summary = 'boolean';
    expect(createSummaryValue(summary)).toEqual({ summary });
  });

  it('creates an object with summary & detail if passed', () => {
    const summary = 'MyType';
    const detail = 'boolean | string';
    expect(createSummaryValue(summary, detail)).toEqual({ summary, detail });
  });

  it('creates an object with just summary if details are equal', () => {
    const summary = 'boolean';
    const detail = 'boolean';
    expect(createSummaryValue(summary, detail)).toEqual({ summary });
  });
});

describe('parseLiteral', () => {
  it('should return null for "null" literal', () => {
    expect(parseLiteral('null')).toBe(null);
  });

  it('should return undefined for "undefined" literal', () => {
    expect(parseLiteral('undefined')).toBe(undefined);
  });

  it('should return true for "true" literal', () => {
    expect(parseLiteral('true')).toBe(true);
  });

  it('should return false for "false" literal', () => {
    expect(parseLiteral('false')).toBe(false);
  });

  it('should parse quoted strings correctly', () => {
    expect(parseLiteral('"hello"')).toBe('hello');
    expect(parseLiteral("'world'")).toBe('world');
  });

  it('should parse numbers correctly', () => {
    expect(parseLiteral('42')).toBe(42);
    expect(parseLiteral('3.14')).toBe(3.14);
  });

  it('should return string for non-quoted string literals', () => {
    expect(parseLiteral('someString')).toBe('someString');
  });
});
