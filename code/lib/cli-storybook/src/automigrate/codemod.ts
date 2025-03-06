import os from 'node:os';

import { formatFileContent } from 'storybook/internal/common';

import { promises as fs } from 'fs';
import picocolors from 'picocolors';
import slash from 'slash';

const logger = console;

export const maxConcurrentTasks = Math.max(1, os.cpus().length - 1);

export interface FileInfo {
  path: string;
  source: string;
  [key: string]: any;
}

/**
 * Runs a codemod transformation on files matching the specified glob pattern.
 *
 * The function processes each file matching the glob pattern, applies the transform function, and
 * writes the transformed source back to the file if it has changed.
 *
 * @example
 *
 * ```
 * await runCodemod('*.stories.tsx', async (fileInfo) => {
 *   // Transform the file source return
 *   return fileInfo.source.replace(/foo/g, 'bar');
 * });
 * ```
 */
export async function runCodemod(
  globPattern: string = '**/*.stories.*',
  transform: (source: FileInfo, ...rest: any) => Promise<string>,
  { dryRun = false, skipFormatting = false }: { dryRun?: boolean; skipFormatting?: boolean } = {}
) {
  let modifiedCount = 0;
  let unmodifiedCount = 0;
  let errorCount = 0;

  // Dynamically import these packages because they are pure ESM modules
  // eslint-disable-next-line depend/ban-dependencies
  const { globby } = await import('globby');

  // glob only supports forward slashes
  const files = await globby(slash(globPattern), {
    followSymbolicLinks: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/storybook-static/**', '**/build/**'],
  });

  if (!files.length) {
    logger.error(
      `No files found for glob pattern "${globPattern}".\nPlease try a different pattern.\n`
    );
    // eslint-disable-next-line local-rules/no-uncategorized-errors
    throw new Error('No files matched');
  }

  try {
    const pLimit = (await import('p-limit')).default;

    const limit = pLimit(maxConcurrentTasks);

    await Promise.all(
      files.map((file: string) =>
        limit(async () => {
          try {
            let filePath = file;
            try {
              filePath = await fs.realpath(file);
            } catch (err) {
              // if anything goes wrong when resolving the file, fallback to original path as is set above
            }

            const source = await fs.readFile(filePath, 'utf-8');
            const fileInfo: FileInfo = { path: filePath, source };
            const transformedSource = await transform(fileInfo);

            if (transformedSource !== source) {
              if (!dryRun) {
                const fileContent = skipFormatting
                  ? transformedSource
                  : await formatFileContent(file, transformedSource);
                await fs.writeFile(file, fileContent, 'utf-8');
              }
              modifiedCount++;
            } else {
              unmodifiedCount++;
            }
          } catch (fileError) {
            logger.error(`Error processing file ${file}:`, fileError);
            errorCount++;
          }
        })
      )
    );
  } catch (error) {
    logger.error('Error applying transform:', error);
    errorCount++;
  }

  logger.log(
    `Summary: ${picocolors.green(`${modifiedCount} transformed`)}, ${picocolors.yellow(`${unmodifiedCount} unmodified`)}, ${picocolors.red(`${errorCount} errors`)}`
  );

  if (dryRun) {
    logger.log(
      picocolors.bold(
        `This was a dry run. Run without --dry-run to apply the transformation to ${modifiedCount} files.`
      )
    );
  }
}
