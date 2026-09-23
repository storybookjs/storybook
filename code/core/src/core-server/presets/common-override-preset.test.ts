import { describe, expect, it, vi } from 'vitest';

import { once } from 'storybook/internal/node-logger';
import type { Options } from 'storybook/internal/types';

import { Channel } from '../../channels/main.ts';

import * as overridePreset from './common-override-preset.ts';

vi.mock('../utils/remove-mdx-entries.ts', () => ({ removeMDXEntries: vi.fn() }));
vi.mock('storybook/internal/node-logger', () => ({ once: { warn: vi.fn() } }));

const frameworks = [
  ['@storybook/react-vite', '@storybook/react', true],
  ['@storybook/react-webpack5', '@storybook/react', true],
  ['@storybook/nextjs', '@storybook/react', true],
  ['@storybook/nextjs-vite', '@storybook/react', true],
  ['@storybook/tanstack-react', '@storybook/react', true],
  ['@storybook/react-native-web-vite', '@storybook/react', true],
  ['storybook-react-rsbuild', '@storybook/react', true],
  ['@storybook/vue3-vite', '@storybook/vue3', true],
  ['@storybook/angular-vite', '@storybook/angular', true],
  ['@storybook/html-vite', '@storybook/html', false],
  ['@storybook/svelte-vite', '@storybook/svelte', false],
  ['@storybook/angular', '@storybook/angular', false],
  ['@storybook-vue/nuxt', '@storybook/vue3', false],
  ['storybook-vue3-rsbuild', '@storybook/vue3', false],
] as const;

async function resolveFeatures(
  framework: string,
  renderer: string,
  input: Record<string, boolean> = {},
  legacy: {
    reactDocgen?: false | 'react-docgen' | 'react-docgen-typescript';
    reactDocgenTypescriptOptions?: { propFilter: () => boolean };
    docgen?: boolean | string | { plugin: string; tsconfig?: string };
    compodoc?: boolean;
  } = {}
) {
  const configs = new Map<string, object>([
    ['framework', { name: framework, options: legacy }],
    ['core', { renderer }],
    ['frameworkOptions', legacy],
    ['typescript', legacy],
  ]);
  const options: Options = {
    configDir: '/project/.storybook',
    channel: new Channel({}),
    presets: { apply: vi.fn().mockImplementation(async (key: string) => configs.get(key)) },
  };
  return overridePreset.features(input, options);
}

describe('SB11 docgen server defaults', () => {
  it.each(frameworks)('resolves the default for %s', async (framework, renderer, enabled) => {
    expect(await resolveFeatures(framework, renderer)).toMatchObject({ docgenServer: enabled });
  });

  it.each(frameworks)('preserves explicit opt-out for %s', async (framework, renderer) => {
    expect(await resolveFeatures(framework, renderer, { docgenServer: false })).toMatchObject({
      docgenServer: false,
    });
  });

  it.each([true, false])('preserves deprecated flag %s', async (enabled) => {
    expect(
      await resolveFeatures('@storybook/react-vite', '@storybook/react', {
        experimentalDocgenServer: enabled,
      })
    ).toMatchObject({ docgenServer: enabled });
  });

  it.each([true, false])('stable %s wins over the deprecated flag', async (enabled) => {
    expect(
      await resolveFeatures('@storybook/react-vite', '@storybook/react', {
        docgenServer: enabled,
        experimentalDocgenServer: !enabled,
      })
    ).toMatchObject({ docgenServer: enabled });
  });

  it.each([false, 'react-docgen-typescript'] as const)(
    'preserves React legacy extraction choice %s',
    async (reactDocgen) => {
      expect(
        await resolveFeatures('@storybook/react-vite', '@storybook/react', {}, { reactDocgen })
      ).toMatchObject({ docgenServer: false });
    }
  );

  it.each([true, false, 'vue-component-meta', 'vue-docgen-api'] as const)(
    'preserves Vue legacy extraction choice %s',
    async (docgen) => {
      expect(
        await resolveFeatures('@storybook/vue3-vite', '@storybook/vue3', {}, { docgen })
      ).toMatchObject({ docgenServer: false });
    }
  );

  it('does not activate service-backed Docs for an unsupported renderer', async () => {
    expect(
      await resolveFeatures('@storybook/html-vite', '@storybook/html', { docgenServer: true })
    ).toMatchObject({ docgenServer: false });
    expect(once.warn).toHaveBeenCalledWith(
      'features.docgenServer is not supported by @storybook/html-vite. Server-side docgen remains disabled. Remove this feature flag from your main config.'
    );
  });

  it('does not warn for an unsupported renderer when the feature is explicitly disabled', async () => {
    expect(
      await resolveFeatures('@storybook/html-vite', '@storybook/html', { docgenServer: false })
    ).toMatchObject({ docgenServer: false });
    expect(once.warn).not.toHaveBeenCalled();
  });

  it.each([
    '/project/node_modules/@storybook/react-webpack5',
    'C:\\project\\node_modules\\@storybook\\react-vite',
    '/project/node_modules/.pnpm/@storybook+react-vite@10.6.0/node_modules/@storybook/react-vite',
  ])('recognizes an absolute framework path %s', async (framework) => {
    expect(await resolveFeatures(framework, '@storybook/react')).toMatchObject({
      docgenServer: true,
    });
  });

  it('preserves unrelated features and removes the deprecated field after normalization', async () => {
    expect(
      await resolveFeatures('@storybook/react-vite', '@storybook/react', {
        experimentalDocgenServer: false,
        componentsManifest: true,
      })
    ).toEqual({ docgenServer: false, componentsManifest: true });
    expect(once.warn).toHaveBeenCalledWith(
      'features.experimentalDocgenServer is deprecated and will be removed in Storybook 12. Use features.docgenServer in your main config instead.'
    );
  });

  it('preserves an active RDT propFilter', async () => {
    expect(
      await resolveFeatures(
        '@storybook/react-vite',
        '@storybook/react',
        {},
        {
          reactDocgen: 'react-docgen-typescript',
          reactDocgenTypescriptOptions: { propFilter: () => false },
        }
      )
    ).toMatchObject({ docgenServer: false });
  });

  it('does not mistake inactive RDT options for customization', async () => {
    expect(
      await resolveFeatures(
        '@storybook/react-vite',
        '@storybook/react',
        {},
        {
          reactDocgen: 'react-docgen',
          reactDocgenTypescriptOptions: { propFilter: () => false },
        }
      )
    ).toMatchObject({ docgenServer: true });
    expect(once.warn).not.toHaveBeenCalled();
  });

  it('preserves Vue custom tsconfig', async () => {
    expect(
      await resolveFeatures(
        '@storybook/vue3-vite',
        '@storybook/vue3',
        {},
        {
          docgen: { plugin: 'vue-component-meta', tsconfig: 'tsconfig.docs.json' },
        }
      )
    ).toMatchObject({ docgenServer: false });
  });

  it('does not treat Angular compodoc false as a server opt-out', async () => {
    expect(
      await resolveFeatures(
        '@storybook/angular-vite',
        '@storybook/angular',
        {},
        {
          compodoc: false,
        }
      )
    ).toMatchObject({ docgenServer: true });
  });

  it('keeps an explicit opt-out without legacy-setting guidance', async () => {
    expect(
      await resolveFeatures(
        '@storybook/react-vite',
        '@storybook/react',
        { docgenServer: false },
        { reactDocgen: false }
      )
    ).toMatchObject({ docgenServer: false });
    expect(once.warn).not.toHaveBeenCalled();
  });

  it.each(['docgenServer', 'experimentalDocgenServer'])(
    '%s opt-in overrides legacy settings with guidance',
    async (flag) => {
      expect(
        await resolveFeatures(
          '@storybook/react-vite',
          '@storybook/react',
          { [flag]: true },
          {
            reactDocgen: false,
          }
        )
      ).toMatchObject({ docgenServer: true });
      expect(once.warn).toHaveBeenCalledWith(
        'features.docgenServer: true ignores typescript.reactDocgen, reactDocgenTypescriptOptions, and framework.options.docgen. Set features.docgenServer: false to keep your legacy extractor settings. The server does not translate RDT propFilter or Vue docgen tsconfig options.'
      );
    }
  );
});
