import { cp, mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import * as ghActions from '@actions/core';
import { program } from 'commander';
// eslint-disable-next-line depend/ban-dependencies
import type { Options as ExecaOptions } from 'execa';
// eslint-disable-next-line depend/ban-dependencies
import { execaCommand } from 'execa';
import pLimit from 'p-limit';
import prettyTime from 'pretty-hrtime';
import { dedent } from 'ts-dedent';

import { PackageManagerName } from '../../code/core/src/common/js-package-manager/index.ts';
import { temporaryDirectory } from '../../code/core/src/common/utils/cli.ts';
import storybookVersions from '../../code/core/src/common/versions.ts';
import {
  type Template,
  allTemplates as sandboxTemplates,
} from '../../code/lib/cli-storybook/src/sandbox-templates.ts';
import {
  AFTER_DIR_NAME,
  BEFORE_DIR_NAME,
  LOCAL_REGISTRY_URL,
  REPROS_DIRECTORY,
  SCRIPT_TIMEOUT,
} from '../utils/constants.ts';
import { esMain } from '../utils/esmain.ts';
import type { OptionValues } from '../utils/options.ts';
import { createOptions } from '../utils/options.ts';
import { getStackblitzUrl, renderTemplate } from './utils/template.ts';
import {
  localizeYarnConfigFiles,
  refreshBeforeStorybookLockfile,
  setupYarn,
} from './utils/yarn.ts';

const isCI = process.env.GITHUB_ACTIONS === 'true' || process.env.CI === 'true';

class BeforeScriptExecutionError extends Error {}
class StorybookInitError extends Error {}

const sbInit = async (
  cwd: string,
  envVars: Record<string, unknown> = {},
  flags?: string[],
  debug?: boolean
) => {
  const sbCliBinaryPath = join(__dirname, `../../code/lib/create-storybook/dist/bin/index.js`);
  console.log(`🎁 Installing Storybook`);
  const env = { STORYBOOK_DISABLE_TELEMETRY: 'true', ...envVars, CI: 'true' };
  const fullFlags = ['--yes', ...(flags || [])];
  await runCommand(`${sbCliBinaryPath} ${fullFlags.join(' ')}`, { cwd, env }, debug);
};

type LocalRegistryProps = {
  action: () => Promise<void>;
  cwd: string;
  env: Record<string, any>;
  debug: boolean;
};

const withLocalRegistry = async ({ action, cwd, env, debug }: LocalRegistryProps) => {
  const prevUrl = 'https://registry.npmjs.org/';
  let error;
  try {
    console.log(`📦 Configuring local registry: ${LOCAL_REGISTRY_URL}`);
    // NOTE: for some reason yarn prefers the npm registry in
    // local development, so always use npm
    await runCommand(`npm config set registry ${LOCAL_REGISTRY_URL} -g`, { cwd, env }, debug);
    await action();
  } catch (e) {
    error = e;
  } finally {
    console.log(`📦 Restoring registry: ${prevUrl}`);
    await runCommand(`npm config set registry ${prevUrl} -g`, { cwd, env }, debug);

    if (error) {
      throw error;
    }
  }
};

const emptyDir = async (dir: string): Promise<void> => {
  await mkdir(dir, { recursive: true });

  const names = await readdir(dir);
  await Promise.all(names.map((name) => rm(join(dir, name), { recursive: true, force: true })));
};

const moveDir = async (from: string, to: string): Promise<void> => {
  try {
    await rename(from, to);
  } catch (error) {
    // On some platforms (notably Windows), rename doesn't work across different disks volumes
    if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
      throw error;
    }

    await cp(from, to, { recursive: true });
    await rm(from, { recursive: true, force: true });
  }
};

const addStorybook = async ({
  localRegistry,
  baseDir,
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
    await cp(beforeDir, tmpDir, { recursive: true });

    if (localRegistry) {
      await addResolutions(tmpDir);
    }

    // Inherit the 7-day `npmMinimalAgeGate` from `before-storybook/.yarnrc.yml`
    // would block freshly-published Verdaccio packages (storybook itself plus
    // anything new in `extraDependencies`, e.g. `webpack@^5.107.0`). The
    // after-storybook tree is internal CI scaffolding — Phase 1's publish-time
    // filter strips this gate before anything reaches consumers — so disable
    // it for this install via env (no `.yarnrc.yml` write).
    const sbInitEnv = { ...env, YARN_NPM_MINIMAL_AGE_GATE: '0' };
    await sbInit(
      tmpDir,
      sbInitEnv,
      [...flags, `--package-manager=${PackageManagerName.YARN2}`],
      debug
    );
  } catch (e) {
    console.log('error', e);
    await rm(tmpDir, { recursive: true, force: true });
    throw e;
  }

  await cp(tmpDir, afterDir, { recursive: true });
  await rm(tmpDir, { recursive: true, force: true });
};

export const runCommand = async (script: string, options: ExecaOptions, debug = false) => {
  if (debug) {
    console.log(`Running command: ${script}`);
  }

  return execaCommand(script, {
    // Capture (not discard) stdout when not streaming, so a failing command's
    // output is available on the thrown error for diagnostics.
    stdout: debug ? 'inherit' : 'pipe',
    shell: true,
    cleanup: true,
    ...options,
  });
};

/** Render an execa (or generic) error with its captured stdout/stderr for logs. */
const formatCommandError = (error: unknown): string => {
  const e = error as { stack?: string; message?: string; stdout?: string; stderr?: string };
  return [
    e.stack ?? e.message ?? String(error),
    e.stdout ? `--- stdout ---\n${e.stdout}` : '',
    e.stderr ? `--- stderr ---\n${e.stderr}` : '',
  ]
    .filter(Boolean)
    .join('\n');
};

const addDocumentation = async (
  baseDir: string,
  { name, dirName }: { name: string; dirName: string }
) => {
  const afterDir = join(baseDir, AFTER_DIR_NAME);
  const stackblitzConfigPath = join(__dirname, 'templates', '.stackblitzrc');
  const readmePath = join(__dirname, 'templates', 'item.ejs');

  await cp(stackblitzConfigPath, join(afterDir, '.stackblitzrc'));

  const stackblitzUrl = getStackblitzUrl(dirName);
  const contents = await renderTemplate(readmePath, {
    name,
    stackblitzUrl,
  });
  await writeFile(join(afterDir, 'README.md'), contents);
};

const toFlags = (opts: Record<string, any>): string[] => {
  const result: string[] = [];
  for (const [key, value] of Object.entries(opts)) {
    if (value === undefined || value === null) {
      continue;
    }
    if (typeof value === 'boolean') {
      if (value) {
        result.push(`--${key}`);
      }
    } else if (Array.isArray(value)) {
      for (const v of value) {
        result.push(`--${key} ${String(v)}`);
      }
    } else if (typeof value === 'string') {
      // Normalize ProjectType-like values to lower-case for CLI
      const val = key === 'type' ? value.toLowerCase() : value;
      result.push(`--${key} ${val}`);
    } else {
      // Fallback: stringify
      result.push(`--${key} ${JSON.stringify(value)}`);
    }
  }
  return result;
};

const runGenerators = async (
  generators: (Template & { dirName: string })[],
  localRegistry = true,
  debug = false
) => {
  if (debug) {
    console.log('Debug mode enabled. Verbose logs will be printed to the console.');
  }

  console.log(`🤹‍♂️ Generating sandboxes with a concurrency of ${1}`);

  const limit = pLimit(1);

  const generationResults = await Promise.allSettled(
    generators.map(({ dirName, name, script, env, initOptions, disableMinAgeGate }) =>
      limit(async () => {
        const baseDir = join(REPROS_DIRECTORY, dirName);
        const beforeDir = join(baseDir, BEFORE_DIR_NAME);
        let createBaseDir: string | undefined;

        try {
          let flags: string[] = ['--no-dev'];

          if (initOptions && typeof initOptions === 'object') {
            flags = [...flags, ...toFlags(initOptions as Record<string, any>)];
          }

          const time = process.hrtime();
          console.log(`🧬 Generating ${name} (${dirName})`);
          await emptyDir(baseDir);

          // We do the creation inside a temp dir to avoid yarn container problems
          createBaseDir = await temporaryDirectory();
          if (!script.includes('pnp')) {
            try {
              await setupYarn({ cwd: createBaseDir });
            } catch (error) {
              const message = `❌ Failed to setup yarn in template: ${name} (${dirName})`;
              if (isCI) {
                ghActions.error(dedent`${message}
                  ${formatCommandError(error)}`);
              } else {
                console.error(message);
                console.error(error);
              }
              throw new Error(message, {
                cause: error,
              });
            }
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
                  env: {
                    ...env,
                    CI: 'true',
                  },
                  timeout: SCRIPT_TIMEOUT,
                },
                debug
              );
            } else {
              await mkdir(createBeforeDir, { recursive: true });
              await runCommand(script, { cwd: createBeforeDir, timeout: SCRIPT_TIMEOUT }, debug);
            }
          } catch (error) {
            const message = `❌ Failed to execute before-script for template: ${name} (${dirName})`;
            if (isCI) {
              ghActions.error(dedent`${message}
                ${formatCommandError(error)}`);
            } else {
              console.error(message);
              console.error(error);
            }
            throw new BeforeScriptExecutionError(message, { cause: error });
          }

          await localizeYarnConfigFiles(createBaseDir, createBeforeDir);

          // Refresh the lockfile to a Yarn 4 one with a 7-day npmMinimalAgeGate
          // so consumers who clone the published sandbox install a reproducible,
          // non-freshly-quarantined dependency tree. Failure here degrades gracefully:
          // the template's original lockfile is already gone, but the consumer can
          // still install from package.json.
          try {
            await refreshBeforeStorybookLockfile({
              cwd: createBeforeDir,
              debug,
              disableMinAgeGate,
            });
          } catch (error) {
            const message = `⚠️ Failed to refresh Yarn 4 lockfile for template: ${name} (${dirName}); shipping template default state`;
            if (isCI) {
              ghActions.warning(dedent`${message}
                ${formatCommandError(error)}`);
            } else {
              console.warn(message);
              console.warn(error);
            }
          }

          // Now move the created before dir into it's final location and add storybook
          await moveDir(createBeforeDir, beforeDir);

          // Make sure there are no git projects in the folder
          await rm(join(beforeDir, '.git'), { recursive: true, force: true });

          try {
            await addStorybook({ baseDir, localRegistry, flags, debug, env });
          } catch (error) {
            const message = `❌ Failed to initialize Storybook in template: ${name} (${dirName})`;
            if (isCI) {
              ghActions.error(dedent`${message}
                ${formatCommandError(error)}`);
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
            await rm(join(beforeDir, 'node_modules'), { recursive: true, force: true });
            console.log(`🗑️ Removing ${join(baseDir, AFTER_DIR_NAME, 'node_modules')}`);
            await rm(join(baseDir, AFTER_DIR_NAME, 'node_modules'), {
              recursive: true,
              force: true,
            });
          }

          // Clean up the temporary base directory
          if (createBaseDir) {
            await rm(createBaseDir, { recursive: true, force: true });
          }
        }
      })
    )
  );

  const hasGenerationErrors = generationResults.some((result) => result.status === 'rejected');

  if (!isCI || process.env.STORYBOOK_SANDBOX_GENERATE) {
    if (hasGenerationErrors) {
      console.log('failed:');
      console.log(
        generationResults
          .filter((result) => result.status === 'rejected')
          .map((_, index) => generators[index].name)
      );
      throw new Error(`Some sandboxes failed to generate`, {
        cause: generationResults
          .filter((result) => result.status === 'rejected')
          .map((result) => {
            const generationError = (result as PromiseRejectedResult).reason as Error;
            return generationError;
          }),
      });
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

  throw new Error(`Some sandboxes failed to generate`, {
    cause: generationResults
      .filter((result) => result.status === 'rejected')
      .map((result) => {
        const generationError = (result as PromiseRejectedResult).reason as Error;
        return generationError;
      }),
  });
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

async function addResolutions(beforeDir: string) {
  const packageJson = await readFile(join(beforeDir, 'package.json'), 'utf-8').then((c) =>
    JSON.parse(c)
  );

  packageJson.resolutions = {
    ...storybookVersions,
  };

  await writeFile(join(beforeDir, 'package.json'), JSON.stringify(packageJson, null, 2));
}

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
      let result;
      if (optionValues.localRegistry) {
        result = withLocalRegistry({
          debug: optionValues.debug,

          action: async () => {
            await generate(optionValues);
          },
          cwd: process.cwd(),
          env: {},
        });
      } else {
        result = generate(optionValues);
      }

      result
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
