import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

import { ADDON_ID } from './constants';

export const log = (message: any) => {
  logger.log(
    `${picocolors.magenta(ADDON_ID)}: ${message
      .toString()
      .replaceAll(/(│\n|│  )/g, '')
      .trim()}`
  );
};
