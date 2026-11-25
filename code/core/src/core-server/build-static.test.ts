import * as memfs from 'memfs';
import { dirname } from 'pathe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildStaticStandalone } from './build-static.ts';
import { defaultFavicon } from './utils/constants.ts';

const mainConfig = vi.hoisted(() => ({
  staticDirs: [] as string[],
  favicon: undefined as string | undefined,
}));

vi.mock('node:fs', () => import('memfs'));
vi.mock('node:fs/promises', () => import('memfs').then(({ fs }) => fs.promises));

vi.mock(import('storybook/internal/common'), async (importOriginal) => ({
  ...(await importOriginal()),
  loadMainConfig: async () => ({ stories: [], framework: 'test-framework' }),
  loadAllPresets: async ({ configDir }: { configDir: string }) => {
    const { defaultStaticDirs } = await import('./utils/constants.ts');
    const { favicon } = await import('./presets/common-preset.ts');
    const staticDirs = [...defaultStaticDirs, ...mainConfig.staticDirs];

    const presets = {
      apply: async (key: string) => {
        const presetValues: Record<string, () => unknown> = {
          core: () => ({ disableProjectJson: true }),
          staticDirs: () => staticDirs,
          favicon: () => favicon(mainConfig.favicon, { presets, configDir } as any),
        };
        return presetValues[key]?.() ?? ({} as any);
      },
    };
    return presets;
  },
}));
vi.mock('storybook/internal/node-logger', () => ({
  logger: {
    step: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    error: vi.fn(),
  },
}));
vi.mock('./utils/get-builders.ts', () => ({
  getBuilders: async () => [{ build: async () => {} }, { build: async () => {} }],
}));
vi.mock('./utils/apply-services-preset-once.ts', () => ({ applyServicesPresetOnce: vi.fn() }));
vi.mock('./utils/index-json.ts', () => ({ writeIndexJson: vi.fn() }));

const configDir = '/project/.storybook';
const outputDir = '/project/storybook-static';

beforeEach(() => {
  mainConfig.staticDirs = [];
  mainConfig.favicon = undefined;

  memfs.vol.reset();
  memfs.vol.fromNestedJSON({
    [dirname(defaultFavicon)]: {
      'favicon.svg': 'favicon',
      'favicon-wrapper.svg': 'favicon-wrapper',
      'nunito-sans-regular.woff2': 'regular',
      'nunito-sans-italic.woff2': 'italic',
      'nunito-sans-bold.woff2': 'bold',
      'nunito-sans-bold-italic.woff2': 'bold-italic',
    },
    [configDir]: {},
  });
});

describe('buildStaticStandalone', () => {
  it('copies the common assets to `sb-common-assets` and only the favicon to the root', async () => {
    await buildStaticStandalone({ configDir, outputDir, test: true });

    expect(memfs.vol.toJSON(outputDir, {}, true)).toMatchInlineSnapshot(`
      {
        "favicon.svg": "favicon",
        "sb-common-assets/favicon-wrapper.svg": "favicon-wrapper",
        "sb-common-assets/favicon.svg": "favicon",
        "sb-common-assets/nunito-sans-bold-italic.woff2": "bold-italic",
        "sb-common-assets/nunito-sans-bold.woff2": "bold",
        "sb-common-assets/nunito-sans-italic.woff2": "italic",
        "sb-common-assets/nunito-sans-regular.woff2": "regular",
      }
    `);
  });

  it('keeps a custom favicon from `staticDirs` at the root', async () => {
    mainConfig.staticDirs = ['../static'];
    memfs.vol.fromNestedJSON({ '/project/static': { 'favicon.svg': 'custom-favicon' } });

    await buildStaticStandalone({ configDir, outputDir, test: true });

    expect(memfs.vol.toJSON(outputDir, {}, true)).toMatchObject({
      'favicon.svg': 'custom-favicon',
      'sb-common-assets/favicon.svg': 'favicon',
    });
  });

  it('copies a `favicon` set outside `staticDirs` under its own name', async () => {
    mainConfig.favicon = '/brand/brand.svg';
    memfs.vol.fromNestedJSON({ '/brand': { 'brand.svg': 'brand-favicon' } });

    await buildStaticStandalone({ configDir, outputDir, test: true });

    const output = memfs.vol.toJSON(outputDir, {}, true);
    expect(output).toMatchObject({ 'brand.svg': 'brand-favicon' });
    expect(output).not.toHaveProperty('favicon.svg');
  });
});
