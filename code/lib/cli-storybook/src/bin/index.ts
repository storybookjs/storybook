#!/usr/bin/env node
import { MIN_SUPPORTED_NODE_DESCRIPTION, isNodeVersionSupported } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import { dedent } from 'ts-dedent';

const [major, minor, patch] = process.versions.node.split('.').map(Number);

if (!isNodeVersionSupported(major, minor, patch)) {
  logger.error(
    dedent`To run Storybook, you need Node.js version ${MIN_SUPPORTED_NODE_DESCRIPTION}.
      You are currently running Node.js ${process.version}. Please upgrade your Node.js installation.`
  );
  process.exit(1);
}

import('./run.ts');
