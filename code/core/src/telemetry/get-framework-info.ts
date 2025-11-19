import { getStorybookInfo } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

export async function getFrameworkInfo(mainConfig: StorybookConfig, configDir: string) {
  const { frameworkPackage, rendererPackage, builderPackage } = await getStorybookInfo(configDir);

  const frameworkOptions =
    typeof mainConfig.framework === 'object' ? mainConfig.framework.options : {};

  return {
    framework: {
      name: frameworkPackage,
      options: frameworkOptions,
    },
    builder: builderPackage,
    renderer: rendererPackage,
  };
}
