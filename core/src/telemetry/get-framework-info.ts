import { getStorybookInfo } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import { cleanPaths } from './sanitize';

const cleanAndSanitizePath = (path: string) => {
  return cleanPaths(path).replace(/.*node_modules[\\/]/, '');
};

export async function getFrameworkInfo(mainConfig: StorybookConfig, configDir: string) {
  const { frameworkPackage, rendererPackage, builderPackage } = await getStorybookInfo(configDir);

  const frameworkOptions =
    typeof mainConfig.framework === 'object' ? mainConfig.framework.options : {};

  return {
    framework: {
      name: frameworkPackage ? cleanAndSanitizePath(frameworkPackage) : undefined,
      options: frameworkOptions,
    },
    builder: builderPackage ? cleanAndSanitizePath(builderPackage) : undefined,
    renderer: rendererPackage ? cleanAndSanitizePath(rendererPackage) : undefined,
  };
}
