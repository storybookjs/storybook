import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  type JsPackageManager,
  frameworkPackages,
  frameworkToRenderer,
  rendererPackages,
} from 'storybook/internal/common';
import { logger } from 'storybook/internal/node-logger';
import type { PackageJson } from 'storybook/internal/types';

import type { Fix, RunOptions } from '../types.ts';

interface MigrationResult {
  migrations: {
    framework: string;
    renderer: string;
    packageJsonFiles: string[];
  }[];
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

const hasRendererImport = (source: string, renderer: string) => {
  const regex = new RegExp(`(['"])${renderer}(?:/[^'"]*)?\\1`);
  return regex.test(source);
};

export const packageUsesRenderer = async (packageJsonPath: string, renderer: string) => {
  // eslint-disable-next-line depend/ban-dependencies
  const { globby } = await import('globby');
  const files = await globby(['**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts,mdx}'], {
    absolute: true,
    cwd: dirname(packageJsonPath),
    dot: true,
    ignore: ['**/dist/**', '**/node_modules/**'],
  });

  return (
    await Promise.all(
      files.map(async (file) => {
        try {
          return hasRendererImport(await readFile(file, 'utf-8'), renderer);
        } catch {
          return true;
        }
      })
    )
  ).some(Boolean);
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
  dryRun: boolean,
  packageManager?: Pick<JsPackageManager, 'writePackageJson'>
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
      if (packageManager) {
        packageManager.writePackageJson(packageJson, dirname(packageJsonPath));
      } else {
        await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
      }
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
    const results = await Promise.all(
      packageManager.packageJsonPaths.map(async (file) => {
        try {
          return { file, result: await checkPackageJson(file) };
        } catch (error) {
          return null;
        }
      })
    );
    const migrations = new Map<
      string,
      { framework: string; renderer: string; packageJsonFiles: string[] }
    >();

    for (const item of results) {
      if (!item?.result) {
        continue;
      }

      for (const framework of item.result.frameworks) {
        const renderer = frameworkToRenderer[frameworkPackages[framework]];
        const rendererPackage = Object.entries(rendererPackages).find(
          ([, rendererName]) => rendererName === renderer
        )?.[0];

        if (!rendererPackage || !item.result.renderers.includes(rendererPackage)) {
          continue;
        }

        const migration = migrations.get(framework) ?? {
          framework,
          renderer: rendererPackage,
          packageJsonFiles: [],
        };
        migration.packageJsonFiles.push(item.file);
        migrations.set(framework, migration);
      }
    }

    if (migrations.size === 0) {
      return null;
    }

    return { migrations: [...migrations.values()] };
  },

  prompt(): string {
    return `We're moving from renderer-based to framework-based configuration and update your imports and dependencies accordingly.`;
  },

  async run(options: RunOptions<MigrationResult>) {
    const { result, dryRun = false, storiesPaths, configDir } = options;

    for (const migration of result.migrations) {
      const { framework, renderer: rendererPackage, packageJsonFiles } = migration;

      logger.debug(`\nMigrating ${rendererPackage} to ${framework}`);

      // eslint-disable-next-line depend/ban-dependencies
      const { globby } = await import('globby');
      const configFiles = await globby([`${configDir}/**/*`]);

      const errors = await transformSourceFiles(
        [...storiesPaths, ...configFiles].filter(Boolean) as string[],
        rendererPackage,
        framework,
        dryRun
      );
      if (errors.length > 0) {
        throw new Error(
          `Failed to process ${errors.length} files:\n${errors
            .map(({ file, error }) => `- ${file}: ${error.message}`)
            .join('\n')}`
        );
      }

      logger.debug('Updating package.json files...');

      const unusedRendererPackageJsonFiles = (
        await Promise.all(
          packageJsonFiles.map(async (file) => ({
            file,
            usesRenderer: await packageUsesRenderer(file, rendererPackage),
          }))
        )
      )
        .filter(({ usesRenderer }) => !usesRenderer)
        .map(({ file }) => file);

      await Promise.all(
        unusedRendererPackageJsonFiles.map((file) =>
          removeRendererInPackageJson(file, rendererPackage, dryRun, options.packageManager)
        )
      );
    }
  },
};
