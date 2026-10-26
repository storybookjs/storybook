import { findFilesUp } from 'storybook/internal/common';

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type { WebComponentsFrameworkOptions } from '../../../types.ts';

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
  asPathArray(frameworkOptions.customElementsManifest).map((path) => resolve(configDir, path));

export const resolveManifestPaths = (
  configDir: string,
  frameworkOptions: WebComponentsFrameworkOptions
): string[] =>
  frameworkOptions.customElementsManifest === undefined
    ? readPackageCustomElements(configDir)
    : resolveFrameworkManifestPaths(configDir, frameworkOptions);
