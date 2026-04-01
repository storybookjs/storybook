#!/usr/bin/env node
export {};

try {
  const { isNodeVersionSupported, MIN_SUPPORTED_NODE_DESCRIPTION } =
    await import('storybook/internal/common');
  const [major, minor, patch] = process.versions.node.split('.').map(Number);

  if (!isNodeVersionSupported(major, minor, patch)) {
    try {
      const { handleUnsupportedNodeRuntime } = await import('../node-version-check.ts');
      await handleUnsupportedNodeRuntime(major, minor, patch);
    } catch {
      const { logger } = await import('storybook/internal/node-logger');
      logger.error(
        `To run Storybook, you need Node.js version ${MIN_SUPPORTED_NODE_DESCRIPTION}.\n` +
          `You are currently running Node.js ${process.version}.`
      );
    }
    process.exit(1);
  }

  await import('./run.ts');
} catch {
  console.error(`Storybook does not support Node.js ${process.version}. Please upgrade.`);
  process.exit(1);
}
