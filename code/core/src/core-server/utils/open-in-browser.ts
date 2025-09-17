import { logger } from 'storybook/internal/node-logger';

import open from 'open';
import { dedent } from 'ts-dedent';

export async function openInBrowser(address: string) {
  try {
    await open(address);
  } catch (error) {
    logger.error(dedent`
        Could not open ${address} inside a browser. If you're running this command inside a
        docker container or on a CI, you need to pass the '--ci' flag to prevent opening a
        browser by default.
      `);
  }
}
