import * as fsp from 'node:fs/promises';
import { join } from 'node:path';

import { expect, it, vi } from 'vitest';

import { loadConfig } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { addonGlobalsApi } from './addon-globals-api.ts';

vi.mock('node:fs/promises', async () => import('../../../../../__mocks__/fs/promises.ts'));

it('does not write any files when a story cannot be migrated safely', async () => {
  const previewConfigPath = join('.storybook', 'preview.js');
  const safeStoryPath = 'Button.stories.ts';
  const unsafeStoryPath = 'Card.stories.ts';
  const secondUnsafeStoryPath = 'Avatar.stories.ts';
  const previewConfig = dedent`
    export default {
      parameters: {
        backgrounds: {
          disable: false,
        },
      },
    };
  `;
  const safeStory = dedent`
    export default { title: 'Button' };
    export const Primary = {
      parameters: { backgrounds: { disable: true } },
    };
  `;
  const unsafeStory = dedent`
    export default { title: 'Card' };
    export const Primary = {
      parameters: { backgrounds: { disable: true } },
      ...base,
    };
  `;
  vi.mocked<typeof import('../../../../../__mocks__/fs/promises')>(fsp as never).__setMockFiles({
    [previewConfigPath]: previewConfig,
    [safeStoryPath]: safeStory,
    [unsafeStoryPath]: unsafeStory,
    [secondUnsafeStoryPath]: unsafeStory,
  });

  await expect(
    addonGlobalsApi.run?.({
      result: {
        previewConfig: loadConfig(previewConfig).parse(),
        previewConfigPath,
        needsViewportMigration: false,
        needsBackgroundsMigration: true,
        viewportsOptions: undefined,
        backgroundsOptions: { disable: false },
      },
      dryRun: false,
      storiesPaths: [safeStoryPath, secondUnsafeStoryPath, unsafeStoryPath],
      packageManager: {} as never,
    } as never)
  ).rejects.toThrow(
    'Failed to process 2 files:\n- Avatar.stories.ts:\n  - Cannot mutate parameters.backgrounds.values because the target contains spread field\n- Card.stories.ts:\n  - Cannot mutate parameters.backgrounds.values because the target contains spread field'
  );

  await expect(fsp.readFile(previewConfigPath, 'utf-8')).resolves.toBe(previewConfig);
  await expect(fsp.readFile(safeStoryPath, 'utf-8')).resolves.toBe(safeStory);
  await expect(fsp.readFile(unsafeStoryPath, 'utf-8')).resolves.toBe(unsafeStory);
  await expect(fsp.readFile(secondUnsafeStoryPath, 'utf-8')).resolves.toBe(unsafeStory);
  await expect(
    addonGlobalsApi.check({
      packageManager: {} as never,
      configDir: '',
      mainConfig: {} as never,
      storybookVersion: '10.0.0',
      previewConfigPath,
      storiesPaths: [safeStoryPath, secondUnsafeStoryPath, unsafeStoryPath],
      hasCsfFactoryPreview: false,
    })
  ).resolves.not.toBeNull();
});
