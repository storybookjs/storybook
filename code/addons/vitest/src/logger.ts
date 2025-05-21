import picocolors from 'picocolors';

import { ADDON_ID } from './constants';

export const log = (message: any) => {
  console.log(`${picocolors.magenta(ADDON_ID)}: ${message.toString().trim()}`);
};
