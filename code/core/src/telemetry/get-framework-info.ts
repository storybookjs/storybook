import { readFile } from 'node:fs/promises';

import { getStorybookInfo, rendererPackages } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import { isAbsolute, join } from 'pathe';
import type { PackageJson } from 'type-fest';

import { getActualPackageJson } from './package-json.ts';
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

const readFrameworkPackageJson = async (
  frameworkPackage: string
): Promise<PackageJson | undefined> => {
  if (!isAbsolute(frameworkPackage)) {
    return getActualPackageJson(frameworkPackage);
  }
  try {
    return JSON.parse(await readFile(join(frameworkPackage, 'package.json'), 'utf-8'));
  } catch {
    return undefined;
  }
};

/**
 * Finds the renderer package a framework package depends on: its only known renderer dependency,
 * else its only known renderer peer dependency. A framework can list several renderers as peers
 * (e.g. Astro, for islands), so more than one is ambiguous.
 */
const findRendererDependency = (packageJson: PackageJson | undefined) => {
  const knownRenderers = (dependencies: Partial<Record<string, string>> | undefined) =>
    Object.keys(dependencies ?? {}).filter((name) => name in rendererPackages);

  const dependencies = knownRenderers(packageJson?.dependencies);
  if (dependencies.length > 0) {
    return dependencies.length === 1 ? dependencies[0] : undefined;
  }
  const peerDependencies = knownRenderers(packageJson?.peerDependencies);
  return peerDependencies.length === 1 ? peerDependencies[0] : undefined;
};

export async function getFrameworkInfo(mainConfig: StorybookConfig, configDir: string) {
  const { frameworkPackage, rendererPackage, builderPackage } = await getStorybookInfo(configDir);

  const frameworkOptions =
    typeof mainConfig.framework === 'object' ? mainConfig.framework.options : {};

  // A framework missing from the framework registry still names its renderer in its dependencies
  const renderer =
    rendererPackage ??
    (frameworkPackage
      ? findRendererDependency(await readFrameworkPackageJson(frameworkPackage))
      : undefined);

  return {
    framework: {
      name: frameworkPackage ? cleanAndSanitizePath(frameworkPackage) : undefined,
      options: frameworkOptions,
    },
    builder: builderPackage ? cleanAndSanitizePath(builderPackage) : undefined,
    renderer: renderer ? cleanAndSanitizePath(renderer) : undefined,
  };
}
