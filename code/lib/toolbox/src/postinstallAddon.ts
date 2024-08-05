import type { PostinstallOptions } from './add';

export const postinstallAddon = async (addonName: string, options: PostinstallOptions) => {
  try {
    const modulePath = require.resolve(`${addonName}/postinstall`, { paths: [process.cwd()] });

    const postinstall = require(modulePath);

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
