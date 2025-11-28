import { access, cp, rm } from 'node:fs/promises';
import path, { join } from 'node:path';
import { promisify } from 'node:util';

import dirSize from 'fast-folder-size';

import { now, saveBench } from '../bench/utils';
import type { Task, TaskKey } from '../task';
import { ROOT_DIRECTORY } from '../utils/constants';

const logger = console;

const pathExists = async (path: string) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const sandbox: Task = {
  description: 'Create the sandbox from a template',
  dependsOn: (_, { link }) => {
    if (link) {
      return ['compile', 'generate'];
    }

    return ['run-registry', 'generate'];
  },
  async ready({ sandboxDir }, { task: selectedTask }) {
    // If the selected task requires the sandbox to exist, we check it. Else we always assume it needs to be created
    // This avoids issues where you want to overwrite a sandbox and it will stop because it already exists
    const tasksAfterSandbox: TaskKey[] = [
      'vitest-integration',
      'test-runner',
      'test-runner-dev',
      'e2e-tests',
      'e2e-tests-dev',
      'smoke-test',
      'dev',
      'build',
      'serve',
      'chromatic',
      'bench',
      'check-sandbox',
    ];
    const isSelectedTaskAfterSandboxCreation = tasksAfterSandbox.includes(selectedTask);
    return isSelectedTaskAfterSandboxCreation && pathExists(sandboxDir);
  },
  async run(details, options) {
    if (options.link && details.template.inDevelopment) {
      logger.log(
        `The ${options.template} has inDevelopment property enabled, therefore the sandbox for that template cannot be linked. Enabling --no-link mode..`
      );

      options.link = false;
    }

    if (!(await this.ready(details, options))) {
      logger.info('🗑  Removing old sandbox dir');
      await rm(details.sandboxDir, { force: true, recursive: true });
    }

    const {
      create,
      install,
      addGlobalMocks,
      addStories,
      extendMain,
      extendPreview,
      init,
      addExtraDependencies,
      setImportMap,
      setupVitest,
      runMigrations,
    } = await import('./sandbox-parts');

    const extraDeps = [
      ...(details.template.modifications?.extraDependencies ?? []),
      // The storybook package forwards some CLI commands to @storybook/cli with npx.
      // Adding the dep makes sure that even npx will use the linked workspace version.
      '@storybook/cli',
      'lodash-es',
      '@types/lodash-es',
      '@types/aria-query',
      'uuid',
    ];

    const shouldAddVitestIntegration = !details.template.skipTasks?.includes('vitest-integration');

    if (shouldAddVitestIntegration) {
      extraDeps.push('happy-dom');

      if (details.template.expected.framework.includes('nextjs')) {
        extraDeps.push('jsdom');
      }

      // if (details.template.expected.renderer === '@storybook/svelte') {
      //   extraDeps.push(`@testing-library/svelte`);
      // }
      //
      // if (details.template.expected.framework === '@storybook/angular') {
      //   extraDeps.push('@testing-library/angular', '@analogjs/vitest-angular');
      // }
    }

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

    // not if sandbox is bench
    if (!details.template.modifications?.skipMocking) {
      await addGlobalMocks(details, options);
    }

    if (shouldAddVitestIntegration) {
      await setupVitest(details, options);
    }

    await addExtraDependencies({
      cwd: details.sandboxDir,
      debug: options.debug,
      dryRun: options.dryRun,
      extraDeps,
    });

    await extendMain(details, options);

    await setImportMap(details.sandboxDir);

    const { JsPackageManagerFactory } = await import(
      '../../code/core/src/common/js-package-manager/JsPackageManagerFactory'
    );

    const packageManager = JsPackageManagerFactory.getPackageManager({}, details.sandboxDir);

    await rm(path.join(details.sandboxDir, 'node_modules'), { force: true, recursive: true });
    await packageManager.installDependencies();

    await runMigrations(details, options);

    await extendPreview(details, options);

    logger.info('✅ Moving sandbox to cache directory');
    const sandboxDir = join(details.sandboxDir);
    const cacheDir = join(ROOT_DIRECTORY, 'sandbox', details.key.replace('/', '-'));

    // For NX we move the sandbox to a directory that can be cached.
    // We remove node_modules to keep the remote cache small and fast
    // node_modules are already cached in the global yarn cache
    if (process.env.NX_CLI_SET === 'true') {
      if (sandboxDir !== cacheDir) {
        logger.info(`✅ Removing cache directory ${cacheDir}`);
        await rm(cacheDir, { recursive: true, force: true });

        logger.info(`✅ Copy ${sandboxDir} to cache directory`);
        await cp(sandboxDir, cacheDir, {
          recursive: true,
          force: true,
          filter: (src) => {
            const name = path.basename(src);
            return (
              name !== 'node_modules' &&
              !(name === 'cache' && path.basename(path.dirname(src)) === '.yarn')
            );
          },
        });
      } else {
        logger.info(`✅ Removing node_modules from cache directory ${cacheDir}`);
        await rm(path.join(cacheDir, 'node_modules'), { force: true, recursive: true });
        await rm(path.join(cacheDir, '.yarn', 'cache'), { force: true, recursive: true });
      }
    }

    logger.info(`✅ Storybook sandbox created at ${details.sandboxDir}`);
  },
};
