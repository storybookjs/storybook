import { createRequire } from 'node:module';

import { importModule } from '../../../core/src/shared/utils/module';
import type { PostinstallOptions } from './add';

export const postinstallAddon = async (addonName: string, options: PostinstallOptions) => {
  const hookPath = `${addonName}/postinstall`;
  try {
    const modulePath = import.meta.resolve(hookPath, process.cwd());
    const loaded = await importModule(modulePath);

    const postinstall = loaded?.default || loaded?.postinstall || loaded;

    if (!postinstall || typeof postinstall !== 'function') {
      return;
    }

    try {
      console.log(`Running postinstall script for ${addonName}`);
      await postinstall(options);
    } catch (e) {
      console.error(`Error running postinstall script for ${addonName}`);
      console.error(e);
    }
  } catch (e) {
    const loaded = createRequire(import.meta.url)(hookPath);
    const postinstall = loaded?.default || loaded?.postinstall || loaded;

    if (!postinstall || typeof postinstall !== 'function') {
      return;
    }

    try {
      console.log(`Running postinstall script for ${addonName}`);
      await postinstall(options);
    } catch (e) {
      console.error(`Error running postinstall script for ${addonName}`);
      console.error(e);
    }
  }
};
