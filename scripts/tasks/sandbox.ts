import dirSize from 'fast-folder-size';
// eslint-disable-next-line depend/ban-dependencies
import { pathExists, remove } from 'fs-extra';
import { join } from 'path';
import { promisify } from 'util';

import { now, saveBench } from '../bench/utils';
import type { Task } from '../task';

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

    const {
      create,
      install,
      addStories,
      extendMain,
      extendPreview,
      init,
      addExtraDependencies,
      setImportMap,
      setupVitest,
    } = await import('./sandbox-parts');

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

    const extraDeps = [
      ...(details.template.modifications?.extraDependencies ?? []),
      // The storybook package forwards some CLI commands to @storybook/cli with npx.
      // Adding the dep makes sure that even npx will use the linked workspace version.
      '@storybook/cli',
      '@storybook/experimental-addon-test',
    ];
    if (!details.template.skipTasks?.includes('vitest-integration')) {
      extraDeps.push('happy-dom', 'vitest', 'playwright', '@vitest/browser');

      if (details.template.expected.framework.includes('nextjs')) {
        extraDeps.push('@storybook/experimental-nextjs-vite', 'jsdom');
      }

      // if (details.template.expected.renderer === '@storybook/svelte') {
      //   extraDeps.push(`@testing-library/svelte`);
      // }
      //
      // if (details.template.expected.framework === '@storybook/angular') {
      //   extraDeps.push('@testing-library/angular', '@analogjs/vitest-angular');
      // }

      await setupVitest(details, options);
    }

    await addExtraDependencies({
      cwd: details.sandboxDir,
      debug: options.debug,
      dryRun: options.dryRun,
      extraDeps,
    });

    await extendMain(details, options);

    await extendPreview(details, options);

    await setImportMap(details.sandboxDir);

    logger.info(`✅ Storybook sandbox created at ${details.sandboxDir}`);
  },
};
