import { getStorybookInfo } from 'storybook/internal/common';
import { type StorybookConfig, SupportedRenderer } from 'storybook/internal/types';

import { cleanPaths } from './sanitize.ts';

const cleanAndSanitizePath = (path: string) => {
  const cleaned = cleanPaths(path).replace(/.*node_modules[\\/]/, '');
  // A pnpm virtual-store dir leaks through when the resolved path points at
  // `.pnpm/<name>@<version>` rather than its inner node_modules. Decode the real
  // package name (scope slash is encoded as '+') so telemetry stays stable across
  // versions and peer-dep suffixes (e.g. `@9.0.0_typescript@5.0.0`).
  const pnpmDir = cleaned.match(/^\.pnpm\/(.+?)@[^/]+$/);
  return pnpmDir ? pnpmDir[1].replace('+', '/') : cleaned;
};

export async function getFrameworkInfo(mainConfig: StorybookConfig, configDir: string) {
  const { frameworkPackage, rendererPackage, builderPackage } = await getStorybookInfo(configDir);

  const frameworkOptions =
    typeof mainConfig.framework === 'object' ? mainConfig.framework.options : {};
  const frameworkName = frameworkPackage ? cleanAndSanitizePath(frameworkPackage) : undefined;
  const frameworkRenderers: Record<string, SupportedRenderer> = {
    '@storybook/react-native': SupportedRenderer.REACT_NATIVE,
    '@storybook-astro/framework': SupportedRenderer.ASTRO,
    '@analogjs/storybook-angular': SupportedRenderer.ANGULAR,
  };
  const frameworkRenderer = frameworkName ? frameworkRenderers[frameworkName] : undefined;

  return {
    framework: {
      name: frameworkName,
      options: frameworkOptions,
    },
    builder: builderPackage ? cleanAndSanitizePath(builderPackage) : undefined,
    renderer:
      frameworkRenderer ?? (rendererPackage ? cleanAndSanitizePath(rendererPackage) : undefined),
  };
}
