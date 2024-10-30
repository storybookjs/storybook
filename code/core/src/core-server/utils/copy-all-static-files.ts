import { cp } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { getDirectoryFromWorkingDir } from '@storybook/core/common';

import { logger } from '@storybook/core/node-logger';

import picocolors from 'picocolors';

import { parseStaticDir } from './server-statics';

export async function copyAllStaticFiles(staticDirs: any[] | undefined, outputDir: string) {
  if (staticDirs && staticDirs.length > 0) {
    await Promise.all(
      staticDirs.map(async (dir) => {
        try {
          const { staticDir, staticPath, targetDir } = await parseStaticDir(dir);
          const targetPath = join(outputDir, targetDir);

          // we copy prebuild static files from node_modules/@storybook/manager & preview
          if (!staticDir.includes('node_modules')) {
            const from = picocolors.cyan(print(staticDir));
            const to = picocolors.cyan(print(targetDir));
            logger.info(`=> Copying static files: ${from} => ${to}`);
          }

          // Storybook's own files should not be overwritten, so we skip such files if we find them
          const skipPaths = ['index.html', 'iframe.html'].map((f) => join(targetPath, f));
          await cp(staticPath, targetPath, {
            dereference: true,
            preserveTimestamps: true,
            filter: (_, dest) => !skipPaths.includes(dest),
            recursive: true,
          });
        } catch (e) {
          if (e instanceof Error) {
            logger.error(e.message);
          }
          process.exit(-1);
        }
      })
    );
  }
}

export async function copyAllStaticFilesRelativeToMain(
  staticDirs: any[] | undefined,
  outputDir: string,
  configDir: string
) {
  const workingDir = process.cwd();

  return staticDirs?.reduce(async (acc, dir) => {
    await acc;

    const staticDirAndTarget = typeof dir === 'string' ? dir : `${dir.from}:${dir.to}`;
    const { staticPath: from, targetEndpoint: to } = await parseStaticDir(
      getDirectoryFromWorkingDir({
        configDir,
        workingDir,
        directory: staticDirAndTarget,
      })
    );

    const targetPath = join(outputDir, to);
    const skipPaths = ['index.html', 'iframe.html'].map((f) => join(targetPath, f));
    if (!from.includes('node_modules')) {
      logger.info(
        `=> Copying static files: ${picocolors.cyan(print(from))} at ${picocolors.cyan(print(targetPath))}`
      );
    }
    await cp(from, targetPath, {
      dereference: true,
      preserveTimestamps: true,
      filter: (_, dest) => !skipPaths.includes(dest),
      recursive: true,
    });
  }, Promise.resolve());
}
function print(p: string): string {
  return relative(process.cwd(), p);
}
