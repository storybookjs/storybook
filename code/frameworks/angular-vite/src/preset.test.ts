import { describe, expect, it, vi } from 'vitest';

import { findConfigFile } from 'storybook/internal/common';

import { angularOptionsPlugin } from './preset.ts';
import type { StandaloneOptions } from './builders/utils/standalone-options.ts';

vi.mock('storybook/internal/common', async (importOriginal) => ({
  ...(await importOriginal<typeof import('storybook/internal/common')>()),
  findConfigFile: vi.fn(),
}));

const mockFindConfigFile = vi.mocked(findConfigFile);
const normalizePath = (p: string) => p.replace(/\\/g, '/');

const baseOptions = { configDir: '.storybook' } as unknown as StandaloneOptions;

describe('angularOptionsPlugin', () => {
  // Core's own preview-file resolution list (`validConfigExtensions` in
  // code/core/src/common/utils/get-storybook-info.ts) — the transform must match every one of
  // these via `findConfigFile`, not a hardcoded/duplicated array.
  const extensions = ['ts', 'js', 'tsx', 'jsx', 'mjs', 'cjs'];

  it.each(extensions)(
    "injects `import 'zone.js';` for a resolved preview.%s when zoneless is false",
    async (ext) => {
      const resolvedPreviewPath = `.storybook/preview.${ext}`;
      mockFindConfigFile.mockReturnValue(resolvedPreviewPath);

      const plugin = angularOptionsPlugin(baseOptions, { normalizePath, zoneless: false });
      (plugin.config as any)({});

      const result: any = await (plugin.transform as any)('code-here', resolvedPreviewPath);

      expect(result.code).toContain("import 'zone.js';");
      expect(result.code).toContain('code-here');
    }
  );

  it('does not inject zone.js when zoneless is true', async () => {
    const resolvedPreviewPath = '.storybook/preview.ts';
    mockFindConfigFile.mockReturnValue(resolvedPreviewPath);

    const plugin = angularOptionsPlugin(baseOptions, { normalizePath, zoneless: true });
    (plugin.config as any)({});

    const result: any = await (plugin.transform as any)('code-here', resolvedPreviewPath);

    expect(result.code).not.toContain('zone.js');
  });

  it('no-ops for an id that does not match the resolved preview path', async () => {
    mockFindConfigFile.mockReturnValue('.storybook/preview.ts');

    const plugin = angularOptionsPlugin(baseOptions, { normalizePath, zoneless: false });
    (plugin.config as any)({});

    const result = await (plugin.transform as any)('code-here', '.storybook/preview.vue');

    expect(result).toBeUndefined();
  });

  it('no-ops without throwing when no preview file resolves', async () => {
    mockFindConfigFile.mockReturnValue(null);

    const plugin = angularOptionsPlugin(baseOptions, { normalizePath, zoneless: false });
    (plugin.config as any)({});

    const result = await (plugin.transform as any)('code-here', '.storybook/preview.ts');

    expect(result).toBeUndefined();
  });

  it('resolves the preview path once in config() and reuses it across multiple transform() calls', async () => {
    mockFindConfigFile.mockReturnValue('.storybook/preview.ts');

    const plugin = angularOptionsPlugin(baseOptions, { normalizePath, zoneless: false });
    (plugin.config as any)({});
    await (plugin.transform as any)('a', '.storybook/preview.ts');
    await (plugin.transform as any)('b', 'unrelated.ts');
    await (plugin.transform as any)('c', '.storybook/preview.ts');

    expect(mockFindConfigFile).toHaveBeenCalledTimes(1);
    expect(mockFindConfigFile).toHaveBeenCalledWith('preview', '.storybook');
  });
});
