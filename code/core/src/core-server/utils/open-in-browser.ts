import { logger } from '@storybook/core/node-logger';

import getDefaultBrowser from '@aw-web-design/x-default-browser';
import betterOpn from 'better-opn';
// betterOpn alias used because also loading open
import open from 'open';
import { dedent } from 'ts-dedent';

export function openInBrowser(address: string) {
  const browserEnvVar = process.env.BROWSER;
  const userBrowserIsChrome =
    browserEnvVar === 'chrome' ||
    browserEnvVar === 'chromium' ||
    browserEnvVar === 'brave' ||
    browserEnvVar === 'com.brave.browser';

  const openOptions = browserEnvVar ? { app: { name: browserEnvVar } } : {};

  getDefaultBrowser(async (err: any, res: any) => {
    try {
      if (
        res &&
        (res.isChrome ||
          res.isChromium ||
          res.identity === 'com.brave.browser' ||
          userBrowserIsChrome)
      ) {
        // We use betterOpn for Chrome because it is better at handling which chrome tab
        // or window the preview loads in.
        await betterOpn(address);
      } else {
        await open(address, openOptions);
      }
    } catch (error) {
      logger.error(dedent`
        Could not open ${address} inside a browser. If you're running this command inside a
        docker container or on a CI, you need to pass the '--ci' flag to prevent opening a
        browser by default.
      `);
    }
  });
}
