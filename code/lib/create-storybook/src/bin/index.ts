#!/usr/bin/env node
export {};

try {
  const { isNodeVersionSupported } = await import('storybook/internal/common');
  const [major, minor, patch] = process.versions.node.split('.').map(Number);

  if (!isNodeVersionSupported(major, minor, patch)) {
    const { MIN_SUPPORTED_NODE_DESCRIPTION } = await import('storybook/internal/common');
    const { logger } = await import('storybook/internal/node-logger');
    logger.error(
      `To run Storybook, you need Node.js version ${MIN_SUPPORTED_NODE_DESCRIPTION}.\n` +
        `You are currently running Node.js ${process.version}.`
    );
    logger.outro('');
    process.exit(1);
  }
} catch {
  // Back up in case Node version is so old that dynamic imports or the logger fail to run.
  console.error(
    `\nStorybook does not support Node.js ${process.version}. Please upgrade to run Storybook.\n`
  );
  process.exit(1);
}

await import('./run.ts');
