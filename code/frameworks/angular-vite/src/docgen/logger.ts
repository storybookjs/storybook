import { logger } from 'storybook/internal/node-logger';

import type { CompodocParsingLogger } from '@storybook/angular-compodoc';

/** Prefixed so a line is attributable to this framework, wherever it was emitted from. */
export const compodocLogger: CompodocParsingLogger = {
  warn: (message) => logger.warn(`[storybook-angular-vite] ${message}`),
  debug: (message) => logger.debug(`[storybook-angular-vite] ${message}`),
};
