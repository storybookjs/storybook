import { serverRequire } from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';

import path from 'path';

interface PresetOptions {
  /**
   * Allow to use @storybook/addon-actions
   * @see https://storybook.js.org/addons/@storybook/addon-actions
   * @default true
   */
  actions?: boolean;
  /**
   * Allow to use @storybook/addon-backgrounds
   * @see https://storybook.js.org/addons/@storybook/addon-backgrounds
   * @default true
   */
  backgrounds?: boolean;
  configDir: string;
  /**
   * Allow to use @storybook/addon-controls
   * @see https://storybook.js.org/addons/@storybook/addon-controls
   * @default true
   */
  controls?: boolean;
  /**
   * Allow to use @storybook/addon-docs
   * @see https://storybook.js.org/addons/@storybook/addon-docs
   * @default true
   */
  docs?: boolean;
  /**
   * Allow to use @storybook/addon-measure
   * @see https://storybook.js.org/addons/@storybook/addon-measure
   * @default true
   */
  measure?: boolean;
  /**
   * Allow to use @storybook/addon-outline
   * @see https://storybook.js.org/addons/@storybook/addon-outline
   * @default true
   */
  outline?: boolean;
  themes?: boolean;
  /**
   * Allow to use @storybook/addon-toolbars
   * @see https://storybook.js.org/addons/@storybook/addon-toolbars
   * @default true
   */
  toolbars?: boolean;
  /**
   * Allow to use @storybook/addon-viewport
   * @see https://storybook.js.org/addons/@storybook/addon-viewport
   * @default true
   */
  viewport?: boolean;
}

const requireMain = (configDir: string) => {
  const absoluteConfigDir = path.isAbsolute(configDir)
    ? configDir
    : path.join(process.cwd(), configDir);
  const mainFile = path.join(absoluteConfigDir, 'main');

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
  return [
    'docs',
    'controls',
    'actions',
    'backgrounds',
    'viewport',
    'toolbars',
    'measure',
    'outline',
    'highlight',
  ]
    .filter((key) => (options as any)[key] !== false)
    .filter((addon) => !checkInstalled(addon, main))
    .map((addon) => {
      // We point to the re-export from addon-essentials to support yarn pnp and pnpm.
      return `@storybook/addon-essentials/${addon}`;
    });
}
