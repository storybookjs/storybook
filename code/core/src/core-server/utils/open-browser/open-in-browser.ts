import { logger } from 'storybook/internal/node-logger';

import open from 'open';
import { dedent } from 'ts-dedent';

import { openBrowser } from './opener';

export async function openInBrowser(address: string) {
  let errorOccurred = false;
  let openBrowserResult: boolean | undefined;

  try {
    openBrowserResult = await openBrowser(address);
  } catch (error) {
    errorOccurred = true;
  }

  // If openBrowser returned false, it means BROWSER=none was set intentionally
  // In this case, don't try to open a browser at all (fixes #24191)
  if (openBrowserResult === false) {
    return;
  }

  try {
    if (errorOccurred) {
      await open(address);
      errorOccurred = false;
    }
  } catch (error) {
    errorOccurred = true;
  }

  if (errorOccurred) {
    const browserEnv = process.env.BROWSER;
    const browserHint = browserEnv
      ? `\n\nNote: BROWSER environment variable is set to "${browserEnv}". ` +
        `To disable browser opening, use BROWSER=none or the --ci flag.`
      : '';

    logger.error(dedent`
        Could not open ${address} inside a browser. If you're running this command inside a
        docker container or on a CI, you need to pass the '--ci' flag to prevent opening a
        browser by default.${browserHint}
      `);
  }
}
