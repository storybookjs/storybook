import { importModule } from '../../../core/src/shared/utils/module';
import type { PostinstallOptions } from './add';

export const postinstallAddon = async (addonName: string, options: PostinstallOptions) => {
  try {
    const modulePath = import.meta.resolve(`${addonName}/postinstall`, process.cwd());
    const loaded = await importModule(modulePath);

    const postinstall = loaded?.default || loaded?.postinstall || loaded;

    if (!postinstall) {
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
    // no postinstall script
  }
};
