import picocolors from 'picocolors';

import { ADDON_ID } from './constants';

export const log = (message: any) => {
  console.log(`${picocolors.magenta(ADDON_ID)}: ${message.toString().trim()}`);
};

export const logError = (error: Error) => {
  console.error(`${picocolors.magenta(ADDON_ID)}: ${(error.name ?? error.message ?? '').trim()}`);
  const reconstructedError = new Error(error.message, { cause: error.cause });
  reconstructedError.stack = error.stack;
  console.dir(reconstructedError, {
    depth: null,
  });
};
