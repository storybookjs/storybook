import { rename, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import * as ghActions from '@actions/core';
import { copy, emptyDir, ensureDir, move, remove } from '@ndelangen/fs-extra-unified';
import { program } from 'commander';
import type { Options as ExecaOptions } from 'execa';
import { execaCommand } from 'execa';
import pLimit from 'p-limit';
import prettyTime from 'pretty-hrtime';
import { dedent } from 'ts-dedent';

import type { JsPackageManager } from '../../code/core/src/common/js-package-manager';
import { JsPackageManagerFactory } from '../../code/core/src/common/js-package-manager/JsPackageManagerFactory';
import { temporaryDirectory } from '../../code/core/src/common/utils/cli';
import storybookVersions from '../../code/core/src/common/versions';
import { allTemplates as sandboxTemplates } from '../../code/lib/cli-storybook/src/sandbox-templates';
import {
  AFTER_DIR_NAME,
  BEFORE_DIR_NAME,
  LOCAL_REGISTRY_URL,
  REPROS_DIRECTORY,
  SCRIPT_TIMEOUT,
} from '../utils/constants';
import { esMain } from '../utils/esmain';
import type { OptionValues } from '../utils/options';
import { createOptions } from '../utils/options';
import { getStackblitzUrl, renderTemplate } from './utils/template';
import type { GeneratorConfig } from './utils/types';
import { localizeYarnConfigFiles, setupYarn } from './utils/yarn';

const isCI = process.env.GITHUB_ACTIONS === 'true';

class BeforeScriptExecutionError extends Error {}
class StorybookInitError extends Error {}

const sbInit = async (
  cwd: string,
  envVars: Record<string, unknown> = {},
  flags?: string[],
  debug?: boolean
) => {
  const sbCliBinaryPath = join(__dirname, `../../code/lib/create-storybook/bin/index.cjs`);
  console.log(`🎁 Installing storybook`);
  const env = { STORYBOOK_DISABLE_TELEMETRY: 'true', ...envVars };
  const fullFlags = ['--yes', ...(flags || [])];
  await runCommand(`${sbCliBinaryPath} ${fullFlags.join(' ')}`, { cwd, env }, debug);
};

type LocalRegistryProps = {
  packageManager: JsPackageManager;
  action: () => Promise<void>;
  cwd: string;
  env: Record<string, any>;
  debug: boolean;
};

const withLocalRegistry = async ({
  packageManager,
  action,
  cwd,
  env,
  debug,
}: LocalRegistryProps) => {
  const prevUrl = await packageManager.getRegistryURL();
  let error;
  try {
    console.log(`📦 Configuring local registry: ${LOCAL_REGISTRY_URL}`);
    // NOTE: for some reason yarn prefers the npm registry in
    // local development, so always use npm
    await runCommand(`npm config set registry ${LOCAL_REGISTRY_URL}`, { cwd, env }, debug);
    await action();
  } catch (e) {
    error = e;
  } finally {
    console.log(`📦 Restoring registry: ${prevUrl}`);
    await runCommand(`npm config set registry ${prevUrl}`, { cwd, env }, debug);

    if (error) {
      throw error;
    }
  }
};

const addStorybook = async ({
  baseDir,
  localRegistry,
  flags = [],
  debug,
  env = {},
}: {
  baseDir: string;
  localRegistry: boolean;
  flags?: string[];
  debug?: boolean;
  env?: Record<string, unknown>;
}) => {
  const beforeDir = join(baseDir, BEFORE_DIR_NAME);
  const afterDir = join(baseDir, AFTER_DIR_NAME);

  const tmpDir = await temporaryDirectory();

  try {
    await copy(beforeDir, tmpDir);

    const packageManager = JsPackageManagerFactory.getPackageManager({ force: 'yarn1' }, tmpDir);
    if (localRegistry) {
      await withLocalRegistry({
        packageManager,
        action: async () => {
          await packageManager.addPackageResolutions({
            ...storybookVersions,
            // Yarn1 Issue: https://github.com/storybookjs/storybook/issues/22431
            jackspeak: '2.1.1',
          });

          await sbInit(tmpDir, env, [...flags, '--package-manager=yarn1'], debug);
        },
        cwd: tmpDir,
        env,
        debug,
      });
    } else {
      await sbInit(tmpDir, env, [...flags, '--package-manager=yarn1'], debug);
    }
  } catch (e) {
    await remove(tmpDir);
    throw e;
  }

  await rename(tmpDir, afterDir);
};

export const runCommand = async (script: string, options: ExecaOptions, debug = false) => {
  if (debug) {
    console.log(`Running command: ${script}`);
  }

  return execaCommand(script, {
    stdout: debug ? 'inherit' : 'ignore',
    shell: true,
    cleanup: true,
    ...options,
  });
};

const addDocumentation = async (
  baseDir: string,
  { name, dirName }: { name: string; dirName: string }
) => {
  const afterDir = join(baseDir, AFTER_DIR_NAME);
  const stackblitzConfigPath = join(__dirname, 'templates', '.stackblitzrc');
  const readmePath = join(__dirname, 'templates', 'item.ejs');

  await copy(stackblitzConfigPath, join(afterDir, '.stackblitzrc'));

  const stackblitzUrl = getStackblitzUrl(dirName);
  const contents = await renderTemplate(readmePath, {
    name,
    stackblitzUrl,
  });
  await writeFile(join(afterDir, 'README.md'), contents);
};

const runGenerators = async (
  generators: (GeneratorConfig & { dirName: string })[],
  localRegistry = true,
  debug = false
) => {
  if (debug) {
    console.log('Debug mode enabled. Verbose logs will be printed to the console.');
  }

  console.log(`🤹‍♂️ Generating sandboxes with a concurrency of ${1}`);

  const limit = pLimit(1);

  const generationResults = await Promise.allSettled(
    generators.map(({ dirName, name, script, expected, env }) =>
      limit(async () => {
        const baseDir = join(REPROS_DIRECTORY, dirName);
        const beforeDir = join(baseDir, BEFORE_DIR_NAME);
        try {
          let flags: string[] = ['--no-dev'];

          if (expected.renderer === '@storybook/html') {
            flags = ['--type html'];
          } else if (expected.renderer === '@storybook/server') {
            flags = ['--type server'];
          }

          const time = process.hrtime();
          console.log(`🧬 Generating ${name} (${dirName})`);
          await emptyDir(baseDir);

          // We do the creation inside a temp dir to avoid yarn container problems
          const createBaseDir = await temporaryDirectory();
          if (!script.includes('pnp')) {
            await setupYarn({ cwd: createBaseDir });
          }

          const createBeforeDir = join(createBaseDir, BEFORE_DIR_NAME);

          // Some tools refuse to run inside an existing directory and replace the contents,
          // where as others are very picky about what directories can be called. So we need to
          // handle different modes of operation.
          try {
            if (script.includes('{{beforeDir}}')) {
              const scriptWithBeforeDir = script.replaceAll('{{beforeDir}}', BEFORE_DIR_NAME);
              await runCommand(
                scriptWithBeforeDir,
                {
                  cwd: createBaseDir,
                  timeout: SCRIPT_TIMEOUT,
                },
                debug
              );
            } else {
              await ensureDir(createBeforeDir);
              await runCommand(script, { cwd: createBeforeDir, timeout: SCRIPT_TIMEOUT }, debug);
            }
          } catch (error) {
            const message = `❌ Failed to execute before-script for template: ${name} (${dirName})`;
            if (isCI) {
              ghActions.error(dedent`${message}
                ${(error as any).stack}`);
            } else {
              console.error(message);
              console.error(error);
            }
            throw new BeforeScriptExecutionError(message, { cause: error });
          }

          await localizeYarnConfigFiles(createBaseDir, createBeforeDir);

          // Now move the created before dir into it's final location and add storybook
          await move(createBeforeDir, beforeDir);

          // Make sure there are no git projects in the folder
          await remove(join(beforeDir, '.git'));

          try {
            await addStorybook({ baseDir, localRegistry, flags, debug, env });
          } catch (error) {
            const message = `❌ Failed to initialize Storybook in template: ${name} (${dirName})`;
            if (isCI) {
              ghActions.error(dedent`${message}
                ${(error as any).stack}`);
            } else {
              console.error(message);
              console.error(error);
            }
            throw new StorybookInitError(message, {
              cause: error,
            });
          }
          await addDocumentation(baseDir, { name, dirName });

          console.log(
            `✅ Generated ${name} (${dirName}) in ./${relative(
              process.cwd(),
              baseDir
            )} successfully in ${prettyTime(process.hrtime(time))}`
          );
        } catch (error) {
          throw error;
        } finally {
          // Remove node_modules to save space and avoid GH actions failing
          // They're not uploaded to the git sandboxes repo anyway
          if (process.env.CLEANUP_SANDBOX_NODE_MODULES) {
            console.log(`🗑️ Removing ${join(beforeDir, 'node_modules')}`);
            await remove(join(beforeDir, 'node_modules'));
            console.log(`🗑️ Removing ${join(baseDir, AFTER_DIR_NAME, 'node_modules')}`);
            await remove(join(baseDir, AFTER_DIR_NAME, 'node_modules'));
          }
        }
      })
    )
  );

  const hasGenerationErrors = generationResults.some((result) => result.status === 'rejected');

  if (!isCI) {
    if (hasGenerationErrors) {
      throw new Error(`Some sandboxes failed to generate`);
    }
    return;
  }

  ghActions.summary.addHeading('Sandbox generation summary');

  if (!hasGenerationErrors) {
    await ghActions.summary.addRaw('✅ Success!').write();
    return;
  }

  await ghActions.summary
    .addRaw('Some sandboxes failed, see the job log for detailed errors')
    .addTable([
      [
        { data: 'Name', header: true },
        { data: 'Key', header: true },
        { data: 'Result', header: true },
      ],
      ...generationResults.map((result, index) => {
        const { name, dirName } = generators[index];
        const row = [name, `\`${dirName}\``];
        if (result.status === 'fulfilled') {
          row.push('🟢 Pass');
          return row;
        }
        const generationError = (result as PromiseRejectedResult).reason as Error;
        if (generationError instanceof BeforeScriptExecutionError) {
          row.push('🔴 Failed to execute before script');
        } else if (generationError instanceof StorybookInitError) {
          row.push('🔴 Failed to initialize Storybook');
        } else {
          row.push('🔴 Failed with unknown error');
        }
        return row;
      }),
    ])
    .write();

  throw new Error(`Some sandboxes failed to generate`);
};

export const options = createOptions({
  templates: {
    type: 'string[]',
    description: 'Which templates would you like to create?',
    values: Object.keys(sandboxTemplates),
  },
  exclude: {
    type: 'string[]',
    description: 'Space-delimited list of templates to exclude. Takes precedence over --templates',
    promptType: false,
  },
  localRegistry: {
    type: 'boolean',
    description: 'Generate reproduction from local registry?',
    promptType: false,
  },
  debug: {
    type: 'boolean',
    description: 'Print all the logs to the console',
    promptType: false,
  },
});

export const generate = async ({
  templates,
  exclude,
  localRegistry,
  debug,
}: OptionValues<typeof options>) => {
  const generatorConfigs = Object.entries(sandboxTemplates)
    .map(([dirName, configuration]) => ({
      dirName,
      ...configuration,
    }))
    .filter(({ dirName }) => {
      let include = Array.isArray(templates) ? templates.includes(dirName) : true;
      if (Array.isArray(exclude) && include) {
        include = !exclude.includes(dirName);
      }
      return include;
    });

  await runGenerators(generatorConfigs, localRegistry, debug);
};

if (esMain(import.meta.url)) {
  program
    .description('Generate sandboxes from a set of possible templates')
    .option('--templates [templates...]', 'Space-delimited list of templates to include')
    .option(
      '--exclude [templates...]',
      'Space-delimited list of templates to exclude. Takes precedence over --templates'
    )
    .option('--debug', 'Print all the logs to the console')
    .option('--local-registry', 'Use local registry', false)
    .action((optionValues) => {
      generate(optionValues)
        .catch((e) => {
          console.error(e);
          process.exit(1);
        })
        .then(() => {
          // FIXME: Kill dangling processes. For some reason in CI,
          // the abort signal gets executed but the child process kill
          // does not succeed?!?
          process.exit(0);
        });
    })
    .parse(process.argv);
}
