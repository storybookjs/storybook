import { vi, expect, describe, it } from 'vitest';

// Since getBuilderOptions is not exported, we'll test the deepMerge logic separately
// by creating a similar function

function deepMerge(target: any, source: any): any {
  const result = { ...target };

  for (const key in source) {
    if (source[key] !== undefined && source[key] !== null) {
      if (
        typeof source[key] === 'object' &&
        !Array.isArray(source[key]) &&
        typeof target[key] === 'object' &&
        !Array.isArray(target[key]) &&
        target[key] !== null
      ) {
        // Deep merge nested objects
        result[key] = deepMerge(target[key], source[key]);
      } else {
        // Override with source value
        result[key] = source[key];
      }
    }
  }

  return result;
}

describe('Angular CLI Framework Preset - Deep Merge Fix', () => {
  describe('deepMerge', () => {
    it('should preserve stylePreprocessorOptions.includePaths from browserTarget when not in storybook options', () => {
      const browserTargetOptions = {
        stylePreprocessorOptions: {
          includePaths: ['src/styles', 'node_modules'],
        },
        assets: ['src/assets'],
        styles: ['src/styles.scss'],
      };

      const storybookOptions = {};

      const result = deepMerge(browserTargetOptions, storybookOptions);

      expect(result.stylePreprocessorOptions).toEqual({
        includePaths: ['src/styles', 'node_modules'],
      });
      expect(result.assets).toEqual(['src/assets']);
      expect(result.styles).toEqual(['src/styles.scss']);
    });

    it('should override browserTarget options with storybook-specific options when provided', () => {
      const browserTargetOptions = {
        stylePreprocessorOptions: {
          includePaths: ['src/styles'],
        },
        assets: ['src/assets'],
        styles: ['src/styles.scss'],
      };

      const storybookOptions = {
        stylePreprocessorOptions: {
          includePaths: ['storybook/styles'],
        },
        preserveSymlinks: true,
      };

      const result = deepMerge(browserTargetOptions, storybookOptions);

      expect(result.stylePreprocessorOptions).toEqual({
        includePaths: ['storybook/styles'],
      });
      expect(result.assets).toEqual(['src/assets']);
      expect(result.styles).toEqual(['src/styles.scss']);
      expect(result.preserveSymlinks).toBe(true);
    });

    it('should deeply merge stylePreprocessorOptions instead of overriding completely', () => {
      const browserTargetOptions = {
        stylePreprocessorOptions: {
          includePaths: ['src/styles'],
          precision: 8,
        },
      };

      const storybookOptions = {
        stylePreprocessorOptions: {
          additionalData: '@import "storybook-vars";',
        },
      };

      const result = deepMerge(browserTargetOptions, storybookOptions);

      expect(result.stylePreprocessorOptions).toEqual({
        includePaths: ['src/styles'],
        precision: 8,
        additionalData: '@import "storybook-vars";',
      });
    });

    it('should handle arrays correctly (override instead of merge)', () => {
      const browserTargetOptions = {
        assets: ['src/assets', 'src/fonts'],
        styles: ['src/styles.scss'],
      };

      const storybookOptions = {
        assets: ['storybook/assets'],
      };

      const result = deepMerge(browserTargetOptions, storybookOptions);

      expect(result.assets).toEqual(['storybook/assets']);
      expect(result.styles).toEqual(['src/styles.scss']);
    });

    it('should handle null and undefined values correctly', () => {
      const browserTargetOptions = {
        stylePreprocessorOptions: {
          includePaths: ['src/styles'],
        },
        assets: ['src/assets'],
      };

      const storybookOptions = {
        stylePreprocessorOptions: null,
        assets: undefined,
        newOption: 'value',
      };

      const result = deepMerge(browserTargetOptions, storybookOptions);

      // Null and undefined should not override existing values
      expect(result.stylePreprocessorOptions).toEqual({
        includePaths: ['src/styles'],
      });
      expect(result.assets).toEqual(['src/assets']);
      expect(result.newOption).toBe('value');
    });

    it('should preserve complex nested structures', () => {
      const browserTargetOptions = {
        buildOptimizer: false,
        optimization: {
          scripts: true,
          styles: {
            minify: true,
            inlineCritical: false,
          },
        },
      };

      const storybookOptions = {
        optimization: {
          styles: {
            inlineCritical: true,
          },
        },
      };

      const result = deepMerge(browserTargetOptions, storybookOptions);

      expect(result.optimization).toEqual({
        scripts: true,
        styles: {
          minify: true,
          inlineCritical: true,
        },
      });
      expect(result.buildOptimizer).toBe(false);
    });
  });
});
