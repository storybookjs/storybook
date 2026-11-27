import { readFile, writeFile } from 'node:fs/promises';

import { join } from 'path';

import yml from 'yaml';

import { STORYBOOK_PACKAGE_PATTERNS } from '../../code/core/src/common/js-package-manager/util.ts';

/**
 * Let the locally published Storybook packages past the age gate while keeping the gate
 * itself in force, so third-party dependencies resolved through Verdaccio are still
 * quarantined. The local registry publishes them seconds before they are installed, so they
 * can never satisfy an age gate on their own.
 *
 * Merges with whatever is already allowed, so a template that names its own prerelease
 * packages does not lose them. `extraPatterns` carries the template's `minAgeGateExemptions`
 * for dependencies that only `storybook init` adds, which the published `.yarnrc.yml` cannot
 * know about.
 */
export async function preapproveLocallyPublishedPackages(
  cwd: string,
  extraPatterns: string[] = []
) {
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
    new Set([...existing, ...STORYBOOK_PACKAGE_PATTERNS, ...extraPatterns])
  );

  await writeFile(configPath, yml.stringify(config));
}
