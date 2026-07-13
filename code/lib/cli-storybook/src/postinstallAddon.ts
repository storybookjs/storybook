import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { importModule } from '../../../core/src/shared/utils/module.ts';
import type { PostinstallOptions } from './add.ts';

const DIR_CWD = process.cwd();
// createRequire treats a bare directory as a file path and resolves from its parent,
// so anchor it to a file inside the project instead.
const require = createRequire(join(DIR_CWD, 'package.json'));

export const postinstallAddon = async (addonName: string, options: PostinstallOptions) => {
  const hookPath = `${addonName}/postinstall`;
  const logger = options.logger;
  let modulePath: string | undefined;
  try {
    // Resolve from the user's project: import.meta.resolve would resolve relative to THIS file,
    // which points at the wrong copy (or none at all) when the CLI runs from a different tree
    // than the project, e.g. via npx or in a monorepo.
    modulePath = require.resolve(hookPath, { paths: [DIR_CWD] });
  } catch (e) {
    // When the addon was installed while this process was already running (the upgrade command
    // installs dependencies mid-run), Node's module resolution has cached the earlier negative
    // lookup and keeps failing. A fresh child process resolves from a clean cache.
    const result = spawnSync(
      process.execPath,
      ['-p', `require.resolve(${JSON.stringify(hookPath)}, { paths: [process.cwd()] })`],
      { cwd: DIR_CWD, encoding: 'utf8', timeout: 30_000 }
    );
    if (result.status === 0 && result.stdout.trim()) {
      modulePath = result.stdout.trim();
    }
  }

  if (!modulePath) {
    try {
      modulePath = import.meta.resolve(hookPath);
    } catch (e) {
      logger.warn(
        `Could not resolve the postinstall hook of ${addonName}, skipping its configuration. Run \`npx storybook add ${addonName}\` to set it up manually.`
      );
      return;
    }
  }

  // Prefer the module resolved from the user's project (modulePath): a bare `import(hookPath)`
  // resolves relative to THIS file, which points at the wrong copy (or none at all) when the CLI
  // runs from a different tree than the project, e.g. via npx or in a monorepo.
  const moduleFilePath = modulePath.startsWith('file:') ? fileURLToPath(modulePath) : modulePath;

  let moduledLoaded: any;
  try {
    moduledLoaded = await import(pathToFileURL(moduleFilePath).href)
      .catch(() => importModule(moduleFilePath))
      .catch(() => require(moduleFilePath))
      .catch(() => import(hookPath))
      .catch(() => importModule(hookPath))
      .catch(() => require(hookPath));
  } catch (e) {
    logger.warn(
      `Could not load the postinstall hook of ${addonName} (${String(
        e
      )}), skipping its configuration. Run \`npx storybook add ${addonName}\` to set it up manually.`
    );
    return;
  }

  const postinstall = moduledLoaded?.default || moduledLoaded?.postinstall || moduledLoaded;

  if (!postinstall || typeof postinstall !== 'function') {
    logger.error(`Error finding postinstall function for ${addonName}`);
    return;
  }

  try {
    await postinstall(options);
  } catch (e) {
    throw e;
  }
};

/**
 * Run the postinstall (configuration) step for a list of core addons that an automigration added
 * but deferred. This must be called AFTER dependencies are installed, since each addon's postinstall
 * hook is resolved from the installed package on disk. A failure for one addon is logged and does
 * not abort the rest.
 */
export const configureDeferredAddons = async (
  addons: string[],
  options: PostinstallOptions
): Promise<void> => {
  for (const addon of addons) {
    try {
      await postinstallAddon(addon, options);
    } catch (e) {
      options.logger.warn(
        `Could not configure ${addon}: ${e}. Run \`npx storybook add ${addon}\` to set it up manually.`
      );
    }
  }
};
