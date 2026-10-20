/**
 * DISCLAIMER:
 *
 * This file exists with the sole purpose of assisting the documentation snippets during
 * introduction of new features. This will probably used only once or twice, but it's REALLY useful
 * to test codemods as it helps detect many bugs very quickly. It also will be used once we decide
 * to add extra snippets to more renderers.
 */
import os from 'node:os';
import { basename, join } from 'node:path';

import { program } from 'commander';
import { promises as fs } from 'fs';
import pLimit from 'p-limit';
import picocolors from 'picocolors';
import prompts from 'prompts';
// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

import { configToCsfFactory } from '../../code/lib/cli-storybook/src/codemod/helpers/config-to-csf-factory.ts';
import { storyToCsfFactory } from '../../code/lib/cli-storybook/src/codemod/helpers/story-to-csf-factory.ts';
import { SNIPPETS_DIRECTORY } from '../utils/constants.ts';

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

// --- svelte-csf-next codemod -------------------------------------------------
// Converts Svelte story snippets to the CSF Next (factories) syntax established by PR #36702:
// per renderer="svelte" fence group, the "CSF 3" fences are deleted and a "Svelte CSF Next 🧪"
// fence derived from the group's "Svelte CSF" fence is inserted right after it. Kept Svelte CSF
// fences stop importing defineMeta from the legacy addon and import it from the framework package.

type SvelteFence = {
  openIndex: number;
  closeIndex: number;
  attributes: Record<string, string>;
  contentLines: string[];
};

const svelteCsfTabTitle = 'Svelte CSF';
const svelteCsfNextTabTitle = 'Svelte CSF Next 🧪';
const svelteCsf3TabTitle = 'CSF 3';
const sveltePreviewImportSpecifier = '../.storybook/preview';
// The Before/After migration didactics keep the addon imports they teach migrating away from
const svelteMigrationSnippetFiles = new Set([
  'svelte-csf-addon-tags.md',
  'svelte-csf-story-custom-children.md',
  'svelte-csf-story-migration.md',
]);
// These groups document SvelteKit-only features, so their Svelte CSF fences import from the SvelteKit framework
const sveltekitSnippetFiles = new Set(['sveltekit-mock-features.md', 'sveltekit-mock-links.md']);

const defineMetaAddonImportPattern =
  /^(\s*)import\s*\{\s*defineMeta\s*\}\s*from\s*(['"])@storybook\/addon-svelte-csf\2(;?)$/;
const defineMetaImportPattern =
  /^(\s*)import\s*\{\s*defineMeta\s*\}\s*from\s*(['"])(@storybook\/addon-svelte-csf|@storybook\/svelte-vite|@storybook\/sveltekit)\2(;?)$/;

export function findFences(lines: string[]): SvelteFence[] {
  const fences: SvelteFence[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith('```')) {
      continue;
    }
    let closeIndex = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].startsWith('```')) {
        closeIndex = j;
        break;
      }
    }
    if (closeIndex === -1) {
      break;
    }
    fences.push({
      openIndex: i,
      closeIndex,
      attributes: parseAttributes(lines[i].slice(3).trim()),
      contentLines: lines.slice(i + 1, closeIndex),
    });
    i = closeIndex;
  }
  return fences;
}

function rewriteDefineMetaImport(line: string, frameworkPackage: string): string {
  return line.replace(
    defineMetaAddonImportPattern,
    (_match, indent: string, quote: string, semicolon: string) =>
      `${indent}import { defineMeta } from ${quote}${frameworkPackage}${quote}${semicolon}`
  );
}

// Derives the "Svelte CSF Next 🧪" fence content from its "Svelte CSF" mirror: the defineMeta
// import is replaced with the relative preview import, the call becomes preview.meta, and the
// ts variant gets lang="ts" on the module script. Everything else stays byte-identical.
function buildSvelteCsfNextFence(mirror: SvelteFence, language: string): string[] | string {
  if (!mirror.attributes.filename) {
    return 'the Svelte CSF fence has no filename attribute';
  }

  const content: string[] = [];
  let scriptTagFound = false;
  let importReplaced = false;
  let defineMetaCallFound = false;

  for (const line of mirror.contentLines) {
    let next = line;
    if (!scriptTagFound && /^\s*<script module( lang="ts")?>$/.test(next)) {
      scriptTagFound = true;
      if (language === 'ts') {
        next = next.replace(/<script module>$/, '<script module lang="ts">');
      }
    }
    if (!importReplaced) {
      const rewritten = next.replace(
        defineMetaImportPattern,
        (_match, indent: string, quote: string, _source: string, semicolon: string) =>
          `${indent}import preview from ${quote}${sveltePreviewImportSpecifier}${quote}${semicolon}`
      );
      if (rewritten !== next) {
        importReplaced = true;
        next = rewritten;
      }
    }
    if (next.includes('defineMeta(')) {
      defineMetaCallFound = true;
      next = next.replaceAll('defineMeta(', 'preview.meta(');
    }
    content.push(next);
  }

  if (!scriptTagFound) {
    return 'the Svelte CSF fence has no <script module> tag';
  }
  if (!importReplaced) {
    return 'the Svelte CSF fence has no defineMeta import';
  }
  if (!defineMetaCallFound) {
    return 'the Svelte CSF fence has no defineMeta call';
  }

  return [
    `\`\`\`svelte filename="${mirror.attributes.filename}" renderer="svelte" language="${language}" tabTitle="${svelteCsfNextTabTitle}"`,
    ...content,
    '```',
  ];
}

// Returns the transformed file source, or a stop reason when the file doesn't match the
// expected shape. Stopped files are left byte-identical and reported for hand review.
export function transformSvelteCsfNextFile(
  filePath: string,
  source: string
): { source: string; changed: boolean; stopReason?: string } {
  const fileName = basename(filePath);
  const lines = source.split('\n');
  const rewritten = [...lines];

  // Kept Svelte CSF fences import defineMeta from the framework package their reader uses.
  if (!svelteMigrationSnippetFiles.has(fileName)) {
    const frameworkPackage = sveltekitSnippetFiles.has(fileName)
      ? '@storybook/sveltekit'
      : '@storybook/svelte-vite';
    for (let i = 0; i < rewritten.length; i++) {
      rewritten[i] = rewriteDefineMetaImport(rewritten[i], frameworkPackage);
    }
  }

  const svelteFences = findFences(rewritten).filter(
    (fence) => fence.attributes.renderer === 'svelte'
  );
  const languages = [
    ...new Set(svelteFences.map((fence) => fence.attributes.language).filter(Boolean)),
  ];

  type Operation =
    | { position: number; kind: 'delete'; count: number }
    | { position: number; kind: 'insert'; inserted: string[] };
  const operations: Operation[] = [];

  for (const language of languages) {
    const mirrors = svelteFences.filter(
      (fence) =>
        fence.attributes.language === language && fence.attributes.tabTitle === svelteCsfTabTitle
    );
    const victims = svelteFences.filter(
      (fence) =>
        fence.attributes.language === language && fence.attributes.tabTitle === svelteCsf3TabTitle
    );
    if (victims.length === 0) {
      continue;
    }
    if (mirrors.length !== 1) {
      return {
        source,
        changed: false,
        stopReason: `expected exactly one "${svelteCsfTabTitle}" fence for language=${language}, found ${mirrors.length}`,
      };
    }
    if (victims.length !== 1) {
      return {
        source,
        changed: false,
        stopReason: `expected exactly one "${svelteCsf3TabTitle}" fence for language=${language}, found ${victims.length}`,
      };
    }

    const nextFence = buildSvelteCsfNextFence(mirrors[0], language);
    if (typeof nextFence === 'string') {
      return { source, changed: false, stopReason: nextFence };
    }

    // Insert the new fence right after its mirror, and delete the CSF 3 fence plus one adjacent
    // blank line (before preferred) so no double blank line is left at the seam.
    const victim = victims[0];
    const beforeBlank = lines[victim.openIndex - 1] === '';
    const afterBlank = !beforeBlank && lines[victim.closeIndex + 1] === '';
    const deleteStart = beforeBlank ? victim.openIndex - 1 : victim.openIndex;
    const deleteCount = victim.closeIndex - deleteStart + 1 + (afterBlank ? 1 : 0);

    operations.push({ position: deleteStart, kind: 'delete', count: deleteCount });
    operations.push({
      position: mirrors[0].closeIndex + 1,
      kind: 'insert',
      inserted: ['', ...nextFence],
    });
  }

  const importFixed = rewritten.some((line, index) => line !== lines[index]);

  if (operations.length === 0) {
    return { source: rewritten.join('\n'), changed: importFixed };
  }

  operations.sort((a, b) => b.position - a.position || (a.kind === 'delete' ? -1 : 1));
  for (const operation of operations) {
    if (operation.kind === 'delete') {
      rewritten.splice(operation.position, operation.count);
    } else {
      rewritten.splice(operation.position, 0, ...operation.inserted);
    }
  }

  return { source: rewritten.join('\n'), changed: true };
}

async function runSvelteCsfNextCodemod({ glob, dryRun }: { glob: string; dryRun?: boolean }) {
  const stoppedFiles: string[] = [];
  let modifiedCount = 0;

  // Dynamically import this package because it is a pure ESM module
  // eslint-disable-next-line depend/ban-dependencies
  const { globby } = await import('globby');

  const files = (
    await globby(slash(glob), {
      followSymbolicLinks: true,
      ignore: ['node_modules/**', 'dist/**', 'storybook-static/**', 'build/**'],
    })
  ).sort();

  if (!files.length) {
    logger.error(`No files found for pattern ${glob}`);
    return;
  }

  for (const file of files) {
    const source = await fs.readFile(file, 'utf-8');
    const result = transformSvelteCsfNextFile(file, source);
    if (result.stopReason) {
      stoppedFiles.push(`${basename(file)}: ${result.stopReason}`);
      continue;
    }
    if (!result.changed) {
      continue;
    }
    modifiedCount++;
    if (!dryRun) {
      await fs.writeFile(file, result.source, 'utf-8');
    }
  }

  logger.log(
    `Summary: ${picocolors.green(`${modifiedCount} files ${dryRun ? 'would be ' : ''}modified`)}, ${picocolors.red(`${stoppedFiles.length} files stopped`)}`
  );
  if (stoppedFiles.length > 0) {
    logger.log('Stopped files (left unchanged, review by hand):');
    for (const entry of stoppedFiles) {
      logger.log(`  - ${entry}`);
    }
  }
}

// --- end svelte-csf-next codemod ---------------------------------------------

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
      return storyToCsfFactory(snippetInfo, { useSubPathImports: true });
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
    if (id === 'svelte-csf-next') {
      await runSvelteCsfNextCodemod({
        glob: join(SNIPPETS_DIRECTORY, glob),
        dryRun,
      });
      return;
    }

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
