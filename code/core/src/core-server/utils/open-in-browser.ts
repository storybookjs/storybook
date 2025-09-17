import { logger } from 'storybook/internal/node-logger';

import open from 'open';
import { dedent } from 'ts-dedent';

import { openBrowser } from './open-browser/opener';

export async function openInBrowser(address: string) {
  let errorOccured = false;

  try {
    await openBrowser(address);
  } catch (error) {
    errorOccured = true;
  }

  try {
    await open(address);
    errorOccured = false;
  } catch (error) {
    errorOccured = true;
  }

  if (errorOccured) {
    logger.error(dedent`
        Could not open ${address} inside a browser. If you're running this command inside a
        docker container or on a CI, you need to pass the '--ci' flag to prevent opening a
        browser by default.
      `);
  }
}
