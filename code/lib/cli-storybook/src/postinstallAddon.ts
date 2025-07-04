import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { importModule } from '../../../core/src/shared/utils/module';
import type { PostinstallOptions } from './add';

const DIR_CWD = process.cwd();
const require = createRequire(DIR_CWD);
export const postinstallAddon = async (addonName: string, options: PostinstallOptions) => {
  const hookPath = `${addonName}/postinstall`;
  let modulePath: string;
  try {
    modulePath = import.meta.resolve(hookPath, DIR_CWD);
  } catch (e) {
    try {
      modulePath = require.resolve(hookPath, { paths: [DIR_CWD] });
    } catch (e) {
      return;
    }
  }

  let moduledLoaded: any;
  try {
    moduledLoaded = await import(hookPath)
      .catch(() => importModule(hookPath))
      .catch(() => importModule(modulePath))
      .catch(() => importModule(fileURLToPath(modulePath)))
      .catch(() => require(hookPath))
      .catch(() => require(modulePath))
      .catch(() => require(fileURLToPath(modulePath)));
  } catch (e) {
    return;
  }

  const postinstall = moduledLoaded?.default || moduledLoaded?.postinstall || moduledLoaded;

  if (!postinstall || typeof postinstall !== 'function') {
    console.log(`Error finding postinstall function for ${addonName}`);
    return;
  }

  try {
    console.log(`Running postinstall script for ${addonName}`);
    await postinstall(options);
  } catch (e) {
    console.error(`Error running postinstall script for ${addonName}`);
    console.error(e);
  }
};
