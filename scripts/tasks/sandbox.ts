import { pathExists, remove } from '@ndelangen/fs-extra-unified';

import { join } from 'path';
import { promisify } from 'util';
import dirSize from 'fast-folder-size';
import type { Task } from '../task';
import { now, saveBench } from '../bench/utils';

const logger = console;

export const sandbox: Task = {
  description: 'Create the sandbox from a template',
  dependsOn: ({ template }, { link }) => {
    if ('inDevelopment' in template && template.inDevelopment) {
      return ['run-registry', 'generate'];
    }

    if (link) {
      return ['compile'];
    }

    return ['run-registry'];
  },
  async ready({ sandboxDir }) {
    return pathExists(sandboxDir);
  },
  async run(details, options) {
    if (options.link && details.template.inDevelopment) {
      logger.log(
        `The ${options.template} has inDevelopment property enabled, therefore the sandbox for that template cannot be linked. Enabling --no-link mode..`
      );

      options.link = false;
    }
    if (await this.ready(details)) {
      logger.info('🗑  Removing old sandbox dir');
      await remove(details.sandboxDir);
    }

    const { create, install, addStories, extendMain, init, addExtraDependencies, setImportMap } =
      await import('./sandbox-parts');

    let startTime = now();
    await create(details, options);
    const createTime = now() - startTime;
    const createSize = 0;

    startTime = now();
    await install(details, options);
    const generateTime = now() - startTime;
    const generateSize = await promisify(dirSize)(join(details.sandboxDir, 'node_modules'));

    startTime = now();
    await init(details, options);
    const initTime = now() - startTime;
    const initSize = await promisify(dirSize)(join(details.sandboxDir, 'node_modules'));

    await saveBench(
      'sandbox',
      {
        createTime,
        generateTime,
        initTime,
        createSize,
        generateSize,
        initSize,
        diffSize: initSize - generateSize,
      },
      { rootDir: details.sandboxDir }
    );

    if (!options.skipTemplateStories) {
      await addStories(details, options);
    }

    await addExtraDependencies({
      cwd: details.sandboxDir,
      debug: options.debug,
      dryRun: options.dryRun,
      extraDeps: details.template.modifications?.extraDependencies,
    });

    await extendMain(details, options);

    await setImportMap(details.sandboxDir);

    logger.info(`✅ Storybook sandbox created at ${details.sandboxDir}`);
  },
};
