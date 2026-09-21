import { describe, expect, it } from 'vitest';

import { deepMerge, mergeBrowserTargetOptions } from './browser-target-options.ts';

describe('deepMerge', () => {
  it('merges nested objects recursively', () => {
    expect(deepMerge({ nested: { a: 1 } }, { nested: { b: 2 } })).toEqual({
      nested: { a: 1, b: 2 },
    });
  });

  it('replaces arrays instead of concatenating them', () => {
    expect(deepMerge({ styles: ['a.scss'] }, { styles: ['b.scss', 'c.scss'] })).toEqual({
      styles: ['b.scss', 'c.scss'],
    });
  });

  it('skips null source values', () => {
    expect(deepMerge({ a: 1, b: 2 }, { a: null, b: 3 })).toEqual({ a: 1, b: 3 });
  });
});

describe('mergeBrowserTargetOptions', () => {
  it('keeps browser-target nested options that the own options do not define', () => {
    const own: Record<string, unknown> = { styles: ['src/own.scss'], sourceMap: false };
    const browserOptions = {
      stylePreprocessorOptions: { includePaths: ['src/sass'] },
      tsConfig: 'tsconfig.browser.json',
    };

    const merged = mergeBrowserTargetOptions(own, browserOptions);

    expect(merged.stylePreprocessorOptions).toEqual({ includePaths: ['src/sass'] });
    expect(merged.styles).toEqual(['src/own.scss']);
    expect(merged.sourceMap).toBe(false);
  });

  it('lets own options win over conflicting browser-target options, including nested keys', () => {
    const own: Record<string, unknown> = {
      stylePreprocessorOptions: { includePaths: ['own-path'] },
      sourceMap: false,
    };
    const browserOptions = {
      stylePreprocessorOptions: { includePaths: ['browser-path'], verbose: true },
      sourceMap: true,
    };

    const merged = mergeBrowserTargetOptions(own, browserOptions);

    expect(merged.stylePreprocessorOptions).toEqual({ includePaths: ['own-path'], verbose: true });
    expect(merged.sourceMap).toBe(false);
  });

  it('fills keys the own options leave undefined', () => {
    const own: Record<string, unknown> = { styles: undefined, sourceMap: false };
    const browserOptions = { styles: ['src/styles.scss'] };

    const merged = mergeBrowserTargetOptions(own, browserOptions);

    expect(merged.styles).toEqual(['src/styles.scss']);
  });

  it('replaces arrays with the own options instead of concatenating', () => {
    const own: Record<string, unknown> = { styles: ['own.scss'] };
    const browserOptions = { styles: ['browser.scss'] };

    expect(mergeBrowserTargetOptions(own, browserOptions).styles).toEqual(['own.scss']);
  });

  it('returns own options unchanged when there are no browser options', () => {
    const own = { sourceMap: false };

    expect(mergeBrowserTargetOptions(own, undefined)).toBe(own);
  });
});
