import { describe, expect, it } from 'vitest';
import { mergeBrowserTargetOptions } from './browser-target-options.ts';

describe('mergeBrowserTargetOptions', () => {
  it('fills gaps from the browser target without overriding own options', () => {
    const merged = mergeBrowserTargetOptions(
      { styles: ['own.scss'], sourceMap: false, preserveSymlinks: false },
      {
        styles: ['browser.css'],
        stylePreprocessorOptions: { includePaths: ['assets/style'] },
        assets: ['src/assets'],
        tsConfig: 'src/tsconfig.app.json',
      } as any
    );

    expect(merged).toEqual({
      styles: ['own.scss'],
      stylePreprocessorOptions: { includePaths: ['assets/style'] },
      assets: ['src/assets'],
      sourceMap: false,
      preserveSymlinks: false,
    });
  });

  it('passes browser-target options through when the storybook target defines none', () => {
    const merged = mergeBrowserTargetOptions({ sourceMap: false, preserveSymlinks: false }, {
      styles: ['src/styles.css'],
      stylePreprocessorOptions: { includePaths: ['node_modules'] },
      assets: ['src/favicon.ico'],
    } as any);

    expect(merged).toEqual({
      sourceMap: false,
      preserveSymlinks: false,
      styles: ['src/styles.css'],
      stylePreprocessorOptions: { includePaths: ['node_modules'] },
      assets: ['src/favicon.ico'],
    });
  });

  it('returns own options untouched when there is no browser target', () => {
    const own = { styles: ['own.scss'], sourceMap: true, preserveSymlinks: false };
    expect(mergeBrowserTargetOptions(own, undefined)).toBe(own);
  });

  it('inherits enabled sourceMap/preserveSymlinks when the storybook target omits them', () => {
    const merged = mergeBrowserTargetOptions(
      { sourceMap: undefined, preserveSymlinks: undefined },
      { sourceMap: true, preserveSymlinks: true } as any
    );

    expect(merged.sourceMap).toBe(true);
    expect(merged.preserveSymlinks).toBe(true);
  });

  it('lets an explicitly false storybook-target value win over an enabled browser target', () => {
    const merged = mergeBrowserTargetOptions({ sourceMap: false, preserveSymlinks: false }, {
      sourceMap: true,
      preserveSymlinks: true,
    } as any);

    expect(merged.sourceMap).toBe(false);
    expect(merged.preserveSymlinks).toBe(false);
  });
});
