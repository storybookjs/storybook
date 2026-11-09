import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Options } from 'storybook/internal/types';

import {
  isReactBuilderDocgenPackageInstalled,
  prepareReactBuilderDocgen,
} from '@storybook/react/internal/builder-docgen';

import { viteFinal } from './preset.ts';

vi.mock('@storybook/react/internal/builder-docgen', { spy: true });

const optionsWith = (typescript: Record<string, unknown>) =>
  ({
    configDir: '/project/.storybook',
    presets: {
      apply: async (name: string) =>
        name === 'features' ? { docgenServer: false } : name === 'typescript' ? typescript : {},
    },
  }) as unknown as Options;

const pluginNames = (config: { plugins?: unknown[] }) =>
  (config.plugins ?? []).map((plugin) => (plugin as { name: string }).name);

describe('viteFinal with builder docgen', () => {
  beforeEach(() => {
    vi.mocked(isReactBuilderDocgenPackageInstalled).mockReturnValue(true);
  });

  describe('in react-docgen mode', () => {
    beforeEach(() => {
      vi.mocked(prepareReactBuilderDocgen).mockResolvedValue('react-docgen');
    });

    it('adds the react-docgen plugin', async () => {
      const config = await viteFinal({}, optionsWith({ reactDocgen: 'react-docgen' }));

      expect(pluginNames(config)).toEqual(['storybook:react-docgen-plugin']);
      expect(prepareReactBuilderDocgen).toHaveBeenCalledWith(
        expect.objectContaining({ reactDocgen: 'react-docgen', builder: 'vite' })
      );
    });
  });

  describe('in react-docgen-typescript mode', () => {
    beforeEach(() => {
      vi.mocked(prepareReactBuilderDocgen).mockResolvedValue('react-docgen-typescript');
    });

    it('adds react-docgen-typescript, and react-docgen for JavaScript files', async () => {
      const config = await viteFinal({}, optionsWith({ reactDocgen: 'react-docgen-typescript' }));

      expect(pluginNames(config)).toEqual([
        'storybook:react-docgen-plugin',
        'vite:react-docgen-typescript',
      ]);
    });

    describe('without react-docgen', () => {
      beforeEach(() => {
        vi.mocked(isReactBuilderDocgenPackageInstalled).mockReturnValue(false);
      });

      it('skips the pass over JavaScript files', async () => {
        const config = await viteFinal({}, optionsWith({ reactDocgen: 'react-docgen-typescript' }));

        expect(pluginNames(config)).toEqual(['vite:react-docgen-typescript']);
      });
    });
  });

  describe('when builder docgen must not run', () => {
    beforeEach(() => {
      vi.mocked(prepareReactBuilderDocgen).mockResolvedValue(undefined);
    });

    it('leaves the config alone', async () => {
      const input = { plugins: [] };

      await expect(viteFinal(input, optionsWith({ reactDocgen: 'react-docgen' }))).resolves.toBe(
        input
      );
    });
  });

  it('skips the package check when docgen is disabled', async () => {
    await viteFinal({}, optionsWith({ reactDocgen: false }));

    expect(prepareReactBuilderDocgen).not.toHaveBeenCalled();
  });
});
