import prompts from 'prompts';

import { commonGlobOptions } from './common-glob-options';
import { getProjectRoot } from './paths';

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
  const { glob } = force
    ? { glob: defaultGlob }
    : await prompts({
        type: 'text',
        name: 'glob',
        message: promptMessage,
        initial: defaultGlob,
      });

  const projectRoot = getProjectRoot();

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

  // Transform the files using the provided transform function
  return transformFn(sourceFiles, transformOptions, dryRun);
}
