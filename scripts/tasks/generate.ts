/* eslint-disable import/extensions */
import { pathExists, remove } from 'fs-extra';
import { join } from 'path';

import type { Task } from '../task';
import { REPROS_DIRECTORY } from '../utils/constants';

const logger = console;

export const generate: Task = {
  description: 'Create the template repro',
  dependsOn: ['run-registry'],
  async ready({ key, template }, { link }) {
    const isReady = pathExists(join(REPROS_DIRECTORY, key, 'after-storybook'));
    if (isReady) {
      return isReady;
    }
    if ('inDevelopment' in template && template.inDevelopment && link) {
      throw new Error('Cannot link an in development template');
    }
    return isReady;
  },
  async run(details, options) {
    const reproDir = join(REPROS_DIRECTORY, details.key);
    if (await this.ready(details, options)) {
      logger.info('🗑  Removing old repro dir');
      await remove(reproDir);
    }

    // This uses an async import as it depends on `lib/cli` which requires `code` to be installed.
    const { generate: generateRepro } = await import('../sandbox/generate');

    await generateRepro({
      templates: [details.key],
      exclude: [],
      localRegistry: true,
      debug: options.debug,
    });
  },
};
