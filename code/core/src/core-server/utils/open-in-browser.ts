import { logger } from 'storybook/internal/node-logger';

import open from 'open';
import { dedent } from 'ts-dedent';

import { openBrowser } from './open-browser/opener';

export async function openInBrowser(address: string) {
  let errorOccured = false;

  try {
    await openBrowser(address);
  } catch (error) {
    console.error('A', error);
    errorOccured = true;
  }

  try {
    if (errorOccured) {
      await open(address);
      console.info(`Opened ${address} in browser`);
      errorOccured = false;
    }
  } catch (error) {
    console.error('B', error);
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
