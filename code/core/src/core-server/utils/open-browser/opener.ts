/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root
 * directory of this source tree.
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import spawn from 'cross-spawn';
import open, { type App } from 'open';
import picocolors from 'picocolors';

import { resolvePackageDir } from '../../../common';
import { StorybookError } from '../../../storybook-error';

// https://github.com/sindresorhus/open#app
const OSX_CHROME = 'google chrome';

enum Actions {
  NONE = 0,
  BROWSER = 1,
  SCRIPT = 2,
  SHELL_SCRIPT = 3,
}

function getBrowserEnv():
  | {
      action: Actions.SCRIPT | Actions.SHELL_SCRIPT;
      value: string;
      args: string[];
    }
  | {
      action: Actions.BROWSER;
      value?: string;
      args: string[];
    }
  | {
      action: Actions.NONE;
      value?: undefined;
      args?: undefined;
    } {
  // Attempt to honor this environment variable.
  // It is specific to the operating system.
  // See https://github.com/sindresorhus/open#app for documentation.
  const value = process.env.BROWSER;
  const args = process.env.BROWSER_ARGS ? process.env.BROWSER_ARGS.split(' ') : [];

  // Default.
  if (!value) {
    return { action: Actions.BROWSER, args };
  }

  if (value.toLowerCase() === 'none') {
    return { action: Actions.NONE };
  }

  if (
    value.toLowerCase().endsWith('.js') ||
    value.toLowerCase().endsWith('.mjs') ||
    value.toLowerCase().endsWith('.cjs') ||
    value.toLowerCase().endsWith('.ts')
  ) {
    return { action: Actions.SCRIPT, value, args };
  }

  if (value.toLowerCase().endsWith('.sh')) {
    return { action: Actions.SHELL_SCRIPT, value, args };
  }

  return { action: Actions.BROWSER, value, args };
}

export class BrowserEnvError extends StorybookError {
  constructor(message: string) {
    super({
      category: 'CORE_SERVER',
      code: 1,
      message,
      name: 'BrowserEnvError',
    });
  }
}

function attachEventHandlers(child: ReturnType<typeof spawn>, scriptPath: string) {
  child.on('error', (error) => {
    logger.error(
      `Failed to run script specified in BROWSER.\n${picocolors.cyan(scriptPath)}: ${error.message}`
    );
  });

  child.on('close', (code) => {
    if (code !== 0) {
      logger.error(
        `The script specified as BROWSER environment variable failed.\n${picocolors.cyan(scriptPath)} exited with code ${code}.`
      );
      return;
    }
  });
}

function executeNodeScript(scriptPath: string, url: string) {
  const extraArgs = process.argv.slice(2);
  const child = spawn(process.execPath, [scriptPath, ...extraArgs, url], {
    stdio: 'inherit',
  });
  attachEventHandlers(child, scriptPath);
  return true;
}

function executeShellScript(scriptPath: string, url: string) {
  const extraArgs = process.argv.slice(2);
  const child = spawn('sh', [scriptPath, ...extraArgs, url], {
    stdio: 'inherit',
  });
  attachEventHandlers(child, scriptPath);
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
      } catch {
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
  } catch {
    return false;
  }
}

/**
 * Reads the BROWSER environment variable and decides what to do with it. Returns true if it opened
 * a browser or ran a node.js script, otherwise false.
 */
export function openBrowser(url: string) {
  const { action, value, args } = getBrowserEnv();
  // Returns win32 on PowerShell and Linux on WSL. Matches conditions when `sh` can be invoked.
  const canRunShell = process.platform !== 'win32';
  const browserTarget = value as unknown as App | readonly App[] | undefined;

  switch (action) {
    case Actions.NONE: {
      // Special case: BROWSER="none" will prevent opening completely.
      return false;
    }
    case Actions.SCRIPT: {
      return executeNodeScript(value, url);
    }
    case Actions.SHELL_SCRIPT: {
      if (canRunShell) {
        return executeShellScript(value, url);
      }
      throw new BrowserEnvError(
        'Shell scripts are not supported on Windows PowerShell. Use WSL instead.'
      );
    }
    case Actions.BROWSER: {
      return startBrowserProcess(browserTarget, url, args);
    }
    default: {
      throw new BrowserEnvError('Not implemented.');
    }
  }
}
