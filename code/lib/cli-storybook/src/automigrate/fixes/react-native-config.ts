import { existsSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import { join } from 'node:path';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

interface Options {
  storybookDir: string;
  rnStorybookDir: string;
}

export const reactNativeConfig: Fix<Options> = {
  id: 'react-native-config',

  versionRange: ['<9.0.0', '>=9.0.0'],

  async check({ packageManager, mainConfigPath }) {
    const allDependencies = await packageManager.getAllDependencies();

    if (!allDependencies['@storybook/react-native']) {
      return null;
    }

    // Check if .storybook directory exists
    const projectDir = mainConfigPath ? join(mainConfigPath, '..', '..') : process.cwd();
    const storybookDir = join(projectDir, '.storybook');
    const rnStorybookDir = join(projectDir, '.rnstorybook');

    if (existsSync(storybookDir) && !existsSync(rnStorybookDir)) {
      return { storybookDir, rnStorybookDir };
    }

    return null;
  },

  prompt() {
    return dedent`
      In Storybook 9, React Native projects use the ${picocolors.yellow('.rnstorybook')} directory for
      configuration instead of ${picocolors.yellow('.storybook')}.

      More info: ${picocolors.cyan('https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-native-config-dir-renamed')}

      Would you like to automatically move your config files to the new location?`;
  },

  async run({ result: { storybookDir, rnStorybookDir }, dryRun }) {
    if (!dryRun) {
      await rename(storybookDir, rnStorybookDir);
    }
  },
};
