import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reactDocgen: vi.fn(),
}));

vi.mock('./plugins/react-docgen.ts', () => ({
  reactDocgen: mocks.reactDocgen,
}));

import { viteFinal } from './preset.ts';

describe('react-vite preset', () => {
  beforeEach(() => {
    mocks.reactDocgen.mockReset().mockResolvedValue({ name: 'storybook:react-docgen-plugin' });
  });

  it('passes reactDocgenOptions to the react-docgen plugin', async () => {
    const existingPlugin = { name: 'existing-plugin' };
    const reactDocgenOptions = {
      exclude: [/node_modules\/.*/, /packages\/.*/],
    };

    const config = await viteFinal({ plugins: [existingPlugin] }, {
      presets: {
        apply: async (name: string) => {
          if (name === 'typescript') {
            return {
              reactDocgen: 'react-docgen',
              reactDocgenOptions,
            };
          }

          return undefined;
        },
      },
    } as any);

    expect(mocks.reactDocgen).toHaveBeenCalledWith({
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

    await viteFinal({}, {
      presets: {
        apply: async (name: string) => {
          if (name === 'typescript') {
            return {
              reactDocgen: 'react-docgen',
              reactDocgenOptions,
            };
          }

          return undefined;
        },
      },
    } as any);

    expect(mocks.reactDocgen).toHaveBeenCalledWith(reactDocgenOptions);
  });
});
