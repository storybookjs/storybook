import { logger } from 'storybook/internal/node-logger';

/**
 * The logger to hand to CLI helpers such as `add()` from inside an automigration. Their progress
 * lines go to debug, so they do not break up the list of fix results in the task log.
 */
export const automigrationLogger = { ...logger, log: logger.debug };
