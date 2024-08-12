import path from 'node:path';

import type { Stats } from '@storybook/core/types';

import { logger } from '@storybook/core/node-logger';

import { stringifyStream } from '@discoveryjs/json-ext';
import chalk from 'chalk';
import fs from 'fs-extra';

export async function outputStats(directory: string, previewStats?: any, managerStats?: any) {
  if (previewStats) {
    const filePath = await writeStats(directory, 'preview', previewStats as Stats);
    logger.info(`=> preview stats written to ${chalk.cyan(filePath)}`);
  }
  if (managerStats) {
    const filePath = await writeStats(directory, 'manager', managerStats as Stats);
    logger.info(`=> manager stats written to ${chalk.cyan(filePath)}`);
  }
}

export const writeStats = async (directory: string, name: string, stats: Stats) => {
  const filePath = path.join(directory, `${name}-stats.json`);
  const { chunks, ...data } = stats.toJson(); // omit chunks, which is about half of the total data
  await new Promise((resolve, reject) => {
    stringifyStream(data, null, 2)
      .on('error', reject)
      .pipe(fs.createWriteStream(filePath))
      .on('error', reject)
      .on('finish', resolve);
  });
  return filePath;
};
