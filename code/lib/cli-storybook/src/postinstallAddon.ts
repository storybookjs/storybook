import type { PostinstallOptions } from './add';

export const postinstallAddon = async (addonName: string, options: PostinstallOptions) => {
  let wasFound = false;

  try {
    const modulePath = require.resolve(`${addonName}/postinstall`, { paths: [process.cwd()] });

    wasFound = true;
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

  if (wasFound) {
    return;
  }

  try {
    const { default: postinstall } = await import(`${addonName}/postinstall`);

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
