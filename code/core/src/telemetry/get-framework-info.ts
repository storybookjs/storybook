import { readFile } from 'node:fs/promises';

import { getStorybookInfo, rendererPackages } from 'storybook/internal/common';
import type { StorybookConfig } from 'storybook/internal/types';

import * as pkg from 'empathic/package';
import { isAbsolute, normalize } from 'pathe';
import type { PackageJson } from 'type-fest';

import { matchPackageName } from '../common/utils/match-package-name.ts';
import { TELEMETRY_ONLY_RENDERER_PACKAGES } from './get-renderer-packages.ts';
import { getActualPackageJson } from './package-json.ts';
import { cleanPaths } from './sanitize.ts';

const knownRendererPackages = () => [
  ...Object.keys(rendererPackages),
  ...Object.keys(TELEMETRY_ONLY_RENDERER_PACKAGES),
];

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
  // A pnpm virtual-store dir holds no package.json of its own, so resolve its package by name
  if (!isAbsolute(frameworkPackage) || /\/\.pnpm\/[^/]+$/.test(normalize(frameworkPackage))) {
    return getActualPackageJson(cleanAndSanitizePath(frameworkPackage));
  }
  const packageJsonPath = pkg.up({ cwd: frameworkPackage });
  if (!packageJsonPath) {
    return undefined;
  }
  try {
    return JSON.parse(await readFile(packageJsonPath, 'utf-8'));
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
    Object.keys(dependencies ?? {}).filter((name) => knownRendererPackages().includes(name));

  const dependencies = knownRenderers(packageJson?.dependencies);
  if (dependencies.length > 0) {
    return dependencies.length === 1 ? dependencies[0] : undefined;
  }
  const peerDependencies = knownRenderers(packageJson?.peerDependencies);
  return peerDependencies.length === 1 ? peerDependencies[0] : undefined;
};

/**
 * Finds the renderer of a framework that the framework tables do not map to one: a renderer
 * configured as its own framework, such as React Native, or the renderer a framework depends on.
 */
const findUnlistedRenderer = async (frameworkPackage: string) =>
  matchPackageName(frameworkPackage, knownRendererPackages()) ??
  findRendererDependency(await readFrameworkPackageJson(frameworkPackage));

export async function getFrameworkInfo(mainConfig: StorybookConfig, configDir: string) {
  const { frameworkPackage, rendererPackage, builderPackage } = await getStorybookInfo(configDir);

  const frameworkOptions =
    typeof mainConfig.framework === 'object' ? mainConfig.framework.options : {};

  const renderer =
    rendererPackage ??
    (frameworkPackage ? await findUnlistedRenderer(frameworkPackage) : undefined);

  return {
    framework: {
      name: frameworkPackage ? cleanAndSanitizePath(frameworkPackage) : undefined,
      options: frameworkOptions,
    },
    builder: builderPackage ? cleanAndSanitizePath(builderPackage) : undefined,
    renderer: renderer ? cleanAndSanitizePath(renderer) : undefined,
  };
}
