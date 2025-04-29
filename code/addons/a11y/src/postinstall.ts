import { runAutomigrate } from 'storybook/internal/cli';

import type { PostinstallOptions } from '../../../lib/cli-storybook/src/add';

export default async function postinstall(options: PostinstallOptions) {
  await runAutomigrate('addonA11yAddonTest', options);
}
