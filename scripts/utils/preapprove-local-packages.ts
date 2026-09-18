import { readFile, writeFile } from 'node:fs/promises';

import { join } from 'path';

import yml from 'yaml';

import { STORYBOOK_PACKAGE_PATTERNS } from '../../code/core/src/common/js-package-manager/util.ts';

/**
 * Packages served by the local Verdaccio registry. They are published seconds before
 * they are installed, so they can never satisfy an age gate on their own.
 */
export const LOCALLY_PUBLISHED_PACKAGE_PATTERNS = [
  ...STORYBOOK_PACKAGE_PATTERNS,
  'create-storybook',
  'sb',
  'vite-plugin-storybook-nextjs',
];

/**
 * Let the locally published Storybook packages past the age gate while keeping the gate
 * itself in force, so third-party dependencies resolved through Verdaccio are still
 * quarantined.
 *
 * Merges with whatever is already allowed, so a template that names its own prerelease
 * packages does not lose them.
 */
export async function preapproveLocallyPublishedPackages(cwd: string) {
  const configPath = join(cwd, '.yarnrc.yml');

  let config: Record<string, unknown> = {};
  try {
    config = (yml.parse(await readFile(configPath, 'utf-8')) ?? {}) as Record<string, unknown>;
  } catch {
    // No config yet; start from scratch.
  }

  const existing = Array.isArray(config.npmPreapprovedPackages)
    ? (config.npmPreapprovedPackages as string[])
    : [];

  config.npmPreapprovedPackages = Array.from(
    new Set([...existing, ...LOCALLY_PUBLISHED_PACKAGE_PATTERNS])
  );

  await writeFile(configPath, yml.stringify(config));
}
