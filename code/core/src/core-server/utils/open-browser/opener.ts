/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the LICENSE file in the root
 * directory of this source tree.
 */
import { execSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';

import { logger } from 'storybook/internal/node-logger';

import spawn from 'cross-spawn';
import defaultBrowserId from 'default-browser-id';
import isInsideContainer from 'is-inside-container';
import open, { type Options } from 'open';
import { delimiter, join } from 'pathe';
import picocolors from 'picocolors';
import { isWsl } from 'wsl-utils';

import { resolvePackageDir } from '../../../common/index.ts';
import { StorybookError } from '../../../storybook-error.ts';

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

function isExecutable(command: string) {
  const candidates = command.includes('/')
    ? [command]
    : (process.env.PATH ?? '').split(delimiter).map((dir) => join(dir, command));

  return candidates.some((candidate) => {
    try {
      accessSync(candidate, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

// Returns the command that `open` would spawn on Linux when it cannot be found, so Storybook can
// say what is missing (#32949, #24191). `open` is bundled, so it cannot reach the copy of
// `xdg-open` that it ships with. The conditions mirror `open`: macOS, Windows and WSL (outside a
// container) use other launchers.
function getMissingLinuxCommand(app?: string) {
  if (process.platform === 'darwin' || process.platform === 'win32') {
    return undefined;
  }
  if (isWsl && !isInsideContainer() && !app) {
    return undefined;
  }

  const command = app ?? 'xdg-open';
  return isExecutable(command) ? undefined : command;
}

function warnMissingLinuxCommand(url: string, command: string) {
  const hint =
    command === 'xdg-open'
      ? 'Install xdg-utils, or set the BROWSER environment variable.'
      : 'Check the BROWSER environment variable.';
  logger.warn(`Could not open ${url} in a browser, because "${command}" was not found. ${hint}`);
}

// `open` spawns without an error listener, so a failing spawn (for example a missing PowerShell
// on WSL) would crash Storybook with an unhandled 'error' event. Calling it after an `await` keeps
// the spawn inside the microtask queue, so the listener below is attached before Node emits it.
export async function openSafely(url: string, options?: Options) {
  await Promise.resolve();
  const child = await open(url, options);
  child.once('error', (error) => {
    logger.warn(`Could not open ${url} in a browser: ${error.message}`);
  });
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

// macOS bundle IDs of the Chromium browsers that `openBrowser.applescript` can drive, mapped to
// their application names. Bundle names differ from those, for example "Chrome". The IDs are
// lowercase because LaunchServices may store them that way.
const CHROMIUM_BROWSERS_BY_BUNDLE_ID: Record<string, string> = {
  'com.google.chrome.canary': 'Google Chrome Canary',
  'com.google.chrome.dev': 'Google Chrome Dev',
  'com.google.chrome.beta': 'Google Chrome Beta',
  'com.google.chrome': 'Google Chrome',
  'com.microsoft.edgemac': 'Microsoft Edge',
  'com.brave.browser': 'Brave Browser',
  'com.vivaldi.vivaldi': 'Vivaldi',
  'org.chromium.chromium': 'Chromium',
};

// The tab-reusing AppleScript only runs for the browser that would open anyway: the Chromium
// browser named in BROWSER (any case), or else the default browser when it is Chromium-based.
// Probing every running Chromium browser ignored the default browser (#15316, #22929) and could
// start a Parallels VM through its "Microsoft Edge" app (#34631). `default-browser-id` only reads
// a LaunchServices plist; `default-browser` would also script Finder, which can prompt for access.
async function getAppleScriptBrowser(browser: string | undefined) {
  if (typeof browser === 'string') {
    return Object.values(CHROMIUM_BROWSERS_BY_BUNDLE_ID).find(
      (name) => name.toLowerCase() === browser.toLowerCase()
    );
  }
  try {
    return CHROMIUM_BROWSERS_BY_BUNDLE_ID[(await defaultBrowserId()).toLowerCase()];
  } catch {
    return undefined;
  }
}

async function startBrowserProcess(browser: string | undefined, url: string, args: string[]) {
  // If we're on OS X, try opening a Chromium browser with AppleScript. This lets us reuse an
  // existing tab when possible instead of creating a new one.
  const chromiumBrowser =
    process.platform === 'darwin' ? await getAppleScriptBrowser(browser) : undefined;

  if (chromiumBrowser) {
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

  // Another special case: on OS X, check if BROWSER has been set to "open".
  // In this case, instead of passing `open` to `opn` (which won't work),
  // just ignore it (thus ensuring the intended behavior, i.e. opening the system browser):
  // https://github.com/facebook/create-react-app/pull/1690#issuecomment-283518768
  if (process.platform === 'darwin' && browser === 'open') {
    browser = undefined;
  }

  const missingCommand = getMissingLinuxCommand(browser);
  if (missingCommand) {
    warnMissingLinuxCommand(url, missingCommand);
    // Handled: returning false would mean BROWSER=none, and throwing would retry with `open`.
    return true;
  }

  // Fallback to open
  // (It will always open new tab)
  const options = {
    app: browser ? { name: browser, arguments: args } : undefined,
    wait: false,
    url: true,
  };
  openSafely(url, options).catch(() => {}); // Prevent `unhandledRejection` error.
  return true;
}

/**
 * Reads the BROWSER environment variable and decides what to do with it. Returns true if it opened
 * a browser or ran a node.js script, otherwise false.
 */
export async function openBrowser(url: string) {
  const { action, value, args } = getBrowserEnv();
  // Returns win32 on PowerShell and Linux on WSL. Matches conditions when `sh` can be invoked.
  const canRunShell = process.platform !== 'win32';

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
      return await startBrowserProcess(value, url, args);
    }
    default: {
      throw new BrowserEnvError('Not implemented.');
    }
  }
}
