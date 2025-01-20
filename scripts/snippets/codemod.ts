/* eslint-disable @typescript-eslint/default-param-last */
import os from 'node:os';
import { join } from 'node:path';

import { program } from 'commander';
import { promises as fs } from 'fs';
import pLimit from 'p-limit';
import picocolors from 'picocolors';
import slash from 'slash';

import { configToCsfFactory } from '../../code/lib/cli-storybook/src/codemod/helpers/config-to-csf-factory';
import { storyToCsfFactory } from '../../code/lib/cli-storybook/src/codemod/helpers/story-to-csf-factory';
import { SNIPPETS_DIRECTORY } from '../utils/constants';

const logger = console;

export const maxConcurrentTasks = Math.max(1, os.cpus().length - 1);

type SnippetInfo = {
  path: string;
  source: string;
  attributes: {
    filename?: string;
    language?: string;
    renderer?: string;
    tabTitle?: string;
    highlightSyntax?: string;
    [key: string]: string;
  };
};

type Codemod = {
  check: (snippetInfo: SnippetInfo) => boolean;
  transform: (snippetInfo: SnippetInfo) => string | Promise<string>;
};

export async function runSnippetCodemod({
  glob,
  check,
  transform,
  dryRun = false,
}: {
  glob: string;
  check: Codemod['check'];
  transform: Codemod['transform'];
  dryRun?: boolean;
}) {
  let modifiedCount = 0;
  let unmodifiedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  try {
    // Dynamically import these packages because they are pure ESM modules
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');

    const files = await globby(slash(glob), {
      followSymbolicLinks: true,
      ignore: ['node_modules/**', 'dist/**', 'storybook-static/**', 'build/**'],
    });

    if (!files.length) {
      logger.error(`No files found for pattern ${glob}`);
      return;
    }

    const limit = pLimit(10);

    await Promise.all(
      files.map((file) =>
        limit(async () => {
          try {
            const source = await fs.readFile(file, 'utf-8');
            const snippets = extractSnippets(source);
            if (snippets.length === 0) {
              unmodifiedCount++;
              return;
            }

            const targetSnippet = snippets.find(check);
            if (!targetSnippet) {
              skippedCount++;
              logger.log('Skipping file', file);
              return;
            }

            const counterpartSnippets = snippets.filter((snippet) => {
              return (
                snippet !== targetSnippet &&
                snippet.attributes.renderer === targetSnippet.attributes.renderer &&
                snippet.attributes.language !== targetSnippet.attributes.language
              );
            });

            const getSource = (snippet: SnippetInfo) =>
              `\n\`\`\`${formatAttributes(snippet.attributes)}\n${snippet.source}\n\`\`\`\n`;

            try {
              let appendedContent = '';
              if (counterpartSnippets.length > 0) {
                appendedContent +=
                  '\n<!-- js & ts-4-9 (when applicable) still needed while providing both CSF 3 & 4 -->\n';
              }

              for (const snippet of [targetSnippet, ...counterpartSnippets]) {
                const newSnippet = { ...snippet };
                newSnippet.attributes.tabTitle = 'CSF 4 (experimental)';
                appendedContent += getSource({
                  ...newSnippet,
                  attributes: {
                    ...newSnippet.attributes,
                    renderer: 'react',
                    tabTitle: 'CSF 4 (experimental)',
                  },
                  source: await transform(newSnippet),
                });
              }

              const updatedSource = source + appendedContent;

              if (!dryRun) {
                await fs.writeFile(file, updatedSource, 'utf-8');
              } else {
                logger.log(
                  `Dry run: would have modified ${picocolors.yellow(file)} with \n` +
                    picocolors.green(appendedContent)
                );
              }

              modifiedCount++;
            } catch (transformError) {
              logger.error(`Error transforming snippet in file ${file}:`, transformError);
              errorCount++;
            }
          } catch (fileError) {
            logger.error(`Error processing file ${file}:`, fileError);
            errorCount++;
          }
        })
      )
    );
  } catch (error) {
    logger.error('Error applying snippet transform:', error);
    errorCount++;
  }

  logger.log(
    `Summary: ${picocolors.green(`${modifiedCount} files modified`)}, ${picocolors.yellow(`${unmodifiedCount} files unmodified`)}, ${picocolors.gray(`${skippedCount} skipped`)}, ${picocolors.red(`${errorCount} errors`)}`
  );
}

export function extractSnippets(source: string): SnippetInfo[] {
  const snippetRegex =
    /```(?<highlightSyntax>[a-zA-Z0-9]+)?(?<attributes>[^\n]*)\n(?<content>[\s\S]*?)```/g;
  const snippets: SnippetInfo[] = [];
  let match;

  while ((match = snippetRegex.exec(source)) !== null) {
    const { highlightSyntax, attributes, content } = match.groups || {};
    const snippetAttributes = parseAttributes(attributes || '');
    if (highlightSyntax) {
      snippetAttributes.highlightSyntax = highlightSyntax.trim();
    }

    snippets.push({
      path: snippetAttributes.filename || '',
      source: content.trim(),
      attributes: snippetAttributes,
    });
  }

  return snippets;
}

export function parseAttributes(attributes: string): Record<string, string> {
  const attributeRegex = /([a-zA-Z0-9.-]+)="([^"]+)"/g;
  const result: Record<string, string> = {};
  let match;

  while ((match = attributeRegex.exec(attributes)) !== null) {
    result[match[1]] = match[2];
  }

  return result;
}

function formatAttributes(attributes: Record<string, string>): string {
  const formatted = Object.entries(attributes)
    .filter(([key]) => key !== 'highlightSyntax')
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  return `${attributes.highlightSyntax || 'js'} ${formatted}`;
}

const codemods: Record<string, Codemod> = {
  'csf-factory-story': {
    check: (snippetInfo: SnippetInfo) => {
      return (
        snippetInfo.path.includes('.stories') &&
        snippetInfo.attributes.tabTitle !== 'CSF 4 (experimental)' &&
        snippetInfo.attributes.language === 'ts' &&
        (snippetInfo.attributes.renderer === 'react' ||
          snippetInfo.attributes.renderer === 'common')
      );
    },
    transform: storyToCsfFactory,
  },
  'csf-factory-config': {
    check: (snippetInfo: SnippetInfo) => {
      return (
        snippetInfo.attributes.tabTitle !== 'CSF 4 (experimental)' &&
        (snippetInfo.path.includes('preview') || snippetInfo.path.includes('main'))
      );
    },
    transform: (snippetInfo: SnippetInfo) => {
      const configType = snippetInfo.path.includes('preview') ? 'preview' : 'main';
      return configToCsfFactory(snippetInfo, {
        configType,
        frameworkPackage: '@storybook/your-framework',
      });
    },
  },
};

program
  .name('command')
  .description('A minimal CLI for demonstration')
  .argument('<id>', 'ID to process')
  .requiredOption('--glob <pattern>', 'Glob pattern to match')
  .option('--dry-run', 'Run without making actual changes', false)
  .action(async (id, { glob, dryRun }) => {
    const codemod = codemods[id as keyof typeof codemods];
    if (!codemod) {
      logger.error(`Unknown codemod "${id}"`);
      logger.log(
        `\n\nAvailable codemods: ${Object.keys(codemods)
          .map((c) => `\n- ${c}`)
          .join('')}`
      );
      process.exit(1);
    }

    await runSnippetCodemod({
      glob: join(SNIPPETS_DIRECTORY, glob),
      dryRun,
      ...codemod,
    });
  });

// Parse and validate arguments
program.parse(process.argv);
