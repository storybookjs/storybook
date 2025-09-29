import { readFile, writeFile } from 'node:fs/promises';

import { transformImportFiles, versions } from 'storybook/internal/common';

import { consolidatedPackages } from '../helpers/consolidated-packages';
import type { Fix } from '../types';

export interface ConsolidatedOptions {
  consolidatedDeps: Set<keyof typeof consolidatedPackages>;
}

function transformPackageJson(content: string): string | null {
  const packageJson = JSON.parse(content);
  let hasChanges = false;

  // Track new packages to add
  const packagesToAdd = new Set<string>();

  // Check both dependencies and devDependencies
  const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

  // Determine where storybook is installed and get its version
  let storybookVersion: string | null = null;
  let storybookDepType: (typeof depTypes)[number] | null = null;

  for (const depType of depTypes) {
    if (packageJson[depType]?.storybook) {
      storybookVersion = packageJson[depType].storybook;
      storybookDepType = depType;
      break;
    }
  }

  for (const depType of depTypes) {
    if (packageJson[depType]) {
      for (const [dep] of Object.entries(packageJson[depType])) {
        if (dep in consolidatedPackages) {
          const newPackage = consolidatedPackages[dep as keyof typeof consolidatedPackages];
          // Only add to packagesToAdd if it's not being consolidated into storybook/* or if it's a sub-path of a consolidated package
          if (!newPackage.startsWith('storybook/') && !newPackage.match(/(?:.*\/){2,}/)) {
            packagesToAdd.add(newPackage);
          }
          delete packageJson[depType][dep];
          hasChanges = true;
        }
      }
    }
  }

  // Add new packages to the same dependency type as storybook
  if (packagesToAdd.size > 0) {
    const version = storybookVersion ?? versions['@storybook/nextjs-vite'];
    const depType = storybookDepType ?? 'devDependencies';
    packageJson[depType] = packageJson[depType] || {};
    for (const pkg of packagesToAdd) {
      packageJson[depType][pkg] = version;
    }
    hasChanges = true;
  }

  return hasChanges ? JSON.stringify(packageJson, null, 2) : null;
}

export const transformPackageJsonFiles = async (files: string[], dryRun: boolean) => {
  const errors: Array<{ file: string; error: Error }> = [];

  const { default: pLimit } = await import('p-limit');

  const limit = pLimit(10);

  await Promise.all(
    files.map((file) =>
      limit(async () => {
        try {
          const contents = await readFile(file, 'utf-8');
          const transformed = transformPackageJson(contents);
          if (!dryRun && transformed) {
            await writeFile(file, transformed);
          }
        } catch (error) {
          errors.push({ file, error: error as Error });
        }
      })
    )
  );

  return errors;
};

export const consolidatedImports: Fix<ConsolidatedOptions> = {
  id: 'consolidated-imports',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#dropped-support-for-legacy-packages',
  check: async ({ packageManager }) => {
    const consolidatedDeps = new Set<keyof typeof consolidatedPackages>();
    const affectedPackageJSONFiles = new Set<string>();

    // Check all package.json files for consolidated packages
    await Promise.all(
      packageManager.packageJsonPaths.map(async (packageJsonPath) => {
        const contents = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(contents);

        // Check both dependencies and devDependencies
        const allDeps = {
          ...(packageJson.dependencies || {}),
          ...(packageJson.devDependencies || {}),
        };

        // Add any consolidated packages to the set
        let hasConsolidatedDeps = false;
        Object.keys(allDeps).forEach((dep) => {
          if (dep in consolidatedPackages) {
            consolidatedDeps.add(dep as keyof typeof consolidatedPackages);
            hasConsolidatedDeps = true;
          }
        });

        if (hasConsolidatedDeps) {
          affectedPackageJSONFiles.add(packageJsonPath);
        }
      })
    );

    if (consolidatedDeps.size === 0) {
      return null;
    }

    return {
      consolidatedDeps,
    };
  },
  prompt: () => {
    return "We've detected Storybook packages that have been renamed or consolidated. We'll update these packages by scanning your codebase and updating any imports from these packages.";
  },
  run: async ({ dryRun = false, packageManager, storiesPaths, configDir }) => {
    const errors: Array<{ file: string; error: Error }> = [];

    const packageJsonErrors = await transformPackageJsonFiles(
      packageManager.packageJsonPaths,
      dryRun
    );
    errors.push(...packageJsonErrors);

    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const configFiles = await globby([`${configDir}/**/*`]);

    const importErrors = await transformImportFiles(
      [...storiesPaths, ...configFiles].filter(Boolean) as string[],
      {
        ...consolidatedPackages,
        'storybook/internal/manager-api': 'storybook/manager-api',
        'storybook/internal/preview-api': 'storybook/preview-api',
        'storybook/internal/theming': 'storybook/theming',
        'storybook/internal/theming/create': 'storybook/theming/create',
        'storybook/internal/test': 'storybook/test',
        'storybook/internal/actions': 'storybook/internal/actions',
        'storybook/internal/actions/decorator': 'storybook/internal/actions/decorator',
        'storybook/internal/highlight': 'storybook/internal/highlight',
        'storybook/internal/viewport': 'storybook/internal/viewport',
      },
      !!dryRun
    );

    errors.push(...importErrors);

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
