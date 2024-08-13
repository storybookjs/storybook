import {
  closeSync,
  copyFile,
  cpSync,
  existsSync,
  mkdirSync,
  openSync,
  rmSync,
  unlinkSync,
  watch,
} from 'node:fs';
import { join } from 'node:path';

import type { Task } from '../task';
import { ask } from '../utils/ask';

const logger = console;

export const syncDocs: Task = {
  description: 'Synchronize documentation',
  service: true,
  async ready() {
    return false;
  },
  async run() {
    const rootDir = join(__dirname, '..', '..');
    const docsDir = join(rootDir, 'docs');
    let frontpageDocsPath = '/src/content/docs';

    const frontpagePath = await ask('Provide the frontpage project path:');
    frontpageDocsPath = join(rootDir, frontpagePath, frontpageDocsPath);

    if (!existsSync(frontpageDocsPath)) {
      mkdirSync(frontpageDocsPath);
    }

    logger.info(`Rebuilding docs at ${frontpageDocsPath}`);

    rmSync(frontpageDocsPath, { recursive: true });
    cpSync(docsDir, frontpageDocsPath, { recursive: true });

    logger.info(`Synchronizing files from: \n${docsDir} \nto: \n${frontpageDocsPath}`);

    watch(docsDir, { recursive: true }, (_, filename) => {
      const srcFilePath = join(docsDir, filename);
      const targetFilePath = join(frontpageDocsPath, filename);
      const targetDir = targetFilePath.split('/').slice(0, -1).join('/');

      // Syncs create file
      if (!existsSync(targetFilePath)) {
        mkdirSync(targetDir, { recursive: true });
        closeSync(openSync(targetFilePath, 'w'));
        logger.info(`Created ${filename}.`);
      }

      // Syncs remove file
      if (!existsSync(srcFilePath)) {
        unlinkSync(targetFilePath);
        logger.info(`Removed ${filename}.`);
        return;
      }

      // Syncs update file
      copyFile(srcFilePath, targetFilePath, (err) => {
        logger.info(`Updated ${filename}.`);
        if (err) throw err;
      });
    });
  },
};
