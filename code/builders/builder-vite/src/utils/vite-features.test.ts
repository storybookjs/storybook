import { describe, expect, it, vi } from 'vitest';

import type { UserConfig } from 'vite';

import { applyChunkedPreviewRuntime } from './vite-features.ts';

describe('applyChunkedPreviewRuntime', () => {
  it('does not add a second preview runtime alias', () => {
    const config: UserConfig = {};
    applyChunkedPreviewRuntime(config, false);

    expect(config.resolve?.alias).toBeUndefined();
  });

  it('keeps pre-split preview modules in their own Rollup chunks', () => {
    const previous = vi.fn(() => 'vendor');
    const config: UserConfig = {
      build: { rollupOptions: { output: { manualChunks: previous } } },
    };
    applyChunkedPreviewRuntime(config, false);

    const manualChunks = config.build?.rollupOptions?.output;
    if (
      !manualChunks ||
      Array.isArray(manualChunks) ||
      typeof manualChunks.manualChunks !== 'function'
    ) {
      throw new Error('expected a manualChunks function');
    }

    expect(
      manualChunks.manualChunks('/abs/storybook/dist/preview/_chunks/runtime-abc.js', {} as never)
    ).toBe('runtime-abc');
    expect(manualChunks.manualChunks('/abs/src/Button.tsx', {} as never)).toBe('vendor');
    expect(previous).toHaveBeenCalledOnce();
  });

  it('leaves an object manualChunks map untouched', () => {
    const config: UserConfig = {
      build: { rollupOptions: { output: { manualChunks: { vendor: ['react'] } } } },
    };
    applyChunkedPreviewRuntime(config, false);

    expect(config.build?.rollupOptions?.output).toMatchObject({
      manualChunks: { vendor: ['react'] },
    });
  });

  it('caps Rolldown chunks and keeps existing groups', () => {
    const config: UserConfig = {
      build: {
        rolldownOptions: {
          output: { codeSplitting: { groups: [{ name: 'vendor', test: /node_modules/ }] } },
        },
      } as UserConfig['build'],
    };
    applyChunkedPreviewRuntime(config, true);

    const output = (config.build as { rolldownOptions: { output: Record<string, unknown> } })
      .rolldownOptions.output;
    expect(output.strictExecutionOrder).toBe(true);
    expect(output.codeSplitting).toEqual({
      groups: [
        { name: 'vendor', test: /node_modules/ },
        { name: 'sb', maxSize: 500 * 1024 },
      ],
    });
    expect(output.manualChunks).toBeUndefined();
  });
});
