import { isAbsolute, join } from 'node:path';

import { serverRequire } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

interface PresetOptions {
  /**
   * Allow to use @storybook/addon-backgrounds
   *
   * @default true
   * @see https://storybook.js.org/addons/@storybook/addon-backgrounds
   */
  backgrounds?: boolean;
  configDir: string;
  /**
   * Allow to use @storybook/addon-measure
   *
   * @default true
   * @see https://storybook.js.org/addons/@storybook/addon-measure
   */
  measure?: boolean;
  /**
   * Allow to use @storybook/addon-outline
   *
   * @default true
   * @see https://storybook.js.org/addons/@storybook/addon-outline
   */
  outline?: boolean;
  themes?: boolean;
}

const requireMain = (configDir: string) => {
  const absoluteConfigDir = isAbsolute(configDir) ? configDir : join(process.cwd(), configDir);
  const mainFile = join(absoluteConfigDir, 'main');

  return serverRequire(mainFile) ?? {};
};

export function addons(options: PresetOptions) {
  const checkInstalled = (addonName: string, main: any) => {
    const addon = `@storybook/addon-${addonName}`;
    const existingAddon = main.addons?.find((entry: string | { name: string }) => {
      const name = typeof entry === 'string' ? entry : entry.name;
      return name?.startsWith(addon);
    });
    if (existingAddon) {
      logger.info(`Found existing addon ${JSON.stringify(existingAddon)}, skipping.`);
    }
    return !!existingAddon;
  };

  const main = requireMain(options.configDir);

  // NOTE: The order of these addons is important.
  return ['backgrounds', 'measure', 'outline', 'highlight']
    .filter((key) => (options as any)[key] !== false)
    .filter((addon) => !checkInstalled(addon, main))
    .map((addon) => {
      // We point to the re-export from addon-essentials to support yarn pnp and pnpm.
      return `@storybook/addon-essentials/${addon}`;
    });
}
