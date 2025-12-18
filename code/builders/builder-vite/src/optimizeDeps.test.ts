import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Options, Presets, PreviewAnnotation } from 'storybook/internal/types';

import type { InlineConfig as ViteInlineConfig } from 'vite';

import { getOptimizeDeps } from './optimizeDeps';

// Mock dependencies
vi.mock('storybook/internal/common', () => ({
  loadPreviewOrConfigFile: vi.fn(() => '/project/.storybook/preview.ts'),
}));

vi.mock('./list-stories', () => ({
  listStories: vi.fn(async () => [
    '/project/src/Button.stories.ts',
    '/project/src/Input.stories.ts',
  ]),
}));

vi.mock('./utils/process-preview-annotation', () => ({
  processPreviewAnnotation: vi.fn((path: PreviewAnnotation) => {
    if (typeof path === 'string') {
      return path;
    }

    if (typeof path === 'object' && 'absolute' in path) {
      return path.absolute;
    }
    return path;
  }),
}));

vi.mock('vite', () => ({
  normalizePath: vi.fn((path: string) => path.replace(/\\/g, '/')),
}));

describe('getOptimizeDeps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include story files as entries', async () => {
    const config: ViteInlineConfig = {
      root: '/project',
    };

    const options: Options = {
      configType: 'DEVELOPMENT',
      configDir: '/project/.storybook',
      packageJson: {},
      presets: {
        apply: vi.fn(async (key: string) => {
          if (key === 'previewAnnotations') {
            return [];
          }

          if (key === 'optimizeViteDeps') {
            return [];
          }
          return null;
        }),
      } as unknown as Presets,
      presetsList: [],
    };

    const result = await getOptimizeDeps(config, options);

    expect(result.entries).toContain('src/Button.stories.ts');
    expect(result.entries).toContain('src/Input.stories.ts');
  });

  it('should include preview annotation files as entries', async () => {
    const config: ViteInlineConfig = {
      root: '/project',
    };

    const options: Options = {
      configType: 'DEVELOPMENT',
      configDir: '/project/.storybook',
      packageJson: {},
      presets: {
        apply: vi.fn(async (key: string) => {
          if (key === 'previewAnnotations') {
            return [
              '/project/node_modules/@storybook/addon-actions/dist/preview.js',
              '/project/node_modules/@storybook/addon-docs/dist/preview.js',
            ];
          }

          if (key === 'optimizeViteDeps') {
            return [];
          }
          return null;
        }),
      } as unknown as Presets,
      presetsList: [],
    };

    const result = await getOptimizeDeps(config, options);

    // Should include user's preview file
    expect(result.entries).toContain('.storybook/preview.ts');
    // Should include addon preview annotations
    expect(result.entries).toContain('node_modules/@storybook/addon-actions/dist/preview.js');
    expect(result.entries).toContain('node_modules/@storybook/addon-docs/dist/preview.js');
  });

  it('should combine story files and preview annotations', async () => {
    const config: ViteInlineConfig = {
      root: '/project',
    };

    const options: Options = {
      configType: 'DEVELOPMENT',
      configDir: '/project/.storybook',
      packageJson: {},
      presets: {
        apply: vi.fn(async (key: string) => {
          if (key === 'previewAnnotations') {
            return ['/project/node_modules/@storybook/addon-actions/dist/preview.js'];
          }

          if (key === 'optimizeViteDeps') {
            return [];
          }
          return null;
        }),
      } as unknown as Presets,
      presetsList: [],
    };

    const result = await getOptimizeDeps(config, options);

    // Should have both stories and preview annotations
    expect(result.entries?.length).toBeGreaterThan(0);
    expect(result.entries).toContain('src/Button.stories.ts');
    expect(result.entries).toContain('.storybook/preview.ts');
    expect(result.entries).toContain('node_modules/@storybook/addon-actions/dist/preview.js');
  });

  it('should preserve existing optimizeDeps config', async () => {
    const config: ViteInlineConfig = {
      root: '/project',
      optimizeDeps: {
        include: ['existing-dep'],
        exclude: ['excluded-dep'],
      },
    };

    const options: Options = {
      configType: 'DEVELOPMENT',
      configDir: '/project/.storybook',
      packageJson: {},
      presets: {
        apply: vi.fn(async (key: string) => {
          if (key === 'previewAnnotations') {
            return [];
          }

          if (key === 'optimizeViteDeps') {
            return [];
          }
          return null;
        }),
      } as unknown as Presets,
      presetsList: [],
    };

    const result = await getOptimizeDeps(config, options);

    // Should preserve existing config
    expect(result.include).toContain('existing-dep');
    expect(result.exclude).toEqual(['excluded-dep']);
  });

  it('should include extra dependencies from presets', async () => {
    const config: ViteInlineConfig = {
      root: '/project',
    };

    const options: Options = {
      configType: 'DEVELOPMENT',
      configDir: '/project/.storybook',
      packageJson: {},
      presets: {
        apply: vi.fn(async (key: string) => {
          if (key === 'previewAnnotations') {
            return [];
          }

          if (key === 'optimizeViteDeps') {
            return ['preset-dep-1', 'preset-dep-2'];
          }
          return null;
        }),
      } as unknown as Presets,
      presetsList: [],
    };

    const result = await getOptimizeDeps(config, options);

    expect(result.include).toContain('preset-dep-1');
    expect(result.include).toContain('preset-dep-2');
  });

  it('should handle missing preview file gracefully', async () => {
    const { loadPreviewOrConfigFile } = await import('storybook/internal/common');
    vi.mocked(loadPreviewOrConfigFile).mockReturnValueOnce(undefined);

    const config: ViteInlineConfig = {
      root: '/project',
    };

    const options: Options = {
      configType: 'DEVELOPMENT',
      configDir: '/project/.storybook',
      packageJson: {},
      presets: {
        apply: vi.fn(async (key: string) => {
          if (key === 'previewAnnotations') {
            return [];
          }

          if (key === 'optimizeViteDeps') {
            return [];
          }
          return null;
        }),
      } as unknown as Presets,
      presetsList: [],
    };

    const result = await getOptimizeDeps(config, options);

    // Should still work without preview file
    expect(result.entries).toBeDefined();
    expect(result.entries).toContain('src/Button.stories.ts');
  });
});
