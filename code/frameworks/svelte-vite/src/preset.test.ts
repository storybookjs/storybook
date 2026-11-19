import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getTypeScriptForDocgenError,
  isDocgenServerDisabledInMainConfig,
} from 'storybook/internal/common';
import { TypeScriptMissingForDocgenError } from 'storybook/internal/server-errors';
import { logger, once } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { SVELTE_BUILDER_DOCGEN_DEPRECATION } from './docgen/options.ts';
import { svelteDocgen } from './plugins/svelte-docgen.ts';
import { viteFinal } from './preset.ts';
import type { FrameworkOptions } from './types.ts';

vi.mock('storybook/internal/node-logger', async () =>
  vi.importActual<typeof import('storybook/internal/node-logger')>('storybook/internal/node-logger')
);
vi.mock('storybook/internal/common', { spy: true });
vi.mock('./plugins/svelte-docgen.ts', () => ({ svelteDocgen: vi.fn() }));
vi.mock('./plugins/svelte-csf.ts', () => ({ svelteCsf: () => ({ name: 'svelte-csf' }) }));
vi.mock('./utils.ts', () => ({ handleSvelteKit: vi.fn() }));
vi.mock('@storybook/svelte/internal/svelte-csf/addon-check', () => ({
  assertSvelteCsfAddonNotInstalled: vi.fn(),
}));

beforeEach(() => {
  once.clear();
  vi.spyOn(logger, 'warn').mockImplementation(() => {});
  vi.mocked(svelteDocgen).mockResolvedValue({ name: 'svelte-docgen' });
  vi.mocked(isDocgenServerDisabledInMainConfig).mockResolvedValue(true);
});

const runPreset = (docgenServer: boolean, docgen?: FrameworkOptions['docgen']) =>
  viteFinal({}, {
    presets: {
      apply: async (key: string) => {
        if (key === 'frameworkOptions') {
          return { docgen };
        }
        return key === 'features' ? { docgenServer } : '@storybook/svelte-vite';
      },
    },
  } as Options);

describe('docgen configuration', () => {
  it.each([
    ['server', true, undefined, false],
    ['legacy', false, undefined, true],
    ['builder disabled', false, false, false],
  ] as const)('%s selects the plugin and warning', async (_name, server, docgen, legacy) => {
    const config = await runPreset(server, docgen);
    expect(config.plugins).toEqual(
      legacy ? [{ name: 'svelte-docgen' }, { name: 'svelte-csf' }] : [{ name: 'svelte-csf' }]
    );
    expect(logger.warn).toHaveBeenCalledTimes(legacy ? 1 : 0);
    if (legacy) {
      expect(logger.warn).toHaveBeenCalledWith(SVELTE_BUILDER_DOCGEN_DEPRECATION);
    }
  });

  describe('when the main config does not set docgenServer', () => {
    beforeEach(() => {
      vi.mocked(isDocgenServerDisabledInMainConfig).mockResolvedValue(false);
    });

    it('runs builder docgen without the deprecation', async () => {
      const config = await runPreset(false);
      expect(config.plugins).toEqual([{ name: 'svelte-docgen' }, { name: 'svelte-csf' }]);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('when typescript is unusable', () => {
    it('skips builder docgen but still prints the deprecation for docgenServer: false', async () => {
      vi.mocked(getTypeScriptForDocgenError).mockReturnValueOnce(
        new TypeScriptMissingForDocgenError()
      );
      const config = await runPreset(false);
      expect(config.plugins).toEqual([{ name: 'svelte-csf' }]);
      expect(logger.warn).toHaveBeenCalledExactlyOnceWith(SVELTE_BUILDER_DOCGEN_DEPRECATION);
    });
  });

  it('prints the builder deprecation once across repeated preset calls', async () => {
    await runPreset(false);
    await runPreset(false);
    expect(svelteDocgen).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledExactlyOnceWith(SVELTE_BUILDER_DOCGEN_DEPRECATION);
  });
});
