import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock(import('./plugins/react-docgen.ts'), { spy: true });

import * as reactDocgenModule from './plugins/react-docgen.ts';
import { viteFinal } from './preset.ts';

type ViteFinalOptions = Parameters<typeof viteFinal>[1];

const createTypescriptPresetOptions = (
  reactDocgenOptions: Record<string, unknown>
): ViteFinalOptions =>
  ({
    presets: {
      apply: async (name: string) =>
        name === 'typescript' ? { reactDocgen: 'react-docgen', reactDocgenOptions } : undefined,
    },
  }) as ViteFinalOptions;

describe('react-vite preset', () => {
  beforeEach(() => {
    vi.mocked(reactDocgenModule.reactDocgen)
      .mockReset()
      .mockResolvedValue({ name: 'storybook:react-docgen-plugin' });
  });

  it('passes reactDocgenOptions to the react-docgen plugin', async () => {
    const existingPlugin = { name: 'existing-plugin' };
    const reactDocgenOptions = {
      exclude: [/node_modules\/.*/, /packages\/.*/],
    };

    const config = await viteFinal(
      { plugins: [existingPlugin] },
      createTypescriptPresetOptions(reactDocgenOptions)
    );

    expect(reactDocgenModule.reactDocgen).toHaveBeenCalledWith({
      include: /\.(mjs|tsx?|jsx?)$/,
      ...reactDocgenOptions,
    });
    expect(config.plugins).toEqual([{ name: 'storybook:react-docgen-plugin' }, existingPlugin]);
  });

  it('allows reactDocgenOptions to override the default include pattern', async () => {
    const reactDocgenOptions = {
      include: /\.jsx$/,
      exclude: [/packages\/.*/],
    };

    await viteFinal({}, createTypescriptPresetOptions(reactDocgenOptions));

    expect(reactDocgenModule.reactDocgen).toHaveBeenCalledWith(reactDocgenOptions);
  });
});
