import { readFile, writeFile } from 'node:fs/promises';

import { dedent } from 'ts-dedent';

import {
  type BannerConfig,
  analyzeCompatibilityNeeds,
  bannerComment,
  containsESMUsage,
  getRequireBanner,
  hasRequireBanner,
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
    const isWithBanner = hasRequireBanner(content);

    // Check if the file is ESM format based on content
    if (!isESM) {
      return null;
    }

    // Check if the file already has the require banner
    if (isWithBanner) {
      return null;
    }

    // Analyze what compatibility features are needed
    const compatibilityNeeds = analyzeCompatibilityNeeds(content);

    // Check if any compatibility features are needed
    if (compatibilityNeeds.needsRequire || compatibilityNeeds.needsDirname) {
      return compatibilityNeeds;
    }

    return null;
  },

  prompt() {
    return dedent`Main config is ESM but uses 'require' or '__dirname'. This will break in Storybook 10; Adding compatibility banner`;
  },

  async run({ dryRun, mainConfigPath }) {
    if (dryRun) {
      return;
    }

    const content = await readFile(mainConfigPath, 'utf-8');
    const compatibilityNeeds = analyzeCompatibilityNeeds(content);
    const banner = getRequireBanner(compatibilityNeeds);
    const comment = bannerComment;

    const newContent = [banner, comment, content].join('\n');

    await writeFile(mainConfigPath, newContent);
  },
} satisfies Fix<BannerConfig>;
