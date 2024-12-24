import picocolors from 'picocolors';
import { lt } from 'semver';
import { dedent } from 'ts-dedent';

import { createBlocker } from './types';

export const blocker = createBlocker({
  id: 'minimumNode16',
  async check() {
    const nodeVersion = process.versions.node;
    if (nodeVersion && lt(nodeVersion, '18.0.0')) {
      return { nodeVersion };
    }
    return false;
  },
  log(options, data) {
    return dedent`
      We've detected you're using Node.js v${data.nodeVersion}.
      Storybook needs Node.js 18 or higher.

      ${picocolors.yellow('https://nodejs.org/en/download')}
    `;
  },
});
