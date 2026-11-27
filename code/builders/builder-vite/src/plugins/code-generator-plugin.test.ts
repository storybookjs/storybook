import { describe, expect, it, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import { SB_VIRTUAL_FILES, getResolvedVirtualModuleId } from '../virtual-file-names.ts';
import { codeGeneratorPlugin } from './code-generator-plugin.ts';

vi.mock('../../../../core/src/shared/utils/module.ts', () => ({
  importMetaResolve: () => 'file:///builder-vite/input/iframe.html',
}));

function createPlugin(builderOptions: Record<string, unknown>) {
  const options = {
    configDir: '/project/.storybook',
    presets: {
      apply: async (name: string) => {
        if (name === 'core') {
          return { builder: { name: '@storybook/builder-vite', options: builderOptions } };
        }
        if (name === 'framework') {
          return '@storybook/react-vite';
        }
        return undefined;
      },
    },
  } as unknown as Options;

  return codeGeneratorPlugin(options);
}

function resolveStoriesFile(plugin: ReturnType<typeof codeGeneratorPlugin>) {
  const context = { resolve: vi.fn(async (id: string) => ({ id: `resolved:${id}` })) };
  const result = plugin.resolveId.call(
    context as any,
    SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE,
    '/project/app.js'
  );
  return { result, context };
}

describe('codeGeneratorPlugin experimental_importFn', () => {
  it('resolves the stories module to the generated virtual module by default', async () => {
    const { result, context } = resolveStoriesFile(createPlugin({}));

    await expect(result).resolves.toBe(
      getResolvedVirtualModuleId(SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE)
    );
    expect(context.resolve).not.toHaveBeenCalled();
  });

  it('resolves an absolute path through Vite', async () => {
    const { result, context } = resolveStoriesFile(
      createPlugin({ experimental_importFn: '/project/runtime-import-fn.ts' })
    );

    await expect(result).resolves.toEqual({ id: 'resolved:/project/runtime-import-fn.ts' });
    expect(context.resolve).toHaveBeenCalledWith(
      '/project/runtime-import-fn.ts',
      '/project/app.js',
      { skipSelf: true }
    );
  });

  it.each(['./runtime-import-fn.ts', 'my-package/import-fn'])(
    'rejects a non-absolute path: %s',
    async (path) => {
      const { result } = resolveStoriesFile(createPlugin({ experimental_importFn: path }));

      await expect(result).rejects.toThrow('must be an absolute path');
    }
  );

  it('throws when the module cannot be resolved', async () => {
    const plugin = createPlugin({ experimental_importFn: '/project/missing.ts' });
    const result = plugin.resolveId.call(
      { resolve: async () => null } as any,
      SB_VIRTUAL_FILES.VIRTUAL_STORIES_FILE,
      undefined
    );

    await expect(result).rejects.toThrow('experimental_importFn');
  });
});
