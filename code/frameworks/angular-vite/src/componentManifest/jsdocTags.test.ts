import { describe, expect, it } from 'vitest';

import { extractJSDocInfo } from './jsdocTags.ts';

describe('extractJSDocInfo', () => {
  it('extracts plain description', () => {
    const result = extractJSDocInfo('A simple button component.');
    expect(result.description).toBe('A simple button component.');
    expect(result.tags).toEqual({});
  });

  it('extracts @desc tag', () => {
    const result = extractJSDocInfo('@desc Short description');
    // comment-parser splits: name="Short", description="description"
    // extractJSDocInfo joins them as `${name} ${description}`
    expect(result.tags.desc).toEqual(['Short description']);
  });

  it('extracts @describe tag', () => {
    const result = extractJSDocInfo('@describe Full description here');
    expect(result.tags.describe).toEqual(['Full description here']);
  });

  it('extracts @summary tag', () => {
    const result = extractJSDocInfo('@summary One-liner summary');
    expect(result.tags.summary).toEqual(['One-liner summary']);
  });

  it('extracts @useTemplate tag', () => {
    const result = extractJSDocInfo('@useTemplate');
    expect('useTemplate' in result.tags).toBe(true);
  });

  it('extracts multiple tags', () => {
    const result = extractJSDocInfo('Description text\n@summary Short\n@desc Long description');
    expect(result.description).toBe('Description text');
    // single-word tag: name="Short", description="" → "Short "
    expect(result.tags.summary).toEqual(['Short ']);
    expect(result.tags.desc).toEqual(['Long description']);
  });

  it('extracts typed tags', () => {
    const result = extractJSDocInfo('@param {string} name The name');
    expect(result.tags.param).toEqual(['{string} name The name']);
  });

  it('returns empty description for empty string', () => {
    const result = extractJSDocInfo('');
    expect(result.description).toBe('');
    expect(result.tags).toEqual({});
  });
});
