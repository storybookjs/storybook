#!/usr/bin/env node
import { dedent } from 'ts-dedent';

import { logger } from '../../../../core/src/node-logger';

export const IS_NON_CI = process.env.CI !== 'true';
export const IS_NON_STORYBOOK_SANDBOX = process.env.IN_STORYBOOK_SANDBOX !== 'true';

const [majorNodeVersion, minorNodeVersion] = process.versions.node.split('.').map(Number);

if (
  majorNodeVersion < 20 ||
  (majorNodeVersion === 20 && minorNodeVersion < 19) ||
  (majorNodeVersion === 22 && minorNodeVersion < 12)
) {
  logger.error(
    dedent`To run Storybook, you need Node.js version 20.19+ or 22.12+.
      You are currently running Node.js ${process.version}. Please upgrade your Node.js installation.`
  );
  process.exit(1);
}

import('./run');
