import { readFile, writeFile } from 'node:fs/promises';

import { dedent } from 'ts-dedent';

import {
  bannerComment,
  containsESMUsage,
  containsRequireUsage,
  getRequireBanner,
  hasCreateRequireImport,
  hasRequireBanner,
  hasRequireDefinition,
} from '../helpers/mainConfigFile';
import type { Fix } from '../types';

export const fixFauxEsmRequire = {
  id: 'fix-faux-esm-require',
  link: 'https://storybook.js.org/docs/faq#how-do-i-fix-module-resolution-in-special-environments',

  async check({ mainConfigPath }) {
    if (!mainConfigPath) {
      return null;
    }

    // Read the raw file content to check for ESM syntax and require usage
    const content = await readFile(mainConfigPath, 'utf-8');

    const isESM = containsESMUsage(content);
    const isWithRequire = containsRequireUsage(content);
    const isWithBanner = hasRequireBanner(content);

    // Check if the file is ESM format based on content
    if (!isESM) {
      return null;
    }

    // Check if the file already has the require banner
    if (isWithBanner) {
      return null;
    }

    // Check if the file contains require usage
    if (!isWithRequire) {
      return null;
    }

    // Check if the file already has createRequire imported and require defined
    // If so, the user has already set up require properly and we don't need to add the banner
    const hasCreateRequire = hasCreateRequireImport(content);
    const hasRequire = hasRequireDefinition(content);

    if (hasCreateRequire && hasRequire) {
      return null;
    }

    return true;
  },

  prompt() {
    return dedent`Main config is ESM but uses 'require'. This will break in Storybook 10; Adding compatibility banner`;
  },

  async run({ dryRun, mainConfigPath }) {
    if (dryRun) {
      return;
    }

    const content = await readFile(mainConfigPath, 'utf-8');
    const banner = getRequireBanner();
    const comment = bannerComment;

    const newContent = [banner, comment, content].join('\n');

    await writeFile(mainConfigPath, newContent);
  },
} satisfies Fix<true>;
