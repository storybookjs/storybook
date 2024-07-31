import chalk from 'chalk';
import fs from 'fs-extra';
import { join, relative } from 'node:path';
import { logger } from '@storybook/core/node-logger';
import { getDirectoryFromWorkingDir } from '@storybook/core/common';
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
            const from = chalk.cyan(print(staticDir));
            const to = chalk.cyan(print(targetDir));
            logger.info(`=> Copying static files: ${from} => ${to}`);
          }

          // Storybook's own files should not be overwritten, so we skip such files if we find them
          const skipPaths = ['index.html', 'iframe.html'].map((f) => join(targetPath, f));
          await fs.copy(staticPath, targetPath, {
            dereference: true,
            preserveTimestamps: true,
            filter: (_, dest) => !skipPaths.includes(dest),
          });
        } catch (e) {
          if (e instanceof Error) logger.error(e.message);
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
        `=> Copying static files: ${chalk.cyan(print(from))} at ${chalk.cyan(print(targetPath))}`
      );
    }
    await fs.copy(from, targetPath, {
      dereference: true,
      preserveTimestamps: true,
      filter: (_, dest) => !skipPaths.includes(dest),
    });
  }, Promise.resolve());
}
function print(p: string): string {
  return relative(process.cwd(), p);
}
