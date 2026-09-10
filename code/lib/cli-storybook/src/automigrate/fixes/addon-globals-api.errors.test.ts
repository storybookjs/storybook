import * as fsp from 'node:fs/promises';
import { join } from 'node:path';

import { expect, it, vi } from 'vitest';

import { loadConfig } from 'storybook/internal/csf-tools';

import { dedent } from 'ts-dedent';

import { addonGlobalsApi } from './addon-globals-api.ts';

vi.mock('node:fs/promises', async () => import('../../../../../__mocks__/fs/promises.ts'));

it('reports story files that cannot be migrated safely', async () => {
  const previewConfigPath = join('.storybook', 'preview.js');
  const storyPath = 'Button.stories.ts';
  const previewConfig = dedent`
    export default {
      parameters: {
        backgrounds: {
          disable: false,
        },
      },
    };
  `;
  vi.mocked<typeof import('../../../../../__mocks__/fs/promises')>(fsp as never).__setMockFiles({
    [previewConfigPath]: previewConfig,
    [storyPath]: dedent`
      export default { title: 'Button' };
      export const Primary = {
        parameters: { backgrounds: { disable: true } },
        ...base,
      };
    `,
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
      dryRun: true,
      storiesPaths: [storyPath],
      packageManager: {} as never,
    } as never)
  ).rejects.toThrow(
    'Failed to process 1 files:\n- Button.stories.ts: Cannot mutate parameters.backgrounds.values because the target contains spread field'
  );
});
