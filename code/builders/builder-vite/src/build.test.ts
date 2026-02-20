import { describe, expect, it } from 'vitest';

import { mergeConfig } from 'vite';

/**
 * Regression test for: https://github.com/storybookjs/storybook/issues/XXXX
 *
 * The storybook:enforce-output-dir plugin's config hook was previously returning the entire
 * incoming config spread ({ ...config, build: { outDir } }). Since Vite merges plugin config
 * hook results back into the base config by concatenating arrays, this caused
 * css.postcss.plugins (and other array fields) to be duplicated on every resolution cycle.
 *
 * The fix: return only the partial config needed ({ build: { outDir } }).
 */
describe('storybook:enforce-output-dir plugin config hook', () => {
  it('should not duplicate css.postcss.plugins when returning only partial config (fixed behavior)', () => {
    const postcssPlugin = { postcssPlugin: 'test-plugin' };
    const userConfig = {
      css: {
        postcss: {
          plugins: [postcssPlugin],
        },
      },
    };

    // Fixed: the config hook returns only the properties it needs to set
    const partialConfigFromPlugin = {
      build: {
        outDir: '/storybook-output',
      },
    };

    // Vite merges the plugin's returned partial config with the base config
    const result = mergeConfig(userConfig, partialConfigFromPlugin);

    expect(result.css.postcss.plugins).toHaveLength(1);
    expect(result.css.postcss.plugins[0]).toBe(postcssPlugin);
  });

  it('should demonstrate that spreading full config in config hook duplicates css.postcss.plugins (regression case)', () => {
    const postcssPlugin = { postcssPlugin: 'test-plugin' };
    const userConfig = {
      css: {
        postcss: {
          plugins: [postcssPlugin],
        },
      },
    };

    // Buggy: the config hook returns the entire config spread (the old behavior)
    const fullConfigFromPlugin = {
      ...userConfig,
      build: {
        outDir: '/storybook-output',
      },
    };

    // Vite merges the plugin's returned config with the base config, concatenating arrays
    const result = mergeConfig(userConfig, fullConfigFromPlugin);

    // The bug: postcss plugins are duplicated (2 instead of 1)
    expect(result.css.postcss.plugins).toHaveLength(2);
  });
});
