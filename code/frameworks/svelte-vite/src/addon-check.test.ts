import { SvelteCsfAddonInstalledError } from 'storybook/internal/server-errors';
import { describe, expect, it } from 'vitest';

import { assertSvelteCsfAddonNotInstalled } from './addon-check.ts';

const addonPreset = '/project/node_modules/@storybook/addon-svelte-csf/dist/preset.js';

function getError(params: Parameters<typeof assertSvelteCsfAddonNotInstalled>[0]) {
  try {
    assertSvelteCsfAddonNotInstalled(params);
  } catch (error) {
    return error;
  }
}

describe(assertSvelteCsfAddonNotInstalled.name, () => {
  it('passes without the addon', () => {
    expect(
      getError({
        presetsList: [
          {
            name: '/project/node_modules/@storybook/addon-docs/dist/preset.js',
            options: {},
            preset: {},
          },
        ],
        framework: '@storybook/svelte-vite',
      })
    ).toBeUndefined();
  });

  it('fails for the addon added as a string, and names the framework package', () => {
    const error = getError({
      presetsList: [{ name: addonPreset, options: {}, preset: {} }],
      framework: '@storybook/sveltekit',
    });

    expect(error).toBeInstanceOf(SvelteCsfAddonInstalledError);
    expect((error as Error).message).toContain('import defineMeta from "@storybook/sveltekit"');
    expect((error as Error).message).not.toContain('legacyTemplate');
  });

  it('fails for the addon added with options, and mentions legacyTemplate when it is set', () => {
    const error = getError({
      presetsList: [{ name: addonPreset, options: { legacyTemplate: true }, preset: {} }],
      framework: { name: '@storybook/svelte-vite' },
    });

    expect(error).toBeInstanceOf(SvelteCsfAddonInstalledError);
    expect((error as Error).message).toContain('"legacyTemplate: true"');
  });

  it('names the framework package when the framework is an absolute path', () => {
    const error = getError({
      presetsList: [
        {
          name: '/project/node_modules/.pnpm/@storybook+addon-svelte-csf@5.1.5/node_modules/@storybook/addon-svelte-csf/dist/preset.js',
          options: {},
          preset: {},
        },
      ],
      framework: '/project/node_modules/@storybook/svelte-vite',
    });

    expect((error as Error).message).toContain('import defineMeta from "@storybook/svelte-vite"');
  });
});
