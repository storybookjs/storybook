import { describe, expect, it } from 'vitest';

import { extractComponentDescription } from './extractComponentDescription.ts';

describe('extractComponentDescription', () => {
  it('uses metaJsDoc description over compodoc description', () => {
    const result = extractComponentDescription('Meta description', 'Compodoc description');
    expect(result.description).toBe('Meta description');
  });

  it('falls back to compodoc description when no meta jsdoc', () => {
    const result = extractComponentDescription(undefined, 'Compodoc description');
    expect(result.description).toBe('Compodoc description');
  });

  it('prefers @desc tag over plain description', () => {
    const result = extractComponentDescription(
      'Plain description\n@desc Tag description',
      undefined
    );
    expect(result.description).toBe('Tag description');
  });

  it('prefers @describe tag over plain description', () => {
    const result = extractComponentDescription('Plain\n@describe The real description', undefined);
    expect(result.description).toBe('The real description');
  });

  it('extracts @summary tag', () => {
    const result = extractComponentDescription('Description\n@summary Short summary', undefined);
    expect(result.summary).toBe('Short summary');
  });

  it('returns jsDocTags', () => {
    const result = extractComponentDescription('@param {string} label The label', undefined);
    expect(result.jsDocTags.param).toBeDefined();
  });

  it('returns undefined description when both inputs are undefined', () => {
    const result = extractComponentDescription(undefined, undefined);
    expect(result.description).toBeUndefined();
    expect(result.summary).toBeUndefined();
    expect(result.jsDocTags).toEqual({});
  });

  it('trims whitespace from description', () => {
    const result = extractComponentDescription('  Trimmed  ', undefined);
    expect(result.description).toBe('Trimmed');
  });
});
