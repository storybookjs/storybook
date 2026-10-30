import { describe, expect, it } from 'vitest';

import { assertSvelteCsfAddonNotInstalledOnInstance } from './addon-check.ts';
import { SvelteCsfAddonInstalledError } from './errors.ts';

const addonPreset = '/project/node_modules/@storybook/addon-svelte-csf/dist/preset.js';

describe(assertSvelteCsfAddonNotInstalledOnInstance.name, () => {
  it.each<{
    name: string;
    addons: (string | { name: string; options?: Record<string, unknown> })[];
    framework: string | { name: string };
    expected: { thrown: boolean; contains?: string; excludes?: string };
  }>([
    {
      name: 'passes without the addon',
      addons: [{ name: '@storybook/addon-docs' }],
      framework: '@storybook/svelte-vite',
      expected: { thrown: false },
    },
    {
      name: 'fails for the addon added as a string, and names the framework package',
      addons: ['@storybook/addon-svelte-csf'],
      framework: '@storybook/sveltekit',
      expected: {
        thrown: true,
        contains: 'import defineMeta from "@storybook/sveltekit"',
        excludes: 'legacyTemplate',
      },
    },
    {
      name: 'fails for the addon added with options, and mentions legacyTemplate when it is set',
      addons: [{ name: addonPreset, options: { legacyTemplate: true } }],
      framework: { name: '@storybook/svelte-vite' },
      expected: { thrown: true, contains: '"legacyTemplate: true"' },
    },
    {
      name: 'names the framework package when the framework is an absolute path',
      addons: [
        {
          name: '/project/node_modules/.pnpm/@storybook+addon-svelte-csf@5.1.5/node_modules/@storybook/addon-svelte-csf/dist/preset.js',
        },
      ],
      framework: '/project/node_modules/@storybook/svelte-vite',
      expected: { thrown: true, contains: 'import defineMeta from "@storybook/svelte-vite"' },
    },
  ])('$name', ({ addons, framework, expected }) => {
    const storybook = {
      // Like `storybook.hasAddon`, match a resolved preset path by its package name.
      hasAddon: (name: string) =>
        addons.some((addon) => (typeof addon === 'string' ? addon : addon.name).includes(name)),
      options: { main: { addons } },
    } as unknown as Parameters<typeof assertSvelteCsfAddonNotInstalledOnInstance>[0]['storybook'];

    let error: unknown;
    try {
      assertSvelteCsfAddonNotInstalledOnInstance({ storybook, framework });
    } catch (caught) {
      error = caught;
    }

    expect(error !== undefined).toBe(expected.thrown);
    if (expected.thrown) {
      expect(error).toBeInstanceOf(SvelteCsfAddonInstalledError);
    }
    if (expected.contains) {
      expect((error as Error).message).toContain(expected.contains);
    }
    if (expected.excludes) {
      expect((error as Error).message).not.toContain(expected.excludes);
    }
  });
});
