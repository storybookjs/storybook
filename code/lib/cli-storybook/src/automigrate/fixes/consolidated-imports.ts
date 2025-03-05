import { readFile, writeFile } from 'node:fs/promises';

import { type NodePath, parser, recast, types as t, traverse } from 'storybook/internal/babel';
import { commonGlobOptions } from 'storybook/internal/common';

import picocolors from 'picocolors';
import { dedent } from 'ts-dedent';

import type { Fix } from '../types';

const consolidatedPackages = {
  '@storybook/channels': 'storybook/internal/channels',
  '@storybook/client-logger': 'storybook/internal/client-logger',
  '@storybook/core-common': 'storybook/internal/common',
  '@storybook/core-events': 'storybook/internal/core-events',
  '@storybook/csf-tools': 'storybook/internal/csf-tools',
  '@storybook/docs-tools': 'storybook/internal/docs-tools',
  '@storybook/node-logger': 'storybook/internal/node-logger',
  '@storybook/preview-api': 'storybook/internal/preview-api',
  '@storybook/router': 'storybook/internal/router',
  '@storybook/telemetry': 'storybook/internal/telemetry',
  '@storybook/theming': 'storybook/internal/theming',
  '@storybook/types': 'storybook/internal/types',
  '@storybook/manager-api': 'storybook/internal/manager-api',
  '@storybook/manager': 'storybook/internal/manager',
  '@storybook/preview': 'storybook/internal/preview',
  '@storybook/core-server': 'storybook/internal/core-server',
  '@storybook/builder-manager': 'storybook/internal/builder-manager',
  '@storybook/components': 'storybook/internal/components',
} as const;

type ConsolidatedPackage = keyof typeof consolidatedPackages;

export interface ConsolidatedImportsOptions {
  files: string[];
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

export const consolidatedImports: Fix<ConsolidatedImportsOptions> = {
  id: 'consolidated-imports',
  versionRange: ['<8.0.0', '>=8.0.0'],
  promptType: 'auto',

  async check(): Promise<ConsolidatedImportsOptions | null> {
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');

    const patterns = ['**/*.{js,jsx,ts,tsx}'];
    const files = (await globby(patterns, {
      ...commonGlobOptions(''),
      ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
    })) as string[];

    // Check if any files contain imports from consolidated packages
    const filesWithConsolidatedImports: string[] = [];

    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      const hasConsolidatedImport = Object.keys(consolidatedPackages).some((pkg) =>
        content.includes(pkg)
      );

      if (hasConsolidatedImport) {
        filesWithConsolidatedImports.push(file);
      }
    }

    return filesWithConsolidatedImports.length > 0 ? { files: filesWithConsolidatedImports } : null;
  },

  prompt({ files }) {
    return dedent`
      Found usage of consolidated Storybook packages that need to be updated to use internal paths:
      ${files.map((file) => `- ${picocolors.cyan(file)}`).join('\n')}

      These packages have been consolidated into internal modules and should be imported from their new paths.
      Would you like to update these imports automatically?
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
            const transformed = transformImports(content);

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
