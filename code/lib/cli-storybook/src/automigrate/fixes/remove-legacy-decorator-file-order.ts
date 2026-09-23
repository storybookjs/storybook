import { readConfig } from 'storybook/internal/csf-tools';

import picocolors from 'picocolors';

import { assertConfigMutationSuccess } from '../helpers/config-object.ts';
import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';

export const removeLegacyDecoratorFileOrder: Fix = {
  id: 'remove-legacy-decorator-file-order',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#featureslegacydecoratorfileorder-removed',

  async check({ mainConfigPath }) {
    if (!mainConfigPath) {
      return null;
    }

    try {
      const config = await readConfig(mainConfigPath);
      const value = config.get(['features', 'legacyDecoratorFileOrder']);
      assertConfigMutationSuccess(config);

      if (value === undefined) {
        return null;
      }

      return {};
    } catch {
      return null;
    }
  },

  prompt: () =>
    `${picocolors.cyan('features.legacyDecoratorFileOrder')} has been removed in Storybook 11 and will be removed from your configuration.`,

  async run({ dryRun, mainConfigPath }) {
    await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
      main.remove(['features', 'legacyDecoratorFileOrder']);
    });
  },
};
