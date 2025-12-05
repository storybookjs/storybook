/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root
 * directory of this source tree.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import spawn from 'cross-spawn';
import open, { type App } from 'open';
import picocolors from 'picocolors';

import { resolvePackageDir } from '../../../common';

// https://github.com/sindresorhus/open#app
const OSX_CHROME = 'google chrome';

const Actions = Object.freeze({
  NONE: 0,
  BROWSER: 1,
  SCRIPT: 2,
});

function getBrowserEnv() {
  // Attempt to honor this environment variable.
  // It is specific to the operating system.
  // See https://github.com/sindresorhus/open#app for documentation.
  const value = process.env.BROWSER;
  const args = process.env.BROWSER_ARGS ? process.env.BROWSER_ARGS.split(' ') : [];
  let action;
  if (!value) {
    // Default.
    action = Actions.BROWSER;
  } else if (value.toLowerCase() === 'none') {
    action = Actions.NONE;
  } else if (
    value.toLowerCase().endsWith('.js') ||
    value.toLowerCase().endsWith('.mjs') ||
    value.toLowerCase().endsWith('.cjs') ||
    value.toLowerCase().endsWith('.sh')
  ) {
    action = Actions.SCRIPT;
  } else {
    action = Actions.BROWSER;
  }
  return { action, value, args };
}

function executeNodeScript(scriptPath: string, url: string) {
  const extraArgs = process.argv.slice(2);
  const child = spawn(process.execPath, [scriptPath, ...extraArgs, url], {
    stdio: 'inherit',
  });
  child.on('close', (code) => {
    if (code !== 0) {
      console.log();
      console.log(picocolors.red('The script specified as BROWSER environment variable failed.'));
      console.log(`${picocolors.cyan(scriptPath)} exited with code ${code}.`);
      console.log();
      return;
    }
  });
  return true;
}

function startBrowserProcess(
  browser: App | readonly App[] | undefined,
  url: string,
  args: string[]
) {
  // If we're on OS X, the user hasn't specifically
  // requested a different browser, we can try opening
  // Chrome with AppleScript. This lets us reuse an
  // existing tab when possible instead of creating a new one.
  const shouldTryOpenChromiumWithAppleScript =
    process.platform === 'darwin' && (typeof browser !== 'string' || browser === OSX_CHROME);

  if (shouldTryOpenChromiumWithAppleScript) {
    // Will use the first open browser found from list
    const supportedChromiumBrowsers = [
      'Google Chrome Canary',
      'Google Chrome Dev',
      'Google Chrome Beta',
      'Google Chrome',
      'Microsoft Edge',
      'Brave Browser',
      'Vivaldi',
      'Chromium',
    ];

    for (const chromiumBrowser of supportedChromiumBrowsers) {
      try {
        // Try our best to reuse existing tab
        // on OSX Chromium-based browser with AppleScript
        execSync(`ps cax | grep "${chromiumBrowser}"`);
        const pathToApplescript = join(
          resolvePackageDir('storybook'),
          'assets',
          'server',
          'openBrowser.applescript'
        );

        const command = `osascript "${pathToApplescript}" \"`
          .concat(encodeURI(url), '" "')
          .concat(
            process.env.OPEN_MATCH_HOST_ONLY === 'true'
              ? encodeURI(new URL(url).origin)
              : encodeURI(url),
            '" "'
          )
          .concat(chromiumBrowser, '"');

        execSync(command, {
          cwd: __dirname,
        });

        return true;
      } catch (err) {
        // Ignore errors.
      }
    }
  }

  // Another special case: on OS X, check if BROWSER has been set to "open".
  // In this case, instead of passing `open` to `opn` (which won't work),
  // just ignore it (thus ensuring the intended behavior, i.e. opening the system browser):
  // https://github.com/facebook/create-react-app/pull/1690#issuecomment-283518768
  // @ts-expect-error - browser is a string
  if (process.platform === 'darwin' && browser === 'open') {
    browser = undefined;
  }

  // If there are arguments, they must be passed as array with the browser
  if (typeof browser === 'string' && args.length > 0) {
    // @ts-expect-error - browser is a string
    browser = [browser].concat(args);
  }

  // Fallback to open
  // (It will always open new tab)
  try {
    const options = { app: browser, wait: false, url: true };
    open(url, options).catch(() => {}); // Prevent `unhandledRejection` error.
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Reads the BROWSER environment variable and decides what to do with it. Returns true if it opened
 * a browser or ran a node.js script, otherwise false.
 */
export function openBrowser(url: string) {
  const { action, value, args } = getBrowserEnv();
  switch (action) {
    case Actions.NONE: {
      // Special case: BROWSER="none" will prevent opening completely.
      return false;
    }
    case Actions.SCRIPT: {
      if (!value) {
        throw new Error('BROWSER environment variable is not set.');
      }
      return executeNodeScript(value, url);
    }
    case Actions.BROWSER: {
      return startBrowserProcess(value as App | readonly App[] | undefined, url, args);
    }
    default: {
      throw new Error('Not implemented.');
    }
  }
}
