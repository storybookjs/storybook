/**
 * DISCLAIMER:
 *
 * This file exists with the sole purpose of assisting the documentation snippets during
 * introduction of new features. This will probably used only once or twice, but it's REALLY useful
 * to test codemods as it helps detect many bugs very quickly. It also will be used once we decide
 * to add extra snippets to more renderers.
 */
import os from 'node:os';
import { join } from 'node:path';

import { program } from 'commander';
import { promises as fs } from 'fs';
import pLimit from 'p-limit';
import picocolors from 'picocolors';
import prompts from 'prompts';
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
    filename: string;
    language: string;
    renderer: string;
    tabTitle: string;
    highlightSyntax: string;
    [key: string]: string;
  };
};

type Codemod = {
  getTargetSnippet: (snippetInfo: SnippetInfo) => boolean;
  check: (snippetInfo: SnippetInfo, filePath: string) => boolean;
  transform: (snippetInfo: SnippetInfo) => string | Promise<string>;
};

const previousTabTitle = 'CSF 3';
const newTabTitle = 'CSF Next 🧪';

export async function runSnippetCodemod({
  glob,
  check,
  getTargetSnippet,
  transform,
  dryRun = false,
  promptUser = false,
}: {
  glob: string;
  check: Codemod['check'];
  getTargetSnippet: Codemod['getTargetSnippet'];
  transform: Codemod['transform'];
  dryRun?: boolean;
  promptUser?: boolean;
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

    for (const file of files) {
      await limit(async () => {
        try {
          let source = await fs.readFile(file, 'utf-8');
          const originalSource = source;
          const snippets = extractSnippets(source).filter((snip) => check(snip, file));

          if (snippets.length === 0) {
            unmodifiedCount++;
            return;
          }

          const targetSnippet = snippets.find(getTargetSnippet);
          if (!targetSnippet) {
            skippedCount++;
            return;
          }

          if (promptUser) {
            logger.log(`\nFile: ${picocolors.yellow(file)}`);
            const response = await prompts(
              {
                type: 'confirm',
                name: 'apply',
                message: `Apply codemod?`,
                initial: true,
              },
              {
                onCancel: () => process.exit(0),
              }
            );

            if (!response.apply) {
              skippedCount++;
              return;
            }
          }

          const counterpartSnippets = snippets.filter((snippet) => {
            return (
              snippet !== targetSnippet &&
              snippet.attributes.tabTitle !== previousTabTitle &&
              snippet.attributes.tabTitle !== newTabTitle &&
              snippet.attributes.renderer === targetSnippet.attributes.renderer &&
              snippet.attributes.language !== targetSnippet.attributes.language
            );
          });

          const getSource = (snippet: SnippetInfo) =>
            `\n\`\`\`${formatAttributes(snippet.attributes)}\n${snippet.source}\n\`\`\`\n`;

          const updateTabTitle = (snippet: SnippetInfo, newTitle: string) => {
            return snippet.attributes.tabTitle === newTitle
              ? newTitle
              : snippet.attributes.tabTitle
                ? `${snippet.attributes.tabTitle} (${newTitle})`
                : newTitle;
          };

          const allSnippets = [targetSnippet, ...counterpartSnippets];

          let lastModifiedSnippet = '';
          // clone the snippets and apply codemod, then append them to the bottom
          try {
            let appendedContent = '';

            if (!dryRun) {
              // replace attributes of the original snippets with CSF 3
              await allSnippets.forEach(async (snippet) => {
                // warn us if there is already a tab title
                source = source.replace(
                  formatAttributes(snippet.attributes),
                  formatAttributes({
                    ...snippet.attributes,
                    tabTitle: updateTabTitle(snippet, previousTabTitle),
                  })
                );
                await fs.writeFile(file, source, 'utf-8');
              });
            }

            for (const snippet of allSnippets) {
              // warn us if there is already a tab title
              if (snippet !== targetSnippet) {
                appendedContent +=
                  '\n<!-- JS snippets still needed while providing both CSF 3 & Next -->\n';
              }

              const newSnippet = { ...snippet };
              lastModifiedSnippet = formatAttributes(newSnippet.attributes);
              let transformedSource = getSource({
                ...newSnippet,
                attributes: {
                  ...newSnippet.attributes,
                  renderer: 'react',
                  tabTitle: updateTabTitle(newSnippet, newTabTitle),
                },
                source: await transform(newSnippet),
              });

              if (newSnippet.path.includes('.stories')) {
                transformedSource = transformedSource
                  .replace(/\/\/ Replace your-framework with .*\n/, '')
                  .replace(/\* Replace your-framework with .*\n/, '')
                  .replace(
                    /(import preview from \"#\.storybook\/preview\";)/g,
                    `import preview from '../.storybook/preview';`
                  );
              } else {
                transformedSource = transformedSource
                  .replace(
                    /Replace your-framework with .*\n/,
                    'Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)\n'
                  )
                  .replace(
                    /(import { define(Main|Preview) .*)\n/,
                    '// Replace your-framework with the framework you are using (e.g., react-vite, nextjs, nextjs-vite)\n$1\n'
                  );
              }
              appendedContent += transformedSource;
            }

            const updatedSource = source + appendedContent;

            if (!dryRun) {
              await fs.writeFile(file, updatedSource, 'utf-8');
            } else {
              logger.log(
                `Dry run: would have modified ${picocolors.yellow(file)} with new snippets \n` +
                  picocolors.green(appendedContent)
              );
            }

            modifiedCount++;
          } catch (transformError) {
            logger.error(
              `\nError transforming snippet in file ${picocolors.yellow(file)}:`,
              '\n',
              picocolors.green(lastModifiedSnippet),
              '\n',
              picocolors.red((transformError as any).message)
            );
            errorCount++;
            await fs.writeFile(file, originalSource, 'utf-8');
          }
        } catch (fileError) {
          logger.error(`Error processing file ${file}:`, fileError);
          errorCount++;
        }
      });
    }
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

export function parseAttributes(attributes: string) {
  const attributeRegex = /([a-zA-Z0-9.-]+)="([^"]+)"/g;
  const result: Record<string, string> = {};
  let match;

  while ((match = attributeRegex.exec(attributes)) !== null) {
    result[match[1]] = match[2];
  }

  return result as SnippetInfo['attributes'];
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
    check: (snippetInfo: SnippetInfo, filePath: string) => {
      return (
        snippetInfo.path.includes('.stories') &&
        !snippetInfo.attributes?.filename?.includes('CSF 2') &&
        !filePath.split('/')?.pop()?.startsWith('csf-3') &&
        snippetInfo.attributes.highlightSyntax !== 'mdx' &&
        snippetInfo.attributes.tabTitle !== previousTabTitle &&
        snippetInfo.attributes.tabTitle !== newTabTitle
      );
    },
    getTargetSnippet: (snippetInfo: SnippetInfo) => {
      return (
        snippetInfo.attributes.language === 'ts' &&
        snippetInfo.attributes.tabTitle !== previousTabTitle &&
        snippetInfo.attributes.tabTitle !== newTabTitle &&
        (snippetInfo.attributes.renderer === 'react' ||
          snippetInfo.attributes.renderer === 'common')
      );
    },
    transform: (snippetInfo: SnippetInfo) => {
      return storyToCsfFactory(snippetInfo, {
        previewConfigPath: undefined,
        useSubPathImports: true,
      });
    },
  },
  'csf-factory-config': {
    check: (snippetInfo: SnippetInfo) => {
      return (
        snippetInfo.attributes.tabTitle !== previousTabTitle &&
        snippetInfo.attributes.tabTitle !== newTabTitle &&
        (snippetInfo.path.includes('/preview.') || snippetInfo.path.includes('/main.'))
      );
    },
    getTargetSnippet: (snippetInfo: SnippetInfo) => {
      return (
        snippetInfo.attributes.language === 'ts' &&
        snippetInfo.attributes.tabTitle !== previousTabTitle &&
        snippetInfo.attributes.tabTitle !== newTabTitle &&
        (snippetInfo.attributes.renderer === 'react' ||
          snippetInfo.attributes.renderer === 'common')
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
  .option('--prompt', 'Prompt before applying changes', false)
  .action(async (id, { glob, dryRun, prompt }) => {
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
      promptUser: prompt,
      ...codemod,
    });
  });

// Parse and validate arguments
program.parse(process.argv);
