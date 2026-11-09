import * as memfs from 'memfs';
import { dirname } from 'pathe';
import { describe, expect, it, vi } from 'vitest';

import { buildStaticStandalone } from './build-static.ts';
import { defaultFavicon } from './utils/constants.ts';

vi.mock('node:fs', () => import('memfs'));
vi.mock('node:fs/promises', () => import('memfs').then(({ fs }) => fs.promises));

vi.mock(import('storybook/internal/common'), async (importOriginal) => ({
  ...(await importOriginal()),
  loadMainConfig: async () => ({ stories: [], framework: 'test-framework' }),
  loadAllPresets: async () => ({
    apply: async (key: string) => {
      const { defaultStaticDirs } = await import('./utils/constants.ts');
      const presetValues: Record<string, unknown> = {
        core: { disableProjectJson: true },
        staticDirs: defaultStaticDirs,
      };
      return presetValues[key] ?? ({} as any);
    },
  }),
}));
vi.mock('storybook/internal/node-logger', () => ({
  logger: { step: vi.fn(), info: vi.fn(), warn: vi.fn(), trace: vi.fn(), error: vi.fn() },
}));
vi.mock('./utils/get-builders.ts', () => ({
  getBuilders: async () => [{ build: async () => {} }, { build: async () => {} }],
}));
vi.mock('./utils/apply-services-preset-once.ts', () => ({ applyServicesPresetOnce: vi.fn() }));
vi.mock('./utils/index-json.ts', () => ({ writeIndexJson: vi.fn() }));

describe('buildStaticStandalone', () => {
  it('copies the common assets to `sb-common-assets` and only the favicon to the root', async () => {
    const configDir = '/project/.storybook';
    const outputDir = '/project/storybook-static';
    const assetsDir = dirname(defaultFavicon);

    vi.spyOn(process, 'cwd').mockReturnValue('/project');

    memfs.vol.fromNestedJSON({
      [assetsDir]: {
        'favicon.svg': 'favicon',
        'favicon-wrapper.svg': 'favicon-wrapper',
        'nunito-sans-regular.woff2': 'regular',
        'nunito-sans-italic.woff2': 'italic',
        'nunito-sans-bold.woff2': 'bold',
        'nunito-sans-bold-italic.woff2': 'bold-italic',
      },
      [configDir]: {},
    });

    expect(memfs.vol.toJSON(outputDir, {}, true)).toMatchInlineSnapshot(`{}`);

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
});
