import { readFile, writeFile } from 'node:fs/promises';

import { commonGlobOptions, getProjectRoot, versions } from 'storybook/internal/common';

import picocolors from 'picocolors';
import prompts from 'prompts';
import { dedent } from 'ts-dedent';

import { consolidatedPackages } from '../helpers/consolidated-packages';
import { transformImportFiles } from '../helpers/transformImports';
import type { Fix, RunOptions } from '../types';

export interface ConsolidatedOptions {
  packageJsonFiles: string[];
  consolidatedDeps: Set<keyof typeof consolidatedPackages>;
}

function transformPackageJson(content: string): string | null {
  const packageJson = JSON.parse(content);
  let hasChanges = false;

  // Track new packages to add
  const packagesToAdd = new Set<string>();

  // Check both dependencies and devDependencies
  const depTypes = ['dependencies', 'devDependencies'] as const;

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
  versionRange: ['<9.0.0', '^9.0.0-0 || ^9.0.0'],
  check: async () => {
    const projectRoot = getProjectRoot();
    // eslint-disable-next-line depend/ban-dependencies
    const globby = (await import('globby')).globby;

    const packageJsonFiles = await globby(['**/package.json'], {
      ...commonGlobOptions(''),
      ignore: ['**/node_modules/**'],
      cwd: projectRoot,
      gitignore: true,
      absolute: true,
    });

    const consolidatedDeps = new Set<keyof typeof consolidatedPackages>();
    const affectedPackageJSONFiles = new Set<string>();

    // Check all package.json files for consolidated packages
    await Promise.all(
      packageJsonFiles.map(async (file) => {
        const contents = await readFile(file, 'utf-8');
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
          affectedPackageJSONFiles.add(file);
        }
      })
    );

    if (consolidatedDeps.size === 0) {
      return null;
    }

    return {
      consolidatedDeps,
      packageJsonFiles: Array.from(affectedPackageJSONFiles),
    };
  },
  prompt: (result: ConsolidatedOptions) => {
    return dedent`
      Found package.json files that contain consolidated or renamed Storybook packages that need to be updated:
      ${result.packageJsonFiles.map((file) => `- ${file}`).join('\n')}

      We will automatically rename the following packages:
      ${Array.from(result.consolidatedDeps)
        .map((dep) => `- ${picocolors.red(dep)} -> ${picocolors.cyan(consolidatedPackages[dep])}`)
        .join('\n')}

      These packages have been renamed or consolidated into the main ${picocolors.cyan('storybook')} package and should be removed.
      The main ${picocolors.cyan('storybook')} package will be added to devDependencies if not already present.
      
      Would you like to:
      1. Update these package.json files
      2. Scan your codebase and update any imports from these updated packages
      
      This will ensure your project is properly updated to use the new updated package structure and to use the latest package names.
    `;
  },
  run: async (options: RunOptions<ConsolidatedOptions>) => {
    const { result, dryRun = false } = options;
    const { packageJsonFiles } = result;

    const errors: Array<{ file: string; error: Error }> = [];

    const packageJsonErrors = await transformPackageJsonFiles(packageJsonFiles, dryRun);
    errors.push(...packageJsonErrors);

    const projectRoot = getProjectRoot();

    const defaultGlob = '**/*.{mjs,cjs,js,jsx,ts,tsx,mdx}';
    // Find all files matching the glob pattern
    const { glob } = await prompts({
      type: 'text',
      name: 'glob',
      message:
        'Enter a custom glob pattern (relative to the project root) to scan (or press enter to use default):',
      initial: defaultGlob,
    });

    console.log('Scanning for affected files...');

    // eslint-disable-next-line depend/ban-dependencies
    const globby = (await import('globby')).globby;

    const sourceFiles = await globby([glob], {
      ...commonGlobOptions(''),
      ignore: ['**/node_modules/**'],
      dot: true,
      cwd: projectRoot,
      absolute: true,
    });

    console.log(`Scanning ${sourceFiles.length} files...`);

    const importErrors = await transformImportFiles(sourceFiles, consolidatedPackages, dryRun);
    errors.push(...importErrors);

    if (errors.length > 0) {
      // eslint-disable-next-line local-rules/no-uncategorized-errors
      throw new Error(
        `Failed to process ${errors.length} files:\n${errors
          .map(({ file, error }) => `- ${file}: ${error.message}`)
          .join('\n')}`
      );
    }

    if (!dryRun && result.packageJsonFiles.length > 0) {
      await options.packageManager.installDependencies();
    }
  },
};
