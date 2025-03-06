import { readFile, writeFile } from 'node:fs/promises';

import { type NodePath, parser, recast, types as t, traverse } from 'storybook/internal/babel';
import { commonGlobOptions, getProjectRoot } from 'storybook/internal/common';

// eslint-disable-next-line depend/ban-dependencies
import { globby } from 'globby';
import pLimit from 'p-limit';
import { dedent } from 'ts-dedent';

import { type ConsolidatedPackage, consolidatedPackages } from '../helpers/consolidated-packages';
import type { Fix, RunOptions } from '../types';

export interface ConsolidatedOptions {
  packageJsonFiles: string[];
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

  return hasChanges ? JSON.stringify(packageJson, null, 2) : null;
}

function transformImports(source: string) {
  const ast = recast.parse(source, {
    parser: {
      parse(code: string) {
        return parser.parse(code, {
          sourceType: 'unambiguous',
          plugins: ['typescript', 'jsx'],
        });
      },
    },
  });
  let hasChanges = false;

  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const importSource = path.node.source.value;
      if (typeof importSource === 'string' && importSource in consolidatedPackages) {
        path.node.source = t.stringLiteral(
          consolidatedPackages[importSource as ConsolidatedPackage]
        );
        hasChanges = true;
      }
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      if (
        t.isIdentifier(path.node.callee, { name: 'require' }) &&
        path.node.arguments.length > 0 &&
        t.isStringLiteral(path.node.arguments[0])
      ) {
        const arg = path.node.arguments[0];
        if (arg.value in consolidatedPackages) {
          path.node.arguments[0] = t.stringLiteral(
            consolidatedPackages[arg.value as ConsolidatedPackage]
          );
          hasChanges = true;
        }
      }
    },
  });

  return hasChanges ? recast.print(ast).code : null;
}

export const transformPackageJsonFiles = async (files: string[], dryRun: boolean) => {
  const errors: Array<{ file: string; error: Error }> = [];
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

export const transformImportFiles = async (files: string[], dryRun: boolean) => {
  const errors: Array<{ file: string; error: Error }> = [];
  const limit = pLimit(10);

  await Promise.all(
    files.map((file) =>
      limit(async () => {
        try {
          const contents = await readFile(file, 'utf-8');
          const transformed = transformImports(contents);
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
  versionRange: ['^8.0.0', '^9.0.0'],
  check: async () => {
    const projectRoot = getProjectRoot();
    const packageJsonFiles = await globby(['**/package.json'], {
      ...commonGlobOptions(''),
      ignore: ['**/node_modules/**'],
      cwd: projectRoot,
      gitignore: true,
    });

    // check if any of the package.json files have consolidated packages
    const hasConsolidatedDependencies = await Promise.all(
      packageJsonFiles.map(async (file) => {
        const contents = await readFile(file, 'utf-8');
        const packageJson = JSON.parse(contents);
        return (
          Object.keys(packageJson.dependencies || {}).some((dep) => dep in consolidatedPackages) ||
          Object.keys(packageJson.devDependencies || {}).some((dep) => dep in consolidatedPackages)
        );
      })
    ).then((results) => results.some(Boolean));

    if (!hasConsolidatedDependencies) {
      return null;
    }
    return {
      packageJsonFiles,
    };
  },
  prompt: (result: ConsolidatedOptions) => {
    return dedent`
      Found package.json files that contain consolidated Storybook packages that need to be updated:
      ${result.packageJsonFiles.map((file) => `- ${file}`).join('\n')}

      These packages have been consolidated into the main storybook package and should be removed.
      The main storybook package will be added to devDependencies if not already present.
      
      Would you like to:
      1. Update these package.json files
      2. Scan your codebase and update any imports from these consolidated packages
      
      This will ensure your project is properly updated to use the new consolidated package structure.
    `;
  },
  run: async (options: RunOptions<ConsolidatedOptions>) => {
    const { result, dryRun = false } = options;
    const { packageJsonFiles } = result;

    const errors: Array<{ file: string; error: Error }> = [];

    const packageJsonErrors = await transformPackageJsonFiles(packageJsonFiles, dryRun);
    errors.push(...packageJsonErrors);

    const projectRoot = getProjectRoot();
    const sourceFiles = await globby(['**/*.{mjs,cjs,js,jsx,ts,tsx}'], {
      ...commonGlobOptions(''),
      ignore: ['**/node_modules/**'],
      cwd: projectRoot,
    });

    const importErrors = await transformImportFiles(sourceFiles, dryRun);
    errors.push(...importErrors);

    if (errors.length > 0) {
      throw new Error(
        `Failed to process ${errors.length} files:\n${errors
          .map(({ file, error }) => `- ${file}: ${error.message}`)
          .join('\n')}`
      );
    }
  },
};
