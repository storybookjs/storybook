import { readFile, writeFile } from 'node:fs/promises';

import { transformImportFiles } from 'storybook/internal/common';
import { logger, prompt } from 'storybook/internal/node-logger';

import semver from 'semver';
import { dedent } from 'ts-dedent';

import { add } from '../../add.ts';
import { updateMainConfig } from '../helpers/mainConfigFile.ts';
import type { Fix } from '../types.ts';

export const ANGULAR_PACKAGE = '@storybook/angular';
export const ANGULAR_VITE_PACKAGE = '@storybook/angular-vite';

const FRAMEWORK_DOC_URL = 'https://storybook.js.org/docs/get-started/frameworks/angular-vite';
const VITE_CONFIG_DOC_URL = 'https://storybook.js.org/docs/builders/vite#configure';

interface AngularToAngularViteOptions {
  /** True when @angular/core is not found or is outside the 21.x range. */
  angularUnsupportedVersion: boolean;
  /** The detected @angular/core version string, or null if not found. */
  angularVersion: string | null;
  /** True when the main config contains a webpackFinal hook. */
  hasWebpackFinal: boolean;
  /** package.json paths that reference @storybook/angular. */
  packageJsonFiles: string[];
}

/**
 * Replace @storybook/angular builder references in a JSON file. Handles both
 * `angular.json` architect entries and `package.json` scripts.
 */
const rewriteBuilderRefs = (content: string): string =>
  content
    .replace(/@storybook\/angular:start-storybook/g, `${ANGULAR_VITE_PACKAGE}:start-storybook`)
    .replace(/@storybook\/angular:build-storybook/g, `${ANGULAR_VITE_PACKAGE}:build-storybook`);

const transformMainConfig = async (mainConfigPath: string, dryRun: boolean): Promise<boolean> => {
  try {
    const content = await readFile(mainConfigPath, 'utf-8');

    if (!content.includes(ANGULAR_PACKAGE)) {
      return false;
    }

    // Replace @storybook/angular with @storybook/angular-vite using a negative
    // lookahead so references that are already @storybook/angular-vite are left alone.
    const transformed = content.replace(/@storybook\/angular(?!-vite)/g, ANGULAR_VITE_PACKAGE);

    if (transformed !== content && !dryRun) {
      await writeFile(mainConfigPath, transformed);
    }

    return transformed !== content;
  } catch (error) {
    logger.error(`Failed to update main config at ${mainConfigPath}: ${error}`);
    return false;
  }
};

/**
 * Detect whether a Storybook builder target in an `angular.json` or Nx
 * `project.json` explicitly disables Compodoc (`options.compodoc: false`).
 * Compodoc now runs only from the framework Vite plugin (default on), so a
 * disabled builder option must be carried into `main.ts` framework.options to
 * preserve intent — otherwise the cold-start default would re-enable it.
 */
const detectDisabledCompodoc = (content: string): boolean => {
  let json: any;
  try {
    json = JSON.parse(content);
  } catch {
    return false;
  }

  const targetDisablesCompodoc = (target: any): boolean => {
    const ref: unknown = target?.builder ?? target?.executor;
    return (
      typeof ref === 'string' &&
      (ref.endsWith(':start-storybook') || ref.endsWith(':build-storybook')) &&
      target?.options?.compodoc === false
    );
  };

  // angular.json: projects.<name>.architect.<target>; project.json: targets.<target>
  const targetGroups: any[] = [];
  if (json?.projects && typeof json.projects === 'object') {
    for (const project of Object.values<any>(json.projects)) {
      targetGroups.push(project?.architect, project?.targets);
    }
  }
  targetGroups.push(json?.targets);

  return targetGroups.some(
    (group) =>
      group && typeof group === 'object' && Object.values<any>(group).some(targetDisablesCompodoc)
  );
};

const transformJsonFile = async (
  filePath: string,
  dryRun: boolean
): Promise<{ changed: boolean; disablesCompodoc: boolean }> => {
  try {
    const content = await readFile(filePath, 'utf-8');
    const transformed = rewriteBuilderRefs(content);
    const changed = transformed !== content;

    if (changed && !dryRun) {
      await writeFile(filePath, transformed);
    }

    return { changed, disablesCompodoc: detectDisabledCompodoc(content) };
  } catch {
    return { changed: false, disablesCompodoc: false };
  }
};

export const angularToAngularVite: Fix<AngularToAngularViteOptions> = {
  id: 'angular-to-angular-vite',
  link: FRAMEWORK_DOC_URL,
  defaultSelected: false,

  async check({ packageManager }): Promise<AngularToAngularViteOptions | null> {
    const allDeps = packageManager.getAllDependencies();

    // Only apply when @storybook/angular is present and @storybook/angular-vite is not.
    if (!allDeps[ANGULAR_PACKAGE] || allDeps[ANGULAR_VITE_PACKAGE]) {
      return null;
    }

    // Detect @angular/core version for the Angular 21 prerequisite check.
    const angularVersionRaw = packageManager.getDependencyVersion('@angular/core');
    const angularVersion = angularVersionRaw
      ? (semver.coerce(angularVersionRaw)?.version ?? null)
      : null;
    const angularUnsupportedVersion =
      !angularVersion || !semver.satisfies(angularVersion, '>=21.0.0');

    // Detect webpackFinal in main config by scanning package.json paths for the
    // config dir, then reading main config content.
    let hasWebpackFinal = false;
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      // Look for main config files adjacent to the package.json
      const dir = pkgJsonPath.replace(/[/\\]package\.json$/, '');
      for (const mainName of [
        `${dir}/.storybook/main.ts`,
        `${dir}/.storybook/main.js`,
        `${dir}/.storybook/main.mts`,
        `${dir}/.storybook/main.mjs`,
      ]) {
        try {
          const content = await readFile(mainName, 'utf-8');
          if (content.includes('webpackFinal')) {
            hasWebpackFinal = true;
          }
          break;
        } catch {
          continue;
        }
      }
      if (hasWebpackFinal) {
        break;
      }
    }

    // Collect package.json files that reference @storybook/angular.
    const packageJsonFiles: string[] = [];
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      try {
        const raw = await readFile(pkgJsonPath, 'utf-8');
        const pkg = JSON.parse(raw);
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (Object.keys(deps).includes(ANGULAR_PACKAGE)) {
          packageJsonFiles.push(pkgJsonPath);
        }
      } catch {
        continue;
      }
    }

    return {
      angularUnsupportedVersion,
      angularVersion,
      hasWebpackFinal,
      packageJsonFiles,
    };
  },

  prompt() {
    return 'Migrate from @storybook/angular (Webpack) to @storybook/angular-vite (in preview).';
  },

  async run({
    result,
    dryRun = false,
    mainConfigPath,
    storiesPaths,
    configDir,
    packageManager,
    storybookVersion,
    yes,
  }) {
    if (!result) {
      return;
    }

    // Hard bail if Angular version is unsupported — the prompt already told the user what to do.
    if (result.angularUnsupportedVersion) {
      logger.log(
        dedent`
          Migration skipped: Angular 21 is required.
          Run \`ng update @angular/core @angular/cli\` to upgrade, then try again.
        `
      );
      return;
    }

    // When webpackFinal is present, warn prominently and ask whether to continue.
    if (result.hasWebpackFinal) {
      logger.logBox(
        dedent`
          We detected a \`webpackFinal\` hook in your Storybook main config.

          \`webpackFinal\` is a Webpack-specific API and will not carry over to Vite.
          You will need to port it to \`viteFinal\` after the migration.
          See ${VITE_CONFIG_DOC_URL} for porting guidance.
        `
      );

      const shouldContinue = yes
        ? false
        : await prompt.confirm({
            message: 'I detected a webpackFinal hook. It will not carry over. Continue anyway?',
            initialValue: false,
          });

      if (!shouldContinue) {
        logger.log(
          'Migration cancelled. Port your webpackFinal hook to viteFinal first, then run the automigration again.'
        );
        return;
      }
    }

    logger.step(`Migrating from ${ANGULAR_PACKAGE} to ${ANGULAR_VITE_PACKAGE}...`);

    // 1. Update dependencies.
    if (dryRun) {
      logger.debug('Dry run: Skipping dependency updates.');
    } else {
      logger.debug('Updating dependencies...');
      await packageManager.removeDependencies([ANGULAR_PACKAGE]);
      await packageManager.addDependencies({ type: 'devDependencies', skipInstall: true }, [
        `${ANGULAR_VITE_PACKAGE}@${storybookVersion}`,
      ]);
    }

    // 2. Patch .storybook/main.ts(.js).
    if (mainConfigPath) {
      logger.debug('Updating main config...');
      await transformMainConfig(mainConfigPath, dryRun);
    }

    // Track whether any migrated builder config disabled Compodoc, so the
    // intent can be carried into framework.options (step 4b).
    let disableCompodoc = false;

    // 3. Rewrite Angular CLI builder references in angular.json.
    // Search for angular.json beside every package.json we know about.
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      const dir = pkgJsonPath.replace(/[/\\]package\.json$/, '');
      const angularJsonPath = `${dir}/angular.json`;
      const { changed, disablesCompodoc } = await transformJsonFile(angularJsonPath, dryRun);
      disableCompodoc ||= disablesCompodoc;
      if (changed) {
        logger.debug(`Updated Angular CLI builder references in ${angularJsonPath}`);
      }
    }

    // 3b. Rewrite Angular builder references in Nx `project.json` files.
    // Nx workspaces scatter `project.json` files (e.g. `libs/*/project.json`)
    // away from `package.json` and use `executor` rather than angular.json's
    // `builder`; the `@storybook/angular:<target>` string is identical, so the
    // same rewrite applies. Glob the workspace since they are not co-located
    // with package.json the way angular.json is.
    // eslint-disable-next-line depend/ban-dependencies
    const { globby } = await import('globby');
    const projectJsonFiles = await globby(['**/project.json'], {
      ignore: ['**/node_modules/**', '**/dist/**'],
      absolute: true,
    });
    for (const projectJsonPath of projectJsonFiles) {
      const { changed, disablesCompodoc } = await transformJsonFile(projectJsonPath, dryRun);
      disableCompodoc ||= disablesCompodoc;
      if (changed) {
        logger.debug(`Updated Nx builder references in ${projectJsonPath}`);
      }
    }

    // 4. Rewrite Angular CLI builder references in package.json scripts.
    for (const pkgJsonPath of packageManager.packageJsonPaths) {
      const { changed } = await transformJsonFile(pkgJsonPath, dryRun);
      if (changed) {
        logger.debug(`Updated builder references in ${pkgJsonPath}`);
      }
    }

    // 4b. Carry a disabled Compodoc setting into framework.options. Compodoc is
    // now generated only by the framework Vite plugin (default on), so a builder
    // `compodoc: false` must move to main.ts — otherwise the cold-start default
    // would silently re-enable it.
    if (disableCompodoc && mainConfigPath) {
      try {
        await updateMainConfig({ mainConfigPath, dryRun: !!dryRun }, async (main) => {
          if (dryRun) {
            return;
          }

          // When `framework` is a bare string, `setFieldValue(['framework',
          // 'options', ...])` replaces the string value and drops the framework
          // name. Rebuild it as an object that preserves the name. Object forms
          // (including a `getAbsolutePath`-wrapped name, where `getFieldValue`
          // throws because the call cannot be evaluated) descend correctly via
          // the nested set and keep the existing name and options.
          let frameworkValue: unknown;
          try {
            frameworkValue = main.getFieldValue(['framework']);
          } catch {
            frameworkValue = undefined;
          }

          if (typeof frameworkValue === 'string') {
            main.setFieldValue(['framework'], {
              name: frameworkValue,
              options: { compodoc: false },
            });
          } else {
            main.setFieldValue(['framework', 'options', 'compodoc'], false);
          }
        });
        logger.debug('Carried `compodoc: false` into framework.options.');
      } catch (error) {
        logger.warn(
          `Could not set \`framework.options.compodoc\` automatically: ${error}. ` +
            "Set `compodoc: false` in your main config's framework.options manually."
        );
      }
    }

    // 5. Update import statements across config and story files.
    logger.debug('Scanning and updating import statements...');
    const configFiles = configDir ? await globby([`${configDir}/**/*`]) : [];
    const allFiles = [...storiesPaths, ...configFiles].filter(Boolean) as string[];

    const transformErrors = await transformImportFiles(
      allFiles,
      { [ANGULAR_PACKAGE]: ANGULAR_VITE_PACKAGE },
      !!dryRun
    );

    if (transformErrors.length > 0) {
      logger.warn(`Encountered ${transformErrors.length} error(s) during file transformation:`);
      transformErrors.forEach(({ file, error }) => {
        logger.warn(`  - ${file}: ${error.message}`);
      });
    }

    // 6. Offer optional addons.
    if (!dryRun) {
      const wantsVitest = yes
        ? true
        : await prompt.confirm({
            message:
              'Set up @storybook/addon-vitest? (Recommended — enables in-browser component tests with Vitest)',
            initialValue: true,
          });

      if (wantsVitest) {
        try {
          await add('@storybook/addon-vitest', {
            packageManager: packageManager.type,
            configDir,
            skipInstall: true,
            skipPostinstall: false,
            yes: !!yes,
          });
        } catch (err) {
          logger.warn(`Could not set up @storybook/addon-vitest automatically: ${err}`);
          logger.warn('Run `npx storybook add @storybook/addon-vitest` manually to set it up.');
        }
      }

      const wantsA11y = yes
        ? true
        : await prompt.confirm({
            message: 'Set up @storybook/addon-a11y? (Adds accessibility checks to your stories)',
            initialValue: true,
          });

      if (wantsA11y) {
        try {
          await add('@storybook/addon-a11y', {
            packageManager: packageManager.type,
            configDir,
            skipInstall: true,
            skipPostinstall: false,
            yes: !!yes,
          });
        } catch (err) {
          logger.warn(`Could not set up @storybook/addon-a11y automatically: ${err}`);
          logger.warn('Run `npx storybook add @storybook/addon-a11y` manually to set it up.');
        }
      }
    }

    logger.step('Migration completed successfully!');
    logger.log(`For more information, see: ${FRAMEWORK_DOC_URL}`);
  },
};
