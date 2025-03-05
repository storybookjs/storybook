import { readFile, writeFile } from 'node:fs/promises';

import { commonGlobOptions, getProjectRoot } from 'storybook/internal/common';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import { consolidatedPackages } from '../helpers/consolidated-packages';
import type { Fix } from '../types';

export interface ConsolidatedPackageJsonOptions {
  files: string[];
}

function transformPackageJson(content: string): string | null {
  const packageJson = JSON.parse(content);
  let hasChanges = false;

  // Check dependencies
  if (packageJson.dependencies) {
    for (const [dep, version] of Object.entries(packageJson.dependencies)) {
      if (dep in consolidatedPackages) {
        delete packageJson.dependencies[dep];
        hasChanges = true;
      }
    }
  }

  // Check devDependencies
  if (packageJson.devDependencies) {
    for (const [dep, version] of Object.entries(packageJson.devDependencies)) {
      if (dep in consolidatedPackages) {
        delete packageJson.devDependencies[dep];
        hasChanges = true;
      }
    }
  }

  // Ensure storybook is in devDependencies
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }
  if (!packageJson.devDependencies.storybook) {
    packageJson.devDependencies.storybook = '^8.0.0';
    hasChanges = true;
  }

  return hasChanges ? JSON.stringify(packageJson, null, 2) : null;
}

export const consolidatedPackageJson: Fix<ConsolidatedPackageJsonOptions> = {
  id: 'consolidated-package-json',
  versionRange: ['<9.0.0', '>=9.0.0'],
  promptType: 'auto',

  async check(): Promise<ConsolidatedPackageJsonOptions | null> {
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');

    const projectRoot = getProjectRoot();
    const patterns = ['**/package.json'];
    const files = (await globby(patterns, {
      ...commonGlobOptions(''),
      ignore: ['**/node_modules/**'],
      cwd: projectRoot,
    })) as string[];

    // Check if any package.json files contain consolidated packages
    const filesWithConsolidatedPackages: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      const packageJson = JSON.parse(content);
      const hasConsolidatedPackage = Object.keys(consolidatedPackages).some((pkg) => {
        return (
          (packageJson.dependencies && pkg in packageJson.dependencies) ||
          (packageJson.devDependencies && pkg in packageJson.devDependencies)
        );
      });

      if (hasConsolidatedPackage) {
        filesWithConsolidatedPackages.push(file);
      }
    }

    return filesWithConsolidatedPackages.length > 0
      ? { files: filesWithConsolidatedPackages }
      : null;
  },

  prompt({ files }) {
    return dedent`
      Found package.json files that contain consolidated Storybook packages that need to be updated:
      ${files.map((file) => `- ${picocolors.cyan(file)}`).join('\n')}

      These packages have been consolidated into the main storybook package and should be removed.
      The main storybook package will be added to devDependencies if not already present.
      Would you like to update these package.json files automatically?
    `;
  },

  async run({ dryRun, result: { files } }) {
    const { default: pLimit } = await import('p-limit');
    const limit = pLimit(10);
    const errors: { file: string; error: Error }[] = [];

    await Promise.all(
      files.map((file) =>
        limit(async () => {
          try {
            const content = await readFile(file, 'utf-8');
            const transformed = transformPackageJson(content);

            if (transformed && !dryRun) {
              await writeFile(file, transformed);
            }
          } catch (error) {
            // eslint-disable-next-line local-rules/no-uncategorized-errors
            errors.push({ file, error: error instanceof Error ? error : new Error(String(error)) });
          }
        })
      )
    );

    if (errors.length > 0) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        `Failed to process ${errors.length} files:\n${errors
          .map(({ file, error }) => `- ${file}: ${error.message}`)
          .join('\n')}`
      );
    }
  },
};
