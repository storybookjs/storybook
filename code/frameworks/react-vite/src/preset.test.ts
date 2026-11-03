import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkReactBuilderDocgenPackages,
  getTypeScriptForDocgenError,
  isPackageResolvable,
} from 'storybook/internal/common';
import type { Options } from 'storybook/internal/types';

import { viteFinal } from './preset.ts';

vi.mock('storybook/internal/common', { spy: true });

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
    vi.mocked(checkReactBuilderDocgenPackages).mockResolvedValue([]);
    vi.mocked(getTypeScriptForDocgenError).mockReturnValue(undefined);
    vi.mocked(isPackageResolvable).mockReturnValue(true);
  });

  it('adds the react-docgen plugin', async () => {
    const config = await viteFinal({}, optionsWith({ reactDocgen: 'react-docgen' }));

    expect(pluginNames(config)).toEqual(['storybook:react-docgen-plugin']);
  });

  it('leaves the config alone when builder docgen packages are missing', async () => {
    vi.mocked(checkReactBuilderDocgenPackages).mockResolvedValue(['react-docgen']);
    const input = { plugins: [] };

    await expect(viteFinal(input, optionsWith({ reactDocgen: 'react-docgen' }))).resolves.toBe(
      input
    );
  });

  it('checks the react-docgen-typescript packages in that mode', async () => {
    await viteFinal({}, optionsWith({ reactDocgen: 'react-docgen-typescript' }));

    expect(checkReactBuilderDocgenPackages).toHaveBeenCalledWith(
      expect.objectContaining({
        packages: ['@joshwooding/vite-plugin-react-docgen-typescript', 'react-docgen-typescript'],
      })
    );
  });

  it('skips the react-docgen pass over JavaScript files when react-docgen is missing', async () => {
    vi.mocked(isPackageResolvable).mockReturnValue(false);

    const config = await viteFinal({}, optionsWith({ reactDocgen: 'react-docgen-typescript' }));

    expect(pluginNames(config)).toEqual(['vite:react-docgen-typescript']);
  });

  it('checks react-docgen instead when typescript is unusable', async () => {
    vi.mocked(getTypeScriptForDocgenError).mockReturnValue(new Error('TypeScript 7') as never);

    await viteFinal({}, optionsWith({ reactDocgen: 'react-docgen-typescript' }));

    expect(checkReactBuilderDocgenPackages).toHaveBeenCalledWith(
      expect.objectContaining({ packages: ['react-docgen'] })
    );
  });
});
