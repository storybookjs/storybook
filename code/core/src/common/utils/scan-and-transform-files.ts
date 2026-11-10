import { logger, prompt } from 'storybook/internal/node-logger';

import { glob as tinyglobby } from 'tinyglobby';

import { commonGlobOptions, expandDirectoryPattern } from './common-glob-options.ts';
import { getProjectRoot } from './paths.ts';

/**
 * Helper function to scan for files matching a glob pattern and transform them
 *
 * @param options Configuration options
 * @param transform Function to transform the found files
 * @returns Array of errors encountered during transformation
 */
export async function scanAndTransformFiles<T extends Record<string, unknown>>({
  promptMessage = 'Enter a custom glob pattern to scan (or press enter to use default):',
  defaultGlob = '**/*.{mjs,cjs,js,jsx,ts,tsx,mdx}',
  dryRun = false,
  force = false,
  transformFn,
  transformOptions,
}: {
  promptMessage?: string;
  defaultGlob?: string;
  dryRun: boolean;
  force?: boolean;
  transformFn: (
    files: string[],
    options: T,
    dryRun: boolean
  ) => Promise<Array<{ file: string; error: Error }>>;
  transformOptions: T;
}): Promise<Array<{ file: string; error: Error }>> {
  // Ask for glob pattern
  const glob = force
    ? defaultGlob
    : await prompt.text({
        message: promptMessage,
        initialValue: defaultGlob,
      });

  logger.log('Scanning for affected files...');

  const cwd = getProjectRoot();
  const sourceFiles = await tinyglobby(expandDirectoryPattern(glob, cwd), {
    ...commonGlobOptions(''),
    ignore: ['**/node_modules/**'],
    dot: true,
    cwd,
    absolute: true,
    expandDirectories: false,
  });

  logger.log(`Scanning ${sourceFiles.length} files...`);

  // Transform the files using the provided transform function
  return transformFn(sourceFiles, transformOptions, dryRun);
}
