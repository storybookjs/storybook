import { cp } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { logger } from 'storybook/internal/node-logger';

import picocolors from 'picocolors';

import { mapStaticDir } from './server-statics.ts';

export async function copyAllStaticFilesRelativeToMain(
  staticDirs: any[] | undefined,
  outputDir: string,
  configDir: string
) {
  return staticDirs?.reduce(async (acc, dir) => {
    await acc;

    const { staticPath: from, targetEndpoint: to } = mapStaticDir(dir, configDir);
    const targetPath = join(outputDir, to);
    // Resolved on both sides so the comparison does not depend on the separators `cp` reports.
    const skipPaths = ['index.html', 'iframe.html', 'index.json', 'project.json'].map((f) =>
      resolve(outputDir, f)
    );
    if (!from.includes('node_modules')) {
      logger.info(
        `Copying static files: ${picocolors.cyan(print(from))} at ${picocolors.cyan(print(targetPath))}`
      );
    }
    await cp(from, targetPath, {
      dereference: true,
      preserveTimestamps: true,
      filter: (_, dest) => !skipPaths.includes(resolve(dest)),
      recursive: true,
      force: true,
    });
  }, Promise.resolve());
}
function print(p: string): string {
  return relative(process.cwd(), p);
}
