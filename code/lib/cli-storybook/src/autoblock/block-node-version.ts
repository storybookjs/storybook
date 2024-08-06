import { createBlocker } from './types';
import { dedent } from 'ts-dedent';
import { lt } from 'semver';
import chalk from 'chalk';

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

      ${chalk.yellow('https://nodejs.org/en/download')}
    `;
  },
});
