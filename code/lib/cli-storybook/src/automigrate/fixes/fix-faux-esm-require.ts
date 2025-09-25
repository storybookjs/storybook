import { readFile, writeFile } from 'node:fs/promises';

import { dedent } from 'ts-dedent';

import {
  containsESMUsage,
  containsRequireUsage,
  getRequireBanner,
  hasRequireBanner,
} from '../helpers/mainConfigFile';
import type { Fix } from '../types';

export interface FixFauxEsmRequireRunOptions {
  storybookVersion: string;
  isConfigTypescript: boolean;
}

export const fixFauxEsmRequire = {
  id: 'fix-faux-esm-require',
  link: 'https://storybook.js.org/docs/faq#how-do-i-fix-module-resolution-in-special-environments',

  async check({ storybookVersion, mainConfigPath }) {
    if (!mainConfigPath) {
      return null;
    }

    // Read the raw file content to check for ESM syntax and require usage
    const content = await readFile(mainConfigPath, 'utf-8');

    // Check if the file is ESM format based on content
    if (!containsESMUsage(mainConfigPath, content)) {
      return null;
    }

    // Check if the file already has the require banner
    if (hasRequireBanner(content)) {
      return null;
    }

    // Check if the file contains require usage
    if (!containsRequireUsage(content)) {
      return null;
    }

    const isConfigTypescript = mainConfigPath.endsWith('.ts') || mainConfigPath.endsWith('.tsx');

    return { storybookVersion, isConfigTypescript };
  },

  prompt() {
    return dedent`We have detected that your main config file is in ESM format but contains 'require' references. This will cause issues in Storybook 10. We'll add a compatibility banner to make it work.`;
  },

  async run({ dryRun, mainConfigPath }) {
    if (dryRun) {
      return;
    }

    const content = await readFile(mainConfigPath, 'utf-8');
    const banner = getRequireBanner();
    const comment =
      '// end of storybook 10 migration assistant header, delete this if you are not using require';

    const newContent = [banner, comment, content].join('\n\n');

    await writeFile(mainConfigPath, newContent);
  },
} satisfies Fix<FixFauxEsmRequireRunOptions>;
