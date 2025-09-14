import { readFile, writeFile } from 'node:fs/promises';

import {
  frameworkPackages,
  frameworkToRenderer,
  rendererPackages,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { PackageJson } from 'storybook/internal/types';

import type { Fix, RunOptions } from '../types';

interface MigrationResult {
  frameworks: string[];
  renderers: string[];
  packageJsonFiles: string[];
}

const getAllDependencies = (packageJson: PackageJson): string[] =>
  Object.keys({
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {}),
  });

const detectFrameworks = (dependencies: string[]): string[] => {
  return Object.keys(frameworkPackages).filter((pkg) => dependencies.includes(pkg));
};

const detectRenderers = (dependencies: string[]): string[] => {
  return Object.keys(rendererPackages)
    .filter((pkg) => dependencies.includes(pkg))
    .filter((pkg) => !Object.keys(frameworkPackages).includes(pkg));
};

const replaceImports = (source: string, renderer: string, framework: string) => {
  const regex = new RegExp(`(['"])${renderer}(['"])`, 'g');
  return regex.test(source) ? source.replace(regex, `$1${framework}$2`) : null;
};

export const transformSourceFiles = async (
  files: string[],
  renderer: string,
  framework: string,
  dryRun: boolean
) => {
  const errors: Array<{ file: string; error: Error }> = [];
  const { default: pLimit } = await import('p-limit');
  const limit = pLimit(10);

  await Promise.all(
    files.map((file) =>
      limit(async () => {
        try {
          const contents = await readFile(file, 'utf-8');
          const transformed = replaceImports(contents, renderer, framework);
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

export const removeRendererInPackageJson = async (
  packageJsonPath: string,
  renderer: string,
  dryRun: boolean
) => {
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    let hasChanges = false;

    if (packageJson.dependencies?.[renderer]) {
      delete packageJson.dependencies[renderer];
      hasChanges = true;
    }
    if (packageJson.devDependencies?.[renderer]) {
      delete packageJson.devDependencies[renderer];
      hasChanges = true;
    }

    if (!dryRun && hasChanges) {
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }

    return hasChanges;
  } catch (error) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(`Failed to update package.json: ${error}`);
  }
};

// Helper to check if a package.json needs migration
const checkPackageJson = async (
  packageJsonPath: string
): Promise<{ frameworks: string[]; renderers: string[] } | null> => {
  const content = await readFile(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(content);
  const dependencies = getAllDependencies(packageJson);

  const frameworks = detectFrameworks(dependencies);
  if (frameworks.length === 0) {
    return null;
  }

  const renderers = detectRenderers(dependencies);
  if (renderers.length === 0) {
    return null;
  }

  return { frameworks, renderers };
};

export const rendererToFramework: Fix<MigrationResult> = {
  id: 'renderer-to-framework',
  promptType: 'auto',
  link: 'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#moving-from-renderer-based-to-framework-based-configuration',

  async check({ packageManager }): Promise<MigrationResult | null> {
    // Check each package.json for migration needs
    const results = await Promise.all(
      packageManager.packageJsonPaths.map(async (file) => {
        try {
          return await checkPackageJson(file);
        } catch (error) {
          return null;
        }
      })
    );
    const validResults = results.filter(
      (r): r is { frameworks: string[]; renderers: string[] } =>
        r !== null && r.renderers.length > 0
    );

    if (validResults.length === 0) {
      return null;
    }

    return {
      frameworks: [...new Set(validResults.flatMap((r) => r.frameworks))],
      renderers: [...new Set(validResults.flatMap((r) => r.renderers))],
      packageJsonFiles: packageManager.packageJsonPaths.filter((_, i) => validResults[i] !== null),
    };
  },

  prompt(): string {
    return `We're moving from renderer-based to framework-based configuration and update your imports and dependencies accordingly.`;
  },

  async run(options: RunOptions<MigrationResult>) {
    const { result, dryRun = false, storiesPaths, configDir } = options;

    for (const selectedFramework of result.frameworks) {
      const frameworkName = frameworkPackages[selectedFramework];
      if (!frameworkName) {
        logger.warn(`Framework name not found for ${selectedFramework}, skipping.`);
        continue;
      }
      const rendererName = frameworkToRenderer[frameworkPackages[selectedFramework]];
      const [rendererPackage] =
        Object.entries(rendererPackages).find(([, renderer]) => renderer === rendererName) ?? [];

      if (!rendererPackage) {
        logger.warn(`Renderer package not found for ${selectedFramework}, skipping.`);
        continue;
      }

      if (rendererPackage === selectedFramework) {
        continue;
      }

      logger.debug(`\nMigrating ${rendererPackage} to ${selectedFramework}`);

      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      const configFiles = await globby([`${configDir}/**/*`]);

      await transformSourceFiles(
        [...storiesPaths, ...configFiles].filter(Boolean) as string[],
        rendererPackage,
        selectedFramework,
        dryRun
      );

      logger.debug('Updating package.json files...');

      // Update all package.json files to remove renderers
      await Promise.all(
        result.packageJsonFiles.map((file: string) =>
          removeRendererInPackageJson(file, rendererPackage, dryRun)
        )
      );
    }
  },
};
