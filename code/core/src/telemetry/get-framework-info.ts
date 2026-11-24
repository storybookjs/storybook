import {
  getStorybookInfo,
  readDependencyManifest,
  rendererPackages,
} from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import { normalize, resolve } from 'pathe';
import type { PackageJson } from 'type-fest';

import { cleanPaths } from './sanitize.ts';

const knownRendererPackages = new Set(Object.keys(rendererPackages));

const cleanAndSanitizePath = (path: string) => {
  const cleaned = cleanPaths(path).replace(/.*node_modules[\\/]/, '');
  // A pnpm virtual-store dir leaks through when the resolved path points at
  // `.pnpm/<name>@<version>` rather than its inner node_modules. Decode the real
  // package name (scope slash is encoded as '+') so telemetry stays stable across
  // versions and peer-dep suffixes (e.g. `@9.0.0_typescript@5.0.0`).
  const pnpmDir = cleaned.match(/^\.pnpm\/(.+?)@[^/]+$/);
  return pnpmDir ? pnpmDir[1].replace('+', '/') : cleaned;
};

const readFrameworkPackageJson = (frameworkPackage: string, configDir: string) => {
  const frameworkPath = normalize(frameworkPackage);
  // A pnpm virtual-store dir holds no package.json of its own, so resolve its package by name
  const framework = /\/\.pnpm\/[^/]+$/.test(frameworkPath)
    ? cleanAndSanitizePath(frameworkPath)
    : frameworkPath;
  // Resolve from the config dir, where Storybook resolves the framework, not from the cwd
  return readDependencyManifest(resolve(configDir), framework);
};

/**
 * Finds the renderer package a framework package depends on: its only known renderer dependency,
 * else its only known renderer peer dependency. A framework can list several renderers as peers
 * (e.g. Astro, for islands), so more than one is ambiguous.
 */
const findRendererDependency = (packageJson: PackageJson | undefined) => {
  const knownRenderers = (dependencies: Partial<Record<string, string>> | undefined) =>
    Object.keys(dependencies ?? {}).filter((name) => knownRendererPackages.has(name));

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

  const renderer =
    rendererPackage ??
    // A framework missing from the registry still names its renderer in its dependencies
    (frameworkPackage
      ? findRendererDependency(await readFrameworkPackageJson(frameworkPackage, configDir))
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
