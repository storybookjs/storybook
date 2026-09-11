import { MIN_SUPPORTED_NODE_DESCRIPTION, isNodeVersionSupported } from 'storybook/internal/common';

import { createBlocker } from './types.ts';

export const blocker = createBlocker({
  id: 'minimumNode22',
  async check() {
    const nodeVersion = process.versions.node;
    if (nodeVersion) {
      const [major, minor, patch] = nodeVersion.split('.').map(Number);
      if (!isNodeVersionSupported(major, minor, patch)) {
        return { nodeVersion };
      }
    }
    return false;
  },
  log(data) {
    return {
      title: 'Node.js 22.12 or higher required',
      message: `We've detected you're using Node.js v${data.nodeVersion}. Storybook requires Node.js ${MIN_SUPPORTED_NODE_DESCRIPTION}.`,
      link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#nodejs-2212-or-higher',
    };
  },
});
