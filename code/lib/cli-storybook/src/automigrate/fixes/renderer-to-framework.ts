import { readFile, writeFile } from 'node:fs/promises';

import {
  commonGlobOptions,
  frameworkPackages,
  getProjectRoot,
  rendererPackages,
} from 'storybook/internal/common';
import type { PackageJson } from 'storybook/internal/types';

import prompts from 'prompts';
import { dedent } from 'ts-dedent';

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
  return Object.keys(rendererPackages).filter((pkg) => dependencies.includes(pkg));
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

export const removeRenderersInPackageJson = async (
  packageJsonPath: string,
  renderers: string[],
  dryRun: boolean
) => {
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(content);
    let hasChanges = false;

    renderers.forEach((renderer) => {
      if (packageJson.dependencies?.[renderer]) {
        delete packageJson.dependencies[renderer];
        hasChanges = true;
      }
      if (packageJson.devDependencies?.[renderer]) {
        delete packageJson.devDependencies[renderer];
        hasChanges = true;
      }
    });

    if (!dryRun && hasChanges) {
      await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }

    return hasChanges;
  } catch (error) {
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error(`Failed to update package.json: ${error}`);
  }
};

const selectFramework = async (frameworks: string[]): Promise<string | null> => {
  if (frameworks.length === 1) {
    return frameworks[0];
  }

  const response = await prompts({
    type: 'select',
    name: 'framework',
    message: 'Which framework would you like to use?',
    choices: frameworks.map((framework) => ({
      title: framework,
      value: framework,
    })),
  });

  return response.framework || null;
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

export const rendererToFramework: Fix<MigrationResult, 'renderer-to-framework'> = {
  id: 'renderer-to-framework',
  versionRange: ['<9.0.0', '^9.0.0-0'],
  promptType: 'auto',

  async check(): Promise<MigrationResult | null> {
    const projectRoot = await getProjectRoot();
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');

    const packageJsonFiles = await globby(['**/package.json'], {
      ...commonGlobOptions(''),
      ignore: ['**/node_modules/**'],
      cwd: projectRoot,
      gitignore: true,
      absolute: true,
    });

    // Check each package.json for migration needs
    const results = await Promise.all(
      packageJsonFiles.map(async (file) => {
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
      packageJsonFiles: packageJsonFiles.filter((_, i) => validResults[i] !== null),
    };
  },

  prompt(result: MigrationResult): string {
    if (result.frameworks.length > 1) {
      return dedent`
        As part of Storybook's evolution, we're moving from renderer-based to framework-based configuration.
        We've detected multiple framework packages in your project: ${result.frameworks.join(', ')}.
        You will be prompted to select which framework to use for your Storybook configuration.
        This will update your imports and dependencies to use the framework-specific package.
        Would you like to proceed with the migration?
      `;
    }

    return dedent`
      As part of Storybook's evolution, we're moving from renderer-based to framework-based configuration.
      We've detected renderer packages (${result.renderers.join(', ')}) that can be replaced with the framework package "${result.frameworks[0]}".
      
      This migration will:
      1. Update your source files to use framework-specific imports
      2. Remove the renderer packages from your package.json
      3. Install the necessary framework dependencies
      Would you like to proceed with these changes?
    `;
  },

  async run(options: RunOptions<MigrationResult>) {
    const { result, dryRun = false } = options;
    const selectedFramework = await selectFramework(result.frameworks);

    if (!selectedFramework) {
      console.log('Migration cancelled: No framework selected');
      return;
    }

    const defaultGlob = '**/*.{mjs,cjs,js,jsx,ts,tsx}';
    const { glob } = await prompts({
      type: 'text',
      name: 'glob',
      message: 'Enter a custom glob pattern to scan (or press enter to use default):',
      initial: defaultGlob,
    });

    const projectRoot = await getProjectRoot();

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

    // Transform imports for each renderer
    await Promise.all(
      result.renderers.map((renderer) =>
        transformSourceFiles(sourceFiles, renderer, selectedFramework, dryRun)
      )
    );

    console.log('Updating package.json files...');

    // Update all package.json files to remove renderers
    await Promise.all(
      result.packageJsonFiles.map((file: string) =>
        removeRenderersInPackageJson(file, result.renderers, dryRun)
      )
    );

    // Install dependencies
    if (!dryRun) {
      await options.packageManager.installDependencies();
    }
  },
};
