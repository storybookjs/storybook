import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  createStorybook,
  legacyPreset,
  type Storybook,
  type StorybookConfig,
} from 'storybook/internal/instance';

const CONFIG_DIR = fileURLToPath(
  new URL('../../../../core/src/instance/__fixtures__/first', import.meta.url)
);
const CONFIGS: Record<string, Partial<StorybookConfig>> = {
  legacy: {
    framework: legacyPreset(
      fileURLToPath(new URL('./__fixtures__/legacy-react-vite-framework', import.meta.url)),
      'framework'
    ),
    core: { disableWhatsNewNotifications: true },
  },
  native: {
    framework: '@storybook/react-vite',
    features: { docgenServer: true, componentsManifest: true },
  },
  options: {
    framework: {
      name: '@storybook/html-vite',
      options: { builder: { viteConfigPath: 'custom.ts' } },
    },
    core: { crossOriginIsolated: true },
    features: { sidebarOnboardingChecklist: false },
  },
};

describe('concurrent createStorybook', () => {
  // Addon and preset modules load only during the first setup in a worker, so the widest case runs first.
  it.each([
    { names: ['legacy', 'native', 'options'] },
    { names: ['legacy', 'native'] },
    { names: ['native', 'legacy'] },
    { names: ['options', 'options', 'legacy'] },
  ])('resolves $names concurrently as each alone', async ({ names }) => {
    const results = await resolve(names);
    const alone: Record<string, unknown> = {};
    for (const name of new Set(names)) {
      [alone[name]] = await resolve([name]);
    }
    expect(results).toEqual(names.map((name) => alone[name]));
  });
});

async function resolve(names: string[]): Promise<unknown[]> {
  const instances = names.map((name) =>
    createStorybook({
      configDir: CONFIG_DIR,
      mode: 'headless',
      main: { ...CONFIGS[name], stories: [] },
    })
  );
  try {
    await Promise.all(instances.map((storybook) => storybook.ready()));
    return await Promise.all(instances.map(read));
  } finally {
    await Promise.all(instances.map((storybook) => storybook.close()));
  }
}

async function read(storybook: Storybook): Promise<unknown> {
  const core = await storybook.presets.apply('core', {});
  return {
    core: {
      ...core,
      ...(core.channelOptions && {
        channelOptions: { ...core.channelOptions, wsToken: typeof core.channelOptions.wsToken },
      }),
    },
    framework: await storybook.presets.apply('framework'),
    frameworkOptions: await storybook.presets.apply('frameworkOptions'),
    features: storybook.options.features,
  };
}
