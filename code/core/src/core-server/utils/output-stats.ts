import { createWriteStream } from 'node:fs';
import { join } from 'node:path';

import type { Stats } from '@storybook/core/types';

import { logger } from '@storybook/core/node-logger';

import { stringifyStream } from '@discoveryjs/json-ext';
import picocolors from 'picocolors';

export async function outputStats(directory: string, previewStats?: any, managerStats?: any) {
  if (previewStats) {
    const filePath = await writeStats(directory, 'preview', previewStats as Stats);
    logger.info(`=> preview stats written to ${picocolors.cyan(filePath)}`);
  }
  if (managerStats) {
    const filePath = await writeStats(directory, 'manager', managerStats as Stats);
    logger.info(`=> manager stats written to ${picocolors.cyan(filePath)}`);
  }
}

export const writeStats = async (directory: string, name: string, stats: Stats) => {
  const filePath = join(directory, `${name}-stats.json`);
  const { chunks, ...data } = stats.toJson(); // omit chunks, which is about half of the total data
  await new Promise((resolve, reject) => {
    stringifyStream(data, null, 2)
      .on('error', reject)
      .pipe(createWriteStream(filePath))
      .on('error', reject)
      .on('finish', resolve);
  });
  return filePath;
};
