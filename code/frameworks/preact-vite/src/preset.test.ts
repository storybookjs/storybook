import type { InlineConfig } from 'vite';
import { describe, expect, it, vi } from 'vitest';

import { viteFinal } from './preset';

describe('preact-vite viteFinal', () => {
  it('should return config unchanged when no plugins are present', async () => {
    const config: InlineConfig = { configFile: false };
    const result = await viteFinal!(config, {} as any);
    expect(result.configFile).toBe(false);
    expect(result.plugins).toEqual([]);
  });

  it('should pass through non-preact plugins unchanged', async () => {
    const otherPlugin = { name: 'some-other-plugin', config: vi.fn() } as any;
    const config: InlineConfig = { plugins: [otherPlugin] };
    const result = await viteFinal!(config, {} as any);
    expect(result.plugins).toHaveLength(1);
    expect((result.plugins![0] as any).name).toBe('some-other-plugin');
    expect((result.plugins![0] as any).config).toBe(otherPlugin.config);
  });

  it('should patch vite:preact-jsx plugin config hook to handle null/undefined this context', async () => {
    const originalConfig = vi.fn().mockReturnValue({ esbuild: { jsx: 'automatic' } });
    const preactJsxPlugin = { name: 'vite:preact-jsx', config: originalConfig } as any;
    const config: InlineConfig = { plugins: [preactJsxPlugin] };
    const result = await viteFinal!(config, {} as any);

    const patchedPlugin = result.plugins![0] as any;
    expect(patchedPlugin.name).toBe('vite:preact-jsx');
    expect(patchedPlugin.config).not.toBe(originalConfig);
  });

  it('should allow patched vite:preact-jsx config hook to be called with null/undefined this without throwing', async () => {
    // Simulate the buggy @preact/preset-vite config hook that does `'meta' in this`
    // without guarding against null/undefined this
    const buggyConfig = function (this: object) {
      // This is the bug: accessing 'meta' in 'this' when this could be null/undefined at runtime
      if ('meta' in this) {
        return { rolldown: true };
      }
      return {};
    };

    const preactJsxPlugin = { name: 'vite:preact-jsx', config: buggyConfig } as any;
    const config: InlineConfig = { plugins: [preactJsxPlugin] };
    const result = await viteFinal!(config, {} as any);

    const patchedPlugin = result.plugins![0] as any;

    // Should not throw when called with null/undefined this
    expect(() => patchedPlugin.config.call(null)).not.toThrow();
    expect(() => patchedPlugin.config.call(undefined)).not.toThrow();
  });

  it('should handle nested plugin arrays', async () => {
    const preactJsxPlugin = { name: 'vite:preact-jsx', config: vi.fn().mockReturnValue({}) } as any;
    const config: InlineConfig = { plugins: [[preactJsxPlugin]] };
    const result = await viteFinal!(config, {} as any);

    expect(result.plugins).toHaveLength(1);
    expect(Array.isArray(result.plugins![0])).toBe(true);
    const nestedPlugins = result.plugins![0] as any[];
    expect(nestedPlugins[0].name).toBe('vite:preact-jsx');
    // The nested plugin should also be patched
    expect(nestedPlugins[0].config).not.toBe(preactJsxPlugin.config);
  });

  it('should forward config hook result from patched plugin', async () => {
    const expectedResult = { optimizeDeps: { include: ['preact'] } };
    const preactJsxPlugin = {
      name: 'vite:preact-jsx',
      config: function () {
        return expectedResult;
      },
    } as any;
    const config: InlineConfig = { plugins: [preactJsxPlugin] };
    const result = await viteFinal!(config, {} as any);

    const patchedPlugin = result.plugins![0] as any;
    const hookResult = patchedPlugin.config({}, {});
    expect(hookResult).toEqual(expectedResult);
  });
});
