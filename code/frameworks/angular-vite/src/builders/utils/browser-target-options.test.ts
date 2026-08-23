import { describe, expect, it } from 'vitest';
import { mergeBrowserTargetOptions } from './browser-target-options.ts';

// https://github.com/storybookjs/storybook/issues/36009
// The angular-vite builders validated the browserTarget's options and then
// kept only tsConfig, silently dropping styles / stylePreprocessorOptions /
// assets for everyone migrating from @storybook/angular (which honors them).

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
    const merged = mergeBrowserTargetOptions(
      { sourceMap: false, preserveSymlinks: false },
      {
        styles: ['src/styles.css'],
        stylePreprocessorOptions: { includePaths: ['node_modules'] },
        assets: ['src/favicon.ico'],
      } as any
    );

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
});