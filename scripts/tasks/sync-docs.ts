import fs from 'fs';
import path from 'path';

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
    const rootDir = path.join(__dirname, '..', '..');
    const docsDir = path.join(rootDir, 'docs');
    let frontpageDocsPath = '/src/content/docs';

    const frontpagePath = await ask('Provide the frontpage project path:');
    frontpageDocsPath = path.join(rootDir, frontpagePath, frontpageDocsPath);

    if (!fs.existsSync(frontpageDocsPath)) {
      fs.mkdirSync(frontpageDocsPath);
    }

    logger.info(`Rebuilding docs at ${frontpageDocsPath}`);

    fs.rmSync(frontpageDocsPath, { recursive: true });
    fs.cpSync(docsDir, frontpageDocsPath, { recursive: true });

    logger.info(`Synchronizing files from: \n${docsDir} \nto: \n${frontpageDocsPath}`);

    fs.watch(docsDir, { recursive: true }, (_, filename) => {
      const srcFilePath = path.join(docsDir, filename);
      const targetFilePath = path.join(frontpageDocsPath, filename);
      const targetDir = targetFilePath.split('/').slice(0, -1).join('/');

      // Syncs create file
      if (!fs.existsSync(targetFilePath)) {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.closeSync(fs.openSync(targetFilePath, 'w'));
        logger.info(`Created ${filename}.`);
      }

      // Syncs remove file
      if (!fs.existsSync(srcFilePath)) {
        fs.unlinkSync(targetFilePath);
        logger.info(`Removed ${filename}.`);
        return;
      }

      // Syncs update file
      fs.copyFile(srcFilePath, targetFilePath, (err) => {
        logger.info(`Updated ${filename}.`);
        if (err) throw err;
      });
    });
  },
};
