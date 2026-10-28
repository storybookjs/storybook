import { getStorybookInfo } from '@storybook/core/internal/common';
import type { StorybookConfig } from '../instance/plugins.ts';
import { getInstanceContext } from '../shared/instance-context.ts';

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

export async function getFrameworkInfo(
  mainConfig: Pick<StorybookConfig, 'framework'>,
  configDir: string
) {
  const { frameworkPackage, rendererPackage, builderPackage } = await getStorybookInfo(configDir);

  const framework = mainConfig.framework;
  const frameworkOptions =
    framework && typeof framework === 'object'
      ? 'meta' in framework
        ? ((await getInstanceContext()?.storybook?.callHook('core:framework-options:extend', {})) ??
          {})
        : framework.options
      : {};

  return {
    framework: {
      name: frameworkPackage ? cleanAndSanitizePath(frameworkPackage) : undefined,
      options: frameworkOptions,
    },
    builder: builderPackage ? cleanAndSanitizePath(builderPackage) : undefined,
    renderer: rendererPackage ? cleanAndSanitizePath(rendererPackage) : undefined,
  };
}
