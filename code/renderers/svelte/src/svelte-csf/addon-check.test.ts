import { SvelteCsfAddonInstalledError } from 'storybook/internal/server-errors';
import { describe, expect, it } from 'vitest';

import { assertSvelteCsfAddonNotInstalled } from './addon-check.ts';

const addonPreset = '/project/node_modules/@storybook/addon-svelte-csf/dist/preset.js';

describe(assertSvelteCsfAddonNotInstalled.name, () => {
  it('passes without the addon', () => {
    expect(() =>
      assertSvelteCsfAddonNotInstalled({
        presetsList: [
          {
            name: '/project/node_modules/@storybook/addon-docs/dist/preset.js',
            options: {},
            preset: {},
          },
        ],
      })
    ).not.toThrow();
  });

  it('fails for the addon added as a string', () => {
    expect(() =>
      assertSvelteCsfAddonNotInstalled({
        presetsList: [{ name: addonPreset, options: {}, preset: {} }],
      })
    ).toThrow(SvelteCsfAddonInstalledError);
  });

  it('fails for the addon added with options, and mentions legacyTemplate when it is set', () => {
    let error: unknown;
    try {
      assertSvelteCsfAddonNotInstalled({
        presetsList: [{ name: addonPreset, options: { legacyTemplate: true }, preset: {} }],
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(SvelteCsfAddonInstalledError);
    expect((error as Error).message).toContain('"legacyTemplate: true"');
  });

  it('fails for the addon in a pnpm store path', () => {
    expect(() =>
      assertSvelteCsfAddonNotInstalled({
        presetsList: [
          {
            name: '/project/node_modules/.pnpm/@storybook+addon-svelte-csf@5.1.5/node_modules/@storybook/addon-svelte-csf/dist/preset.js',
            options: {},
            preset: {},
          },
        ],
      })
    ).toThrow(SvelteCsfAddonInstalledError);
  });
});
