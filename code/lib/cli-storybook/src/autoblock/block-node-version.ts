import { lt } from 'semver';

import { createBlocker } from './types';

export const blocker = createBlocker({
  id: 'minimumNode20',
  async check() {
    const nodeVersion = process.versions.node;
    if (nodeVersion && lt(nodeVersion, '20.0.0')) {
      return { nodeVersion };
    }
    return false;
  },
  log(data) {
    return {
      title: 'Node.js 20 support removed',
      message: `We've detected you're using Node.js v${data.nodeVersion}. Storybook needs Node.js 20 or higher.`,
      link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#nodejs--20',
    };
  },
});
