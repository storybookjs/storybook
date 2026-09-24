import { Category, StorybookError } from 'storybook/internal/server-errors';
import { findFilesUp } from 'storybook/internal/common';

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type WebComponentsFrameworkOptions = {
  customElementsManifest?: string | string[];
};

export class MissingCustomElementsManifestError extends StorybookError {
  constructor(public data: { path: string }) {
    super({
      name: 'MissingCustomElementsManifestError',
      category: Category.RENDERER_WEB_COMPONENTS,
      code: 1,
      message: `The customElementsManifest framework option points to a file that does not exist: ${data.path}`,
    });
  }
}

const asPathArray = (value: unknown): string[] => {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }
  return [];
};

const readPackageCustomElements = (configDir: string): string[] => {
  const packageJsonPath = findFilesUp(['package.json'], configDir)[0];
  if (!packageJsonPath) {
    return [];
  }
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
    customElements?: string | string[];
  };
  return asPathArray(packageJson.customElements).map((path) =>
    resolve(dirname(packageJsonPath), path)
  );
};

const resolveFrameworkManifestPaths = (
  configDir: string,
  frameworkOptions: WebComponentsFrameworkOptions
): string[] =>
  asPathArray(frameworkOptions.customElementsManifest).map((path) => {
    const resolvedPath = resolve(configDir, path);
    if (!existsSync(resolvedPath)) {
      throw new MissingCustomElementsManifestError({ path: resolvedPath });
    }
    return resolvedPath;
  });

export const resolveManifestPaths = (
  configDir: string,
  frameworkOptions: WebComponentsFrameworkOptions
): string[] =>
  frameworkOptions.customElementsManifest === undefined
    ? readPackageCustomElements(configDir)
    : resolveFrameworkManifestPaths(configDir, frameworkOptions);
